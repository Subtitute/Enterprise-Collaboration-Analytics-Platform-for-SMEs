import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ERROR_CODES } from '@app/common-dto';
import {
  AnalyticsService,
  AnalyticsSummary,
  ProjectProgress,
  TaskStatusBreakdown,
} from '../analytics/analytics.service';
import { RedisService } from '../redis/redis.service';

export interface AiInsightResult {
  insight: string;
  generatedAt: string;
}

// 28/07/2026: TTL cache DAI HON han cache KPI thuong (SUMMARY_CACHE_TTL_SECONDS = 8s trong
// analytics.service.ts) - o day muc dich chinh KHONG phai giam tai TimescaleDB (da co cache
// rieng cho tung truy van KPI), ma la GIAM SO LAN GOI Gemini API that su (tinh nang tao theo
// yeu cau nguoi dung - "Tao nhan xet AI", khong phai polling tu dong) de tiet kiem han ngach
// mien phi. 30 phut la du ngan de nhan xet khong qua "cu" so voi so lieu, du dai de 1 nguoi bam
// nut nhieu lan lien tiep (vd de xem lai) khong ton them 1 lan goi API nao.
const INSIGHT_CACHE_TTL_SECONDS = 1800;
const TOP_PROJECTS_LIMIT = 5;
const AI_PROVIDER_TIMEOUT_MS = 15000;
// 04/08/2026: nang tu 400 len 2048 sau khi xac minh song - cac model Gemini hien tai (vd
// gemini-flash-latest) tinh ca "thinking token" (suy luan noi bo, khong hien thi) vao chung
// maxOutputTokens. Muc 400 truoc day bi thinking chiem gan het, cat cut doan van tra ve giua
// chung (finishReason=MAX_TOKENS). Can du choi cho thinking (~250-500 token quan sat duoc) +
// doan van 3-5 cau thuc te.
const GEMINI_MAX_OUTPUT_TOKENS = 2048;
// 20/08/2026: cung muc voi Gemini o tren, cung ly do - openai/gpt-oss-120b (Groq) cung la model
// suy luan, tinh "reasoning token" vao chung max_tokens. Dat reasoning_effort: 'low' luc goi (xem
// callGroq) de giam bot phan nay, nhung van giu ngan sach rong de an toan.
const GROQ_MAX_OUTPUT_TOKENS = 2048;

const RANGE_LABELS: Record<string, string> = {
  '7d': '7 ngày gần nhất',
  '30d': '30 ngày gần nhất',
  quarter: 'quý gần nhất',
};

/**
 * 28/07/2026: tinh nang "Nhan xet AI" - hang muc dau tien trong loat nang cap tinh nang AI (sau
 * Frontend/DLQ/ACL/KPI phong ban). Chi goi Gemini API tren SO LIEU DA TONG HOP SAN (khong gui du
 * lieu tho/ca nhan cua tung nguoi dung), tai su dung nguyen 3 phuong thuc da co cua
 * AnalyticsService (getSummary/getTaskStatusBreakdown/getProjectProgress) - moi phuong thuc da tu
 * co cache Redis rieng nen goi lai o day khong tao them tai truy van dang ke cho TimescaleDB.
 */
