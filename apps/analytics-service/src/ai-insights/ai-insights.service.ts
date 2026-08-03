import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
const GEMINI_TIMEOUT_MS = 15000;
const GEMINI_MAX_OUTPUT_TOKENS = 400;

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

    const apiKey = this.configService.get<string>('gemini.apiKey');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Tinh nang Nhan xet AI chua duoc cau hinh (thieu GEMINI_API_KEY) - lien he quan tri he thong.',
      );
    }

    const [summary, breakdown, projects] = await Promise.all([
      this.analyticsService.getSummary(organizationId, range, departmentId),
      this.analyticsService.getTaskStatusBreakdown(organizationId, range, undefined, departmentId),
      this.analyticsService.getProjectProgress(organizationId, range, departmentId),
    ]);

    const prompt = buildPrompt(range, summary, breakdown, projects, departmentName);
    const insightText = await this.callGemini(apiKey, prompt);
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
   * Goi truc tiep REST API cua Gemini qua `fetch` co san cua Node 20 (xem package.json
   * "engines") thay vi them SDK `@google/genai` - endpoint nay chi la 1 lan POST/JSON don gian,
   * them SDK cho 1 lan goi duy nhat la khong can thiet (dung dinh huong "toi gian" cua du an -
   * ClaudeRule.md muc 8).
   */
  private async callGemini(apiKey: string, prompt: string): Promise<string> {
    const model = this.configService.get<string>('gemini.model');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

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
      this.logger.error(`Goi Gemini API that bai (mang/timeout): ${(err as Error).message}`);
      throw new ServiceUnavailableException('Khong the tao nhan xet AI luc nay, vui long thu lai sau.');
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`Gemini API tra ve loi HTTP ${response.status}: ${body}`);
      throw new ServiceUnavailableException('Khong the tao nhan xet AI luc nay, vui long thu lai sau.');
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) {
      this.logger.error(`Gemini API tra ve phan hoi khong co noi dung: ${JSON.stringify(data)}`);
      throw new ServiceUnavailableException('Khong the tao nhan xet AI luc nay, vui long thu lai sau.');
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
