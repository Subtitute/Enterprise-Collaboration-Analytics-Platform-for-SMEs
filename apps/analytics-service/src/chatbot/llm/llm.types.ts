/**
 * 24/10/2026: kieu du lieu TRUNG LAP nha cung cap (Gemini/Groq) cho vong lap tool-calling cua Chat bot
 * noi bo - ChatbotAgentService chi lam viec voi cac kieu nay, moi khac biet dinh dang REST cua tung
 * nha cung cap nam gon trong 1 "session" rieng (gemini-chat.session.ts / groq-chat.session.ts).
 */

/** Khai bao 1 tool theo JSON Schema (tap con OpenAPI) - dung chung cho ca 2 nha cung cap. */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
}

export interface LlmToolCall {
  /** id do nha cung cap cap (Groq luon co; Gemini co the khong) - dung de ghep ket qua tool tra ve. */
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface LlmTurn {
  text: string;
  toolCalls: LlmToolCall[];
}

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** 1 phien hoi-dap cho DUY NHAT 1 cau hoi - giu lich su vong lap (cau hoi, loi goi tool, ket qua tool). */
export interface LlmSession {
  readonly provider: string;
  /** `allowTools = false`: ep model tra loi bang van ban (vong cuoi, het luot goi tool). */
  next(allowTools: boolean, timeoutMs: number): Promise<LlmTurn>;
  addToolResults(results: { call: LlmToolCall; output: string }[]): void;
}

export interface SessionInput {
  systemPrompt: string;
  tools: ToolDefinition[];
  history: HistoryMessage[];
  question: string;
}
