import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ERROR_CODES } from '@app/common-dto';
import { buildSystemPrompt } from './chatbot-prompt';
import { ChatbotToolsService, DocumentHit, ToolContext, ToolExecution } from './chatbot-tools.service';
import { GeminiChatSession } from './llm/gemini-chat.session';
import { GroqChatSession } from './llm/groq-chat.session';
import { HistoryMessage, LlmSession, LlmToolCall, SessionInput } from './llm/llm.types';

// Toi da 4 vong goi tool cho 1 cau hoi, vong thu 5 (neu toi) bat buoc tra loi bang van ban.
export const MAX_TOOL_ROUNDS = 4;
// Tran thoi gian toan bo 1 cau hoi - Gateway cho nhom route analytics 120s (proxy-routes.config.ts)
// va nginx cua web mac dinh 60s; 45s de cau tra loi (hoac loi ro rang) LUON ve truoc ca 2 moc do.
export const TOTAL_BUDGET_MS = 45_000;
// Cung muc AI_PROVIDER_TIMEOUT_MS cua AiInsightsService.
const LLM_CALL_TIMEOUT_MS = 15_000;
const TOOL_CALL_TIMEOUT_MS = 10_000;
// Con it hon muc nay thi khong bat dau them 1 lan goi LLM nua (chac chan khong kip).
const MIN_REMAINING_MS = 3_000;
const MAX_TOOL_CALLS_PER_ROUND = 4;

export interface AgentResult {
  answer: string;
  provider: string;
  toolCalls: { name: string; args: Record<string, unknown> }[];
  documentHits: DocumentHit[];
}

export interface AgentInput {
  history: HistoryMessage[];
  question: string;
  toolContext: ToolContext;
}

type SessionFactory = (input: SessionInput) => LlmSession;

/**
 * 24/10/2026: vong lap tool-calling cua Chat bot noi bo (Technical_Spec.md muc 23.4-23.5): hoi model
 * -> model chon tool -> goi tool (qua Gateway, bang JWT nguoi hoi) -> dua ket qua lai cho model -> ...
 * -> cau tra loi cuoi. KHONG streaming (frontend chi hien "dang xu ly...").
 *
 * Du phong nha cung cap mirror "Nhan xet AI": Gemini truoc, Groq sau. Khi 1 nha cung cap loi o BAT KY
 * vong nao, cau hoi duoc chay LAI tu dau voi nha cung cap ke tiep (2 ben khac dinh dang hoi thoai - Gemini
 * con bat buoc gui lai thoughtSignature cua chinh no - nen khong "noi tiep" giua chung duoc). Ket qua
 * tool duoc CACHE theo (ten, tham so) trong pham vi 1 cau hoi: chay lai voi Groq khong goi lai Gateway/
 * Gemini embedding cho cung 1 tool call. Ca 2 lan thu dung chung 1 tran thoi gian TOTAL_BUDGET_MS.
 */
@Injectable()
export class ChatbotAgentService {
  private readonly logger = new Logger(ChatbotAgentService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly toolsService: ChatbotToolsService,
  ) {}

  isConfigured(): boolean {
    return this.sessionFactories().length > 0;
  }

  async run(input: AgentInput): Promise<AgentResult> {
    const deadline = Date.now() + TOTAL_BUDGET_MS;
    const sessionInput: SessionInput = {
      systemPrompt: buildSystemPrompt(new Date()),
      tools: this.toolsService.getDefinitions(input.toolContext.permissions),
      history: input.history,
      question: input.question,
    };
    const toolCache = new Map<string, Promise<ToolExecution>>();

    for (const createSession of this.sessionFactories()) {
      const session = createSession(sessionInput);
      const executed: ToolExecution[] = [];
      try {
        const answer = await this.runLoop(session, input.toolContext, deadline, toolCache, executed);
        return {
          answer,
          provider: session.provider,
          toolCalls: executed.map(({ name, args }) => ({ name, args })),
          documentHits: executed.flatMap((execution) => execution.documentHits),
        };
      } catch (err) {
        this.logger.warn(`Chat bot: ${session.provider} that bai, thu nha cung cap du phong (neu con): ${(err as Error).message}`);
      }
    }

    throw new ServiceUnavailableException({
      message: 'Chat bot tam thoi khong tra loi duoc, vui long thu lai sau.',
      errorCode: ERROR_CODES.CHATBOT_GENERATION_FAILED,
    });
  }

  private async runLoop(
    session: LlmSession,
    ctx: ToolContext,
    deadline: number,
    toolCache: Map<string, Promise<ToolExecution>>,
    executed: ToolExecution[],
  ): Promise<string> {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const remaining = deadline - Date.now();
      if (remaining < MIN_REMAINING_MS) throw new Error(`Het thoi gian tra loi (${TOTAL_BUDGET_MS}ms)`);

      const allowTools = round < MAX_TOOL_ROUNDS;
      const turn = await session.next(allowTools, Math.min(LLM_CALL_TIMEOUT_MS, remaining));
      if (turn.toolCalls.length === 0 || !allowTools) {
        if (!turn.text) throw new Error(`${session.provider} khong tra ve noi dung cau tra loi`);
        return turn.text;
      }

      // MOI tool call deu phai co 1 ket qua tuong ung (ca Gemini lan Groq deu tu choi lich su thieu
      // ket qua) - phan vuot MAX_TOOL_CALLS_PER_ROUND duoc tra ve 1 loi ngan thay vi bi bo qua im lang.
      const toolTimeout = Math.min(TOOL_CALL_TIMEOUT_MS, Math.max(deadline - Date.now() - MIN_REMAINING_MS, 1_000));
      const results = await Promise.all(
        turn.toolCalls.map((call, index) =>
          index < MAX_TOOL_CALLS_PER_ROUND
            ? this.executeCached(call, ctx, toolTimeout, toolCache)
            : Promise.resolve<ToolExecution>({
                name: call.name,
                args: call.args,
                output: JSON.stringify({ error: 'Bỏ qua: quá nhiều công cụ trong một lượt, hãy gọi lần lượt.' }),
                documentHits: [],
              }),
        ),
      );
      executed.push(...results.slice(0, MAX_TOOL_CALLS_PER_ROUND));
      session.addToolResults(turn.toolCalls.map((call, index) => ({ call, output: results[index].output })));
    }
    throw new Error(`Vuot qua ${MAX_TOOL_ROUNDS} vong goi tool`);
  }

  private executeCached(
    call: LlmToolCall,
    ctx: ToolContext,
    timeoutMs: number,
    cache: Map<string, Promise<ToolExecution>>,
  ): Promise<ToolExecution> {
    const key = `${call.name}:${JSON.stringify(call.args)}`;
    let pending = cache.get(key);
    if (!pending) {
      pending = this.toolsService.execute(call.name, call.args, ctx, timeoutMs);
      cache.set(key, pending);
    }
    return pending;
  }

  private sessionFactories(): SessionFactory[] {
    const factories: SessionFactory[] = [];
    const geminiApiKey = this.configService.get<string>('gemini.apiKey');
    const groqApiKey = this.configService.get<string>('groq.apiKey');
    if (geminiApiKey) {
      const model = this.configService.get<string>('chatbot.geminiModel') ?? 'gemini-flash-lite-latest';
      factories.push((input) => new GeminiChatSession(geminiApiKey, model, input));
    }
    if (groqApiKey) {
      const model = this.configService.get<string>('groq.model') ?? 'openai/gpt-oss-120b';
      factories.push((input) => new GroqChatSession(groqApiKey, model, input));
    }
    return factories;
  }
}
