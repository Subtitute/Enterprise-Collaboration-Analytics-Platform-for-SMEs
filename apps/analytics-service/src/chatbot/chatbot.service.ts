import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { isUUID } from 'class-validator';
import { ERROR_CODES, PaginatedResponse, PaginationQueryDto, paginate } from '@app/common-dto';
import { ChatbotAgentService } from './chatbot-agent.service';
import { DocumentHit, ToolContext } from './chatbot-tools.service';
import { HistoryMessage } from './llm/llm.types';
import { toGmt7DateString } from './utils/gmt7.util';

// So tin nhan gan nhat cua hoi thoai gui kem lam ngu canh (5 cap hoi-dap) - du de hoi tiep "con viec
// kia thi sao?", khong de prompt phinh to theo do dai hoi thoai.
const HISTORY_MESSAGE_LIMIT = 10;
const MAX_HISTORY_CHARS_PER_MESSAGE = 2000;
const TITLE_MAX_CHARS = 80;

export interface ChatOwner {
  userId: string;
  organizationId: string;
}

export interface Citation {
  fileId: string;
  fileName: string;
}

export interface ConversationView {
  id: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageView {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  toolCalls: { name: string; args: Record<string, unknown> }[];
  createdAt: Date;
}

export interface AskResult {
  conversation: ConversationView;
  userMessage: MessageView;
  assistantMessage: MessageView;
  usage: { usedToday: number; dailyLimit: number };
}

const CONVERSATION_COLUMNS = 'id, title, created_at AS "createdAt", updated_at AS "updatedAt"';
const MESSAGE_COLUMNS = 'id, role, content, citations, tool_calls AS "toolCalls", created_at AS "createdAt"';

function toMessageView(row: Record<string, unknown>): MessageView {
  return {
    id: row.id as string,
    role: row.role as MessageView['role'],
    content: row.content as string,
    citations: (row.citations as Citation[] | null) ?? [],
    toolCalls: (row.toolCalls as MessageView['toolCalls'] | null) ?? [],
    createdAt: row.createdAt as Date,
  };
}

function conversationNotFound(): NotFoundException {
  return new NotFoundException({ message: 'Khong tim thay hoi thoai', errorCode: ERROR_CODES.CHATBOT_CONVERSATION_NOT_FOUND });
}

/**
 * Chi giu tai lieu ma cau tra loi THUC SU nhac ten (model duoc yeu cau trich [ten tai lieu]) - tai lieu
 * tim thay nhung khong duoc dung (vd model ket luan "khong lien quan") KHONG hien la nguon, tranh trich
 * dan gay hieu lam. So khop ca ten day du lan ten bo phan mo rong, khong phan biet hoa thuong. Khu
 * trung theo TEN (khong chi theo fileId): nhieu file khac nhau co the trung ten (vd du lieu demo tai len
 * nhieu lan) - model chi nhac duoc ten, khong phan biet duoc chung, hien 1 lan la du.
 */
export function pickCitations(answer: string, hits: DocumentHit[]): Citation[] {
  const normalizedAnswer = answer.toLowerCase();
  const seen = new Set<string>();
  const citations: Citation[] = [];
  for (const hit of hits) {
    const fullName = hit.fileName.toLowerCase();
    if (seen.has(fullName)) continue;
    const baseName = fullName.replace(/\.[a-z0-9]{1,5}$/, '');
    if (normalizedAnswer.includes(fullName) || (baseName.length >= 3 && normalizedAnswer.includes(baseName))) {
      seen.add(fullName);
      citations.push({ fileId: hit.fileId, fileName: hit.fileName });
    }
  }
  return citations;
}

/**
 * 24/10/2026: Chat bot noi bo (Technical_Spec.md muc 23) - quan ly hoi thoai + dieu phoi 1 cau hoi.
 * Bang luu trong TimescaleDB san co cua analytics-service (raw SQL qua DataSource, mirror
 * AnalyticsService - xem bootstrapChatbotSchema()). Hoi thoai la CA NHAN: MOI truy van deu loc theo
 * CA organization_id LAN user_id lay tu AuthContext (InternalAuthGuard) - nguoi dung khong bao gio
 * doc/xoa/hoi tiep duoc hoi thoai cua nguoi khac, id sai hay id cua nguoi khac deu tra CUNG 404.
 */
@Injectable()
export class ChatbotService {
  /**
   * 24/10/2026: hoi thoai dang co 1 cau hoi CHO tra loi (analytics-service chay 1 instance nen giu
   * trong bo nho la du). Phat hien qua kiem thu song: 2 cau hoi gui DONG THOI vao cung 1 hoi thoai
   * (2 tab, double-click) deu duoc tra loi voi CUNG 1 lich su cu (cau sau khong biet cau truoc), tin
   * nhan luu xen ke "hoi, hoi, dap, dap" lam hong ngu canh cac luot sau va ton 2 luot han ngach.
   */
  private readonly inFlightConversations = new Set<string>();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly agentService: ChatbotAgentService,
  ) {}