@Injectable()
export class AiInsightsService {
  private readonly logger = new Logger(AiInsightsService.name);

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async generateInsight(
    organizationId: string,
    range: string,
    departmentId?: string,
    departmentName?: string,
  ): Promise<AiInsightResult> {
    const cacheKey = departmentId
      ? `analytics:ai-insight:${organizationId}:${range}:dept:${departmentId}`
      : `analytics:ai-insight:${organizationId}:${range}`;

    try {
      const cached = await this.redisService.getJson<AiInsightResult>(cacheKey);
      if (cached) return cached;
    } catch (err) {
      this.logger.warn(
        `Doc cache Redis that bai (key=${cacheKey}) - coi nhu cache miss va tao nhan xet moi: ${(err as Error).message}`,
      );
    }

    const geminiApiKey = this.configService.get<string>('gemini.apiKey');
    const groqApiKey = this.configService.get<string>('groq.apiKey');
    if (!geminiApiKey && !groqApiKey) {
      throw new ServiceUnavailableException({
        message: 'Tinh nang Nhan xet AI chua duoc cau hinh (thieu ca GEMINI_API_KEY lan GROQ_API_KEY) - lien he quan tri he thong.',
        errorCode: ERROR_CODES.AI_INSIGHT_NOT_CONFIGURED,
      });
    }

    const [summary, breakdown, projects] = await Promise.all([
      this.analyticsService.getSummary(organizationId, range, departmentId),
      this.analyticsService.getTaskStatusBreakdown(organizationId, range, undefined, departmentId),
      this.analyticsService.getProjectProgress(organizationId, range, departmentId),
    ]);

    const prompt = buildPrompt(range, summary, breakdown, projects, departmentName);
    const insightText = await this.generateText(prompt, geminiApiKey, groqApiKey);
    const result: AiInsightResult = { insight: insightText, generatedAt: new Date().toISOString() };

    try {
      await this.redisService.setJson(cacheKey, result, INSIGHT_CACHE_TTL_SECONDS);
    } catch (err) {
      this.logger.warn(
        `Ghi cache Redis that bai (key=${cacheKey}) - bo qua, van tra ve ket qua da tao cho request nay: ${(err as Error).message}`,
      );
    }

    return result;
  }

  /**
   * 20/08/2026: Gemini free tier thinh thoang tra ve 503 "qua tai" khi Google gap spike nhu cau
   * toan cuc (anh huong moi tier, khong rieng free - da xac minh qua log thuc te) - them Groq
   * (phan cung suy luan chuyen dung LPU, free tier it bi nghen hon vi khong dung chung GPU pool)
   * lam phuong an du phong TU DONG thay vi bat nguoi dung phai bam thu lai. Uu tien Gemini truoc
   * (van phong tieng Viet tot hon, model doc quyen lon hon), chi rot xuong Groq khi Gemini
   * loi/chua cau hinh. Chi khi CA HAI deu that bai/chua cau hinh moi thuc su bao loi.
   */
  private async generateText(prompt: string, geminiApiKey?: string, groqApiKey?: string): Promise<string> {
    if (geminiApiKey) {
      try {
        return await this.callGemini(geminiApiKey, prompt);
      } catch (err) {
        this.logger.warn(`Gemini that bai, thu Groq du phong (neu co cau hinh): ${(err as Error).message}`);
      }
    }
    if (groqApiKey) {
      try {
        return await this.callGroq(groqApiKey, prompt);
      } catch (err) {
        this.logger.error(`Groq (du phong) cung that bai: ${(err as Error).message}`);
      }
    }
    throw new ServiceUnavailableException({
      message: 'Khong the tao nhan xet AI luc nay, vui long thu lai sau.',
      errorCode: ERROR_CODES.AI_INSIGHT_GENERATION_FAILED,
    });
  }

