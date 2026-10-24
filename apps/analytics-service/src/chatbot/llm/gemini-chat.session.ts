import { LlmSession, LlmToolCall, LlmTurn, SessionInput, ToolDefinition } from './llm.types';
import { postJsonWithTimeout } from './post-json.util';

// Cung muc voi GEMINI_MAX_OUTPUT_TOKENS cua AiInsightsService - model Gemini hien tai tinh ca
// "thinking token" vao maxOutputTokens, can du cho ca suy luan lan cau tra loi.
const GEMINI_MAX_OUTPUT_TOKENS = 2048;

interface GeminiPart {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  functionCall?: { id?: string; name: string; args?: Record<string, unknown> };
  functionResponse?: { id?: string; name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiResponse {
  candidates?: { content?: GeminiContent; finishReason?: string }[];
}

function toFunctionDeclaration(tool: ToolDefinition) {
  // Gemini tu choi `parameters` co `properties` rong - tool khong tham so thi bo han truong nay.
  return Object.keys(tool.parameters.properties).length === 0
    ? { name: tool.name, description: tool.description }
    : { name: tool.name, description: tool.description, parameters: tool.parameters };
}

/**
 * 24/10/2026: phien function-calling voi Gemini (REST generateContent). Luu y quan trong da xac minh
 * song 24/10/2026: model Gemini 3.x tra ve `thoughtSignature` di kem `functionCall` va BAT BUOC gui
 * lai nguyen ven o vong sau - vi vay `content` cua model duoc day NGUYEN VAN vao `contents` (khong
 * dung lai tu text/toolCalls da boc tach). Ket qua tool tra ve dang `functionResponse` (role 'user'),
 * kem `id` khi model co cap.
 */
export class GeminiChatSession implements LlmSession {
  readonly provider = 'gemini';
  private readonly contents: GeminiContent[];
  private readonly providerCallIds = new Set<string>();
  private callCounter = 0;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly input: SessionInput,
  ) {
    this.contents = [
      ...input.history.map((message): GeminiContent => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      })),
      { role: 'user', parts: [{ text: input.question }] },
    ];
  }

  async next(allowTools: boolean, timeoutMs: number): Promise<LlmTurn> {
    const hasTools = this.input.tools.length > 0;
    const data = await postJsonWithTimeout<GeminiResponse>(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
      {
        systemInstruction: { parts: [{ text: this.input.systemPrompt }] },
        contents: this.contents,
        ...(hasTools
          ? {
              tools: [{ functionDeclarations: this.input.tools.map(toFunctionDeclaration) }],
              toolConfig: { functionCallingConfig: { mode: allowTools ? 'AUTO' : 'NONE' } },
            }
          : {}),
        generationConfig: { temperature: 0.3, maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS },
      },
      // Header thay vi `?key=` - key khong lot vao log URL/loi (khac callGemini() cu cua AiInsightsService).
      { 'x-goog-api-key': this.apiKey },
      timeoutMs,
      'Gemini',
    );

    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    if (parts.length === 0) {
      throw new Error(`Gemini tra ve phan hoi rong (finishReason=${candidate?.finishReason ?? 'khong ro'})`);
    }
    this.contents.push({ role: 'model', parts });

    const toolCalls: LlmToolCall[] = parts
      .filter((part) => part.functionCall)
      .map((part) => {
        const call = part.functionCall as NonNullable<GeminiPart['functionCall']>;
        if (call.id) this.providerCallIds.add(call.id);
        return { id: call.id ?? `gemini-call-${++this.callCounter}`, name: call.name, args: call.args ?? {} };
      });
    const text = parts
      .filter((part) => typeof part.text === 'string' && !part.thought)
      .map((part) => part.text)
      .join('')
      .trim();
    return { text, toolCalls };
  }

  addToolResults(results: { call: LlmToolCall; output: string }[]): void {
    this.contents.push({
      role: 'user',
      parts: results.map(({ call, output }) => ({
        functionResponse: {
          ...(this.providerCallIds.has(call.id) ? { id: call.id } : {}),
          name: call.name,
          response: { result: output },
        },
      })),
    });
  }
}