  async createConversation(owner: ChatOwner): Promise<ConversationView> {
    const rows: ConversationView[] = await this.dataSource.query(
      `INSERT INTO chatbot_conversations (organization_id, user_id) VALUES ($1, $2) RETURNING ${CONVERSATION_COLUMNS}`,
      [owner.organizationId, owner.userId],
    );
    return rows[0];
  }

  async listConversations(owner: ChatOwner, query: PaginationQueryDto): Promise<PaginatedResponse<ConversationView>> {
    const [rows, countRows] = await Promise.all([
      this.dataSource.query(
        `SELECT ${CONVERSATION_COLUMNS} FROM chatbot_conversations
          WHERE organization_id = $1 AND user_id = $2
          ORDER BY updated_at DESC
          LIMIT $3 OFFSET $4`,
        [owner.organizationId, owner.userId, query.limit, (query.page - 1) * query.limit],
      ) as Promise<ConversationView[]>,
      this.dataSource.query(
        'SELECT count(*)::int AS total FROM chatbot_conversations WHERE organization_id = $1 AND user_id = $2',
        [owner.organizationId, owner.userId],
      ) as Promise<{ total: number }[]>,
    ]);
    return paginate(rows, countRows[0]?.total ?? 0, query.page, query.limit);
  }

  async listMessages(owner: ChatOwner, conversationId: string): Promise<MessageView[]> {
    await this.findOwnedConversation(owner, conversationId);
    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `SELECT ${MESSAGE_COLUMNS} FROM chatbot_messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
      [conversationId],
    );
    return rows.map(toMessageView);
  }

  async deleteConversation(owner: ChatOwner, conversationId: string): Promise<void> {
    await this.findOwnedConversation(owner, conversationId);
    // Tin nhan bi xoa theo qua FK ON DELETE CASCADE (chatbot_messages.conversation_id).
    await this.dataSource.query('DELETE FROM chatbot_conversations WHERE id = $1 AND organization_id = $2 AND user_id = $3', [
      conversationId,
      owner.organizationId,
      owner.userId,
    ]);
  }

  /**
   * Thu tu co chu dich: (1) kiem tra cau hinh + quyen so huu hoi thoai TRUOC khi tru han ngach (loi
   * cua nguoi dung khong ton luot hoi); (2) tru han ngach TRUOC khi goi LLM (dem theo LUOT HOI, ke ca
   * khi LLM loi - han ngach Gemini van co the da bi tieu hao); (3) chi luu ca cap hoi-dap SAU KHI co
   * cau tra loi, trong 1 transaction - loi giua chung khong de lai cau hoi "mo coi" khong co tra loi.
   */
  async ask(ctx: ToolContext, conversationId: string, question: string): Promise<AskResult> {
    const owner: ChatOwner = { userId: ctx.userId, organizationId: ctx.organizationId };
    if (!this.agentService.isConfigured()) {
      throw new ServiceUnavailableException({
        message: 'Chat bot chua duoc cau hinh (thieu ca GEMINI_API_KEY lan GROQ_API_KEY) - lien he quan tri he thong.',
        errorCode: ERROR_CODES.CHATBOT_NOT_CONFIGURED,
      });
    }
    const conversation = await this.findOwnedConversation(owner, conversationId);
    // Kiem tra + danh dau trong CUNG 1 tick (khong co await xen giua) - TRUOC khi tru han ngach.
    if (this.inFlightConversations.has(conversationId)) {
      throw new ConflictException({
        message: 'Hoi thoai dang xu ly 1 cau hoi khac, vui long doi cau tra loi truoc khi hoi tiep.',
        errorCode: ERROR_CODES.CHATBOT_CONVERSATION_BUSY,
      });
    }
    this.inFlightConversations.add(conversationId);
    try {
      return await this.answer(ctx, owner, conversation, question);
    } finally {
      this.inFlightConversations.delete(conversationId);
    }
  }

  private async answer(ctx: ToolContext, owner: ChatOwner, conversation: ConversationView, question: string): Promise<AskResult> {
    const conversationId = conversation.id;
    const usage = await this.consumeDailyQuota(owner);
    const askedAt = new Date();
    const history = await this.loadHistory(conversationId);

    const result = await this.agentService.run({ history, question, toolContext: ctx });
    const citations = pickCitations(result.answer, result.documentHits);
    const answeredAt = new Date();

    return this.dataSource.transaction(async (manager) => {
      // 24/10/2026: khoa + kiem tra LAI quyen so huu ngay trong transaction - phat hien qua kiem thu
      // song: hoi thoai bi xoa trong luc cho LLM (vai giay) truoc day lam INSERT vi pham FK
      // chatbot_messages_conversation_id_fkey -> 500 INTERNAL_ERROR (kem stack trace trong log); nay
      // tra 404 nhu moi truong hop "khong tim thay". FOR UPDATE: DELETE dong thoi phai cho transaction
      // nay xong roi moi xoa (kem tin nhan vua luu, qua ON DELETE CASCADE).
      const locked: { title: string | null }[] = await manager.query(
        'SELECT title FROM chatbot_conversations WHERE id = $1 AND organization_id = $2 AND user_id = $3 FOR UPDATE',
        [conversationId, owner.organizationId, owner.userId],
      );
      if (locked.length === 0) throw conversationNotFound();
      const title = locked[0].title ?? question.trim().replace(/\s+/g, ' ').slice(0, TITLE_MAX_CHARS).trim();

      const [userRow] = await manager.query(
        `INSERT INTO chatbot_messages (conversation_id, role, content, created_at) VALUES ($1, 'user', $2, $3) RETURNING ${MESSAGE_COLUMNS}`,
        [conversationId, question, askedAt],
      );
      const [assistantRow] = await manager.query(
        `INSERT INTO chatbot_messages (conversation_id, role, content, tool_calls, citations, created_at)
         VALUES ($1, 'assistant', $2, $3, $4, $5) RETURNING ${MESSAGE_COLUMNS}`,
        [conversationId, result.answer, JSON.stringify(result.toolCalls), JSON.stringify(citations), answeredAt],
      );
      await manager.query('UPDATE chatbot_conversations SET title = $2, updated_at = $3 WHERE id = $1', [
        conversationId,
        title,
        answeredAt,
      ]);
      return {
        conversation: { ...conversation, title, updatedAt: answeredAt },
        userMessage: toMessageView(userRow),
        assistantMessage: toMessageView(assistantRow),
        usage,
      };
    });
  }

  private async findOwnedConversation(owner: ChatOwner, conversationId: string): Promise<ConversationView> {
    // id khong dung dinh dang UUID -> 404 nhu "khong ton tai" (thay vi de Postgres nem loi 22P02 -> 500).
    if (!isUUID(conversationId)) throw conversationNotFound();
    const rows: ConversationView[] = await this.dataSource.query(
      `SELECT ${CONVERSATION_COLUMNS} FROM chatbot_conversations WHERE id = $1 AND organization_id = $2 AND user_id = $3`,
      [conversationId, owner.organizationId, owner.userId],
    );
    if (rows.length === 0) throw conversationNotFound();
    return rows[0];
  }

  /**
   * Tran so cau hoi/ngay/nguoi dung (ngay theo lich GMT+7) - han ngach Gemini free tier dung chung voi
   * "Nhan xet AI". 1 cau lenh UPSERT NGUYEN TU: chi tang bo dem khi CON duoi tran (menh de WHERE cua
   * ON CONFLICT DO UPDATE), nen 2 request dong thoi khong the cung "lot" qua tran.
   */
  private async consumeDailyQuota(owner: ChatOwner): Promise<{ usedToday: number; dailyLimit: number }> {
    const dailyLimit = this.configService.get<number>('chatbot.dailyQuestionLimit') ?? 30;
    const rows: { questionCount: number }[] = await this.dataSource.query(
      `INSERT INTO chatbot_daily_usage (user_id, usage_date, organization_id, question_count)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (user_id, usage_date) DO UPDATE
         SET question_count = chatbot_daily_usage.question_count + 1
         WHERE chatbot_daily_usage.question_count < $4
       RETURNING question_count AS "questionCount"`,
      [owner.userId, toGmt7DateString(new Date()), owner.organizationId, dailyLimit],
    );
    if (rows.length === 0) {
      throw new HttpException(
        {
          message: `Ban da dung het ${dailyLimit} cau hoi cho chat bot hom nay, vui long quay lai vao ngay mai.`,
          errorCode: ERROR_CODES.CHATBOT_DAILY_LIMIT_EXCEEDED,
          errorParams: { limit: dailyLimit },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return { usedToday: rows[0].questionCount, dailyLimit };
  }

  private async loadHistory(conversationId: string): Promise<HistoryMessage[]> {
    const rows: { role: HistoryMessage['role']; content: string }[] = await this.dataSource.query(
      `SELECT role, content FROM (
         SELECT role, content, created_at FROM chatbot_messages
          WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT $2
       ) recent ORDER BY created_at ASC`,
      [conversationId, HISTORY_MESSAGE_LIMIT],
    );
    return rows.map((row) => ({ role: row.role, content: row.content.slice(0, MAX_HISTORY_CHARS_PER_MESSAGE) }));
  }
}