  /**
   * Goi truc tiep REST API cua Gemini qua `fetch` co san cua Node 20 (xem package.json
   * "engines") thay vi them SDK `@google/genai` - endpoint nay chi la 1 lan POST/JSON don gian,
   * them SDK cho 1 lan goi duy nhat la khong can thiet (dung dinh huong "toi gian" cua du an -
   * ClaudeRule.md muc 8).
   *
   * 20/08/2026: nem Error thuong (khong phai ServiceUnavailableException) - loi o day duoc
   * generateText() bat va co the rot xuong Groq du phong, nem thang HTTP exception o day se lam
   * loi vuot qua ca bau du phong.
   */
  private async callGemini(apiKey: string, prompt: string): Promise<string> {
    const model = this.configService.get<string>('gemini.model');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_PROVIDER_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS },
        }),
        signal: controller.signal,
      });
    } catch (err) {
      throw new Error(`Goi Gemini API that bai (mang/timeout): ${(err as Error).message}`);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Gemini API tra ve loi HTTP ${response.status}: ${body}`);
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) {
      throw new Error(`Gemini API tra ve phan hoi khong co noi dung: ${JSON.stringify(data)}`);
    }
    return text;
  }

  /**
   * Groq dung dinh dang REST tuong thich OpenAI chat-completions (khac hoan toan Gemini) -
   * https://api.groq.com/openai/v1/chat/completions, header Authorization: Bearer <key>. Model
   * mac dinh openai/gpt-oss-120b (xem groq.model o configuration.ts) la model suy luan (giong
   * Gemini co "thinking token"), dat reasoning_effort: 'low' vi tac vu nay chi can 1 doan van
   * ngan, khong can suy luan nhieu buoc.
   */
  private async callGroq(apiKey: string, prompt: string): Promise<string> {
    const model = this.configService.get<string>('groq.model');
    const url = 'https://api.groq.com/openai/v1/chat/completions';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_PROVIDER_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4,
          max_tokens: GROQ_MAX_OUTPUT_TOKENS,
          reasoning_effort: 'low',
        }),
        signal: controller.signal,
      });
    } catch (err) {
      throw new Error(`Goi Groq API that bai (mang/timeout): ${(err as Error).message}`);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Groq API tra ve loi HTTP ${response.status}: ${body}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error(`Groq API tra ve phan hoi khong co noi dung: ${JSON.stringify(data)}`);
    }
    return text;
  }
}

/**
 * Chu y: prompt gui cho Gemini viet DAY DU DAU tieng Viet (khac quy uoc "khong dau" cua comment/
 * thong bao loi noi bo trong service nay) - day la noi dung ngon ngu tu nhien thuc su (khong
 * phai log/comment noi bo) va CHINH LA van phong ma Gemini duoc yeu cau mo phong lai trong doan
 * van no sinh ra, hien thi truc tiep cho nguoi dung tren giao dien (von da dung tieng Viet co
 * dau - xem cac trang FE nhu FailedEventsPage.tsx). Viet khong dau o day se lam giam chat luong
 * dau cau/dau thanh trong chinh cau tra loi cua Gemini.
 */
function buildPrompt(
  range: string,
  summary: AnalyticsSummary,
  breakdown: TaskStatusBreakdown,
  projects: ProjectProgress[],
  departmentName?: string,
): string {
  const scopeLabel = departmentName ? `phòng ban "${departmentName}"` : 'toàn tổ chức';
  const rangeLabel = RANGE_LABELS[range] ?? range;
  const topProjects = [...projects]
    .sort((a, b) => b.tasksCreated - a.tasksCreated)
    .slice(0, TOP_PROJECTS_LIMIT)
    .map((p) => `  - Dự án ${p.projectId}: ${p.completionRate}% hoàn thành (${p.tasksCompleted}/${p.tasksCreated} công việc)`)
    .join('\n');

  return `Bạn là trợ lý phân tích dữ liệu cho một nền tảng quản lý công việc dành cho doanh nghiệp vừa và nhỏ (SME). Dựa trên số liệu dưới đây, hãy viết MỘT đoạn nhận xét ngắn gọn (3-5 câu) bằng tiếng Việt có đầy đủ dấu, giọng văn chuyên nghiệp, nêu điểm nổi bật và một gợi ý cải thiện nếu phù hợp. KHÔNG bịa thêm số liệu ngoài dữ liệu được cung cấp, KHÔNG dùng định dạng markdown, KHÔNG thêm tiêu đề - chỉ trả về đoạn văn bản thuần.

Phạm vi: ${scopeLabel}
Khoảng thời gian: ${rangeLabel}

- Tổng số công việc được tạo: ${summary.totalTasksCreated}
- Số công việc đã hoàn thành: ${summary.totalTasksCompleted}
- Tỷ lệ hoàn thành: ${summary.completionRate}%
- Tài liệu mới tải lên: ${summary.newDocumentsThisWeek}
- Thành viên hoạt động: ${summary.activeUsersLast7Days}
- Phân bổ trạng thái hiện tại: Chưa bắt đầu ${breakdown.TODO}, Đang thực hiện ${breakdown.DOING}, Hoàn thành ${breakdown.DONE}${
    topProjects ? `\n- Các dự án tiêu biểu:\n${topProjects}` : ''
  }`;
}
