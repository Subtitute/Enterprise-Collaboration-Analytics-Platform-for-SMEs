import { LlmSession, LlmToolCall, LlmTurn, SessionInput } from './llm.types';
import { postJsonWithTimeout } from './post-json.util';

// Cung muc voi GROQ_MAX_OUTPUT_TOKENS cua AiInsightsService (model suy luan, tinh reasoning token).
const GROQ_MAX_OUTPUT_TOKENS = 2048;

interface GroqToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface GroqResponse {
  choices?: { message?: { content?: string | null; tool_calls?: GroqToolCall[] } }[];
}

function parseArguments(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * 24/10/2026: phien function-calling voi Groq (REST tuong thich OpenAI chat-completions) - phuong an
 * du phong TU DONG khi Gemini loi/qua tai, cung thu tu uu tien voi "Nhan xet AI". Chi gui lai
 * {role, content, tool_calls} cua tin nhan assistant (bo truong `reasoning` rieng cua Groq), moi
 * tool_call_id deu PHAI co 1 tin nhan role 'tool' tuong ung (xem ChatbotAgentService).
 */
export class GroqChatSession implements LlmSession {
  readonly provider = 'groq';
  private readonly messages: Record<string, unknown>[];

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly input: SessionInput,
  ) {
    this.messages = [
      { role: 'system', content: input.systemPrompt },
      ...input.history.map((message) => ({ role: message.role, content: message.content })),
      { role: 'user', content: input.question },
    ];
  }

  async next(allowTools: boolean, timeoutMs: number): Promise<LlmTurn> {
    const hasTools = this.input.tools.length > 0;
    const data = await postJsonWithTimeout<GroqResponse>(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: this.model,
        messages: this.messages,
        ...(hasTools
          ? {
              tools: this.input.tools.map((tool) => ({ type: 'function', function: tool })),
              tool_choice: allowTools ? 'auto' : 'none',
            }
          : {}),
        temperature: 0.3,
        max_tokens: GROQ_MAX_OUTPUT_TOKENS,
        reasoning_effort: 'low',
      },
      { Authorization: `Bearer ${this.apiKey}` },
      timeoutMs,
      'Groq',
    );

    const message = data.choices?.[0]?.message;
    if (!message) throw new Error('Groq tra ve phan hoi khong co message');
    const rawCalls = message.tool_calls ?? [];
    this.messages.push({
      role: 'assistant',
      content: message.content ?? '',
      ...(rawCalls.length > 0 ? { tool_calls: rawCalls } : {}),
    });

    const toolCalls: LlmToolCall[] = rawCalls.map((call) => ({
      id: call.id,
      name: call.function.name,
      args: parseArguments(call.function.arguments),
    }));
    return { text: (message.content ?? '').trim(), toolCalls };
  }

  addToolResults(results: { call: LlmToolCall; output: string }[]): void {
    for (const { call, output } of results) {
      this.messages.push({ role: 'tool', tool_call_id: call.id, content: output });
    }
  }
}
