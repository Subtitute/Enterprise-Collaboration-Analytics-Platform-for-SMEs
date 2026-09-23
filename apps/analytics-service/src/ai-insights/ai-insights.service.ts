import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ERROR_CODES } from '@app/common-dto';
import { AnalyticsService } from '../analytics/analytics.service';
import { RedisService } from '../redis/redis.service';

export type InsightSeverity = 'critical' | 'warning' | 'info';
export type InsightScope = 'organization' | 'department' | 'project';

export interface StructuredInsight {
  scope: InsightScope;
  /** null khi scope='organization'. UUID tho (department/project) - frontend tu resolve ten qua API rieng, cung quy uoc voi ProjectProgress.projectId (analytics.service.ts). */
  scopeId: string | null;
  severity: InsightSeverity;
  /** Ten chi so tieng Anh khong dau (vd 'completion_rate') - dung lam key icon/mau o frontend, khong hien thi truc tiep. */
  metric: string;
  headline: string;
  detail: string;
  recommendation: string | null;
  evidence: {
    value: number;
    /** null khi scope='organization' (khong co gi de so sanh) - nguoc lai la completionRate cua toan to chuc, TU BACKEND TINH (khong lay tu AI) de dam bao chinh xac. */
    comparisonValue: number | null;
    unit: 'percent';
  };
}

/** 1 "ung vien" da duoc AI xet duyet (du duoc chon lam insight hay khong) - dung de FRONTEND ve
 *  bieu do so sanh TOAN BO pham vi da quet (khong chi 2-4 muc duoc chon), giup nguoi xem thay ro
 *  AI da can nhac tren nen du lieu day du, khong chi 1 vai con so rieng le tu chon san. */
export interface AiInsightCandidateSummary {
  scope: InsightScope;
  scopeId: string | null;
  completionRate: number;
}

export interface AiInsightsResult {
  range: string;
  generatedAt: string;
  insights: StructuredInsight[];
  candidates: AiInsightCandidateSummary[];
}

interface Candidate {
  scope: InsightScope;
  scopeId: string | null;
  totalTasksCreated: number;
  totalTasksCompleted: number;
  completionRate: number;
}

/** 1 muc AI chon ra tu danh sach candidate - CHI mang phan dinh tinh (van ban) + itemIndex de doi
 *  chieu nguoc lai candidate; KHONG mang so lieu (so lieu do BACKEND gan vao sau, xem generateInsights()). */
interface RawLlmInsight {
  itemIndex: number;
  severity: InsightSeverity;
  metric: string;
  headline: string;
  detail: string;
  recommendation: string | null;
}

// 28/07/2026: TTL cache DAI HON han cache KPI thuong (SUMMARY_CACHE_TTL_SECONDS = 8s trong
// analytics.service.ts) - o day muc dich chinh KHONG phai giam tai TimescaleDB (da co cache
// rieng cho tung truy van KPI), ma la GIAM SO LAN GOI Gemini API that su (tinh nang tao theo
// yeu cau nguoi dung - "Tao nhan xet AI", khong phai polling tu dong) de tiet kiem han ngach
// mien phi. 30 phut la du ngan de nhan xet khong qua "cu" so voi so lieu, du dai de 1 nguoi bam
// nut nhieu lan lien tiep (vd de xem lai) khong ton them 1 lan goi API nao.
const INSIGHT_CACHE_TTL_SECONDS = 1800;
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

// 22/09/2026: gioi han so candidate quet (giu prompt gon, chi phi/do tre du doan) va so insight
// hien thi toi da (giu giao dien gon, dung "vai tro dieu huong su chu y" cua tinh nang - khong
// phai liet ke moi thu).
const MAX_DEPARTMENT_CANDIDATES = 8;
const MAX_PROJECT_CANDIDATES = 3;
const MAX_INSIGHTS = 4;

const RANGE_LABELS: Record<string, string> = {
  '7d': '7 ngày gần nhất',
  '30d': '30 ngày gần nhất',
  quarter: 'quý gần nhất',
};

/**
 * 22/09/2026: thiet ke lai tinh nang "Nhan xet AI" (truoc do: 1 doan van tu do, frontend phai
 * regex-tach thanh 3 gach dau dong "Diem sang/Rui ro/Khuyen nghi" - xem AnalyticsPage.tsx ban cu)
 * thanh 1 bo INSIGHT CO CAU TRUC: AI chi dong vai tro PHAN LOAI/XEP HANG (chon 2-4 muc DANG CHU Y
 * NHAT trong toi da ~13 "ung vien" - toan to chuc + tung phong ban + top du an), KHONG con tu do
 * viet 1 bai van dai. Moi insight gan voi 1 CARD rieng o frontend (thay vi 1 khoi van ban), co
 * severity/scope ro rang de ve giao dien truc quan hon nhieu so voi doc 1 doan van.
 *
 * Nguyen tac quan trong: AI KHONG BAO GIO tu tinh/tra ve so lieu (evidence.value/comparisonValue) -
 * cac gia tri nay BACKEND tu gan vao TU DU LIEU THAT cua candidate duoc chon (xem generateInsights()),
 * AI chi tra ve itemIndex (de doi chieu) + phan van ban dinh tinh (headline/detail/recommendation).
 * Day la diem khac biet cot loi voi ban thiet ke cu: AI khong con "tinh toan ho" so lieu tu du lieu
 * tho gui kem prompt, ma CHI xep hang/dien giai so lieu BACKEND DA TINH SAN - loai bo hoan toan rui
 * ro AI "bia" hoac tinh sai con so hien thi cho nguoi dung.
 */
@Injectable()
export class AiInsightsService {
  private readonly logger = new Logger(AiInsightsService.name);

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async generateInsights(organizationId: string, range: string): Promise<AiInsightsResult> {
    const cacheKey = `analytics:ai-insights:${organizationId}:${range}`;

    try {
      const cached = await this.redisService.getJson<AiInsightsResult>(cacheKey);
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

    const candidates = await this.buildCandidates(organizationId, range);
    const prompt = buildStructuredPrompt(range, candidates);
    const rawInsights = await this.generateStructuredInsights(prompt, geminiApiKey, groqApiKey);

    const orgCandidate = candidates[0];
    const insights: StructuredInsight[] = [];
    for (const raw of rawInsights) {
      const candidate = candidates[raw.itemIndex];
      // AI co the "bia" itemIndex khong ton tai (vd doc sai so, hoac danh sach candidate qua
      // ngan) - bo qua muc do thay vi de crash toan bo phan hoi (cac muc con lai van hien thi binh
      // thuong, tuong tu cach getVisibleProjectIds() rong khong lam sap ProjectsService.findAll()).
      if (!candidate) continue;
      insights.push({
        scope: candidate.scope,
        scopeId: candidate.scopeId,
        severity: raw.severity,
        metric: raw.metric,
        headline: raw.headline,
        detail: raw.detail,
        recommendation: raw.recommendation,
        evidence: {
          value: candidate.completionRate,
          comparisonValue: candidate.scope === 'organization' ? null : orgCandidate.completionRate,
          unit: 'percent',
        },
      });
      if (insights.length >= MAX_INSIGHTS) break;
    }

    if (insights.length === 0) {
      throw new ServiceUnavailableException({
        message: 'Khong the tao nhan xet AI luc nay, vui long thu lai sau.',
        errorCode: ERROR_CODES.AI_INSIGHT_GENERATION_FAILED,
      });
    }

    const result: AiInsightsResult = {
      range,
      generatedAt: new Date().toISOString(),
      insights,
      candidates: candidates.map((c) => ({ scope: c.scope, scopeId: c.scopeId, completionRate: c.completionRate })),
    };

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
   * 22/09/2026: "menu" ung vien cho AI xep hang - [0] LUON la toan to chuc (dung lam moc so sanh
   * cho evidence.comparisonValue cua moi muc khac), tiep theo la tung phong ban DANG CO HOAT DONG
   * trong khoang thoi gian (bo qua phong ban rong - khong co gi de nhan xet), cuoi cung la top du
   * an theo so cong viec tao moi (du an "song dong" nhat, nhieu du lieu de danh gia nhat).
   */
  private async buildCandidates(organizationId: string, range: string): Promise<Candidate[]> {
    const orgSummary = await this.analyticsService.getSummary(organizationId, range);
    const candidates: Candidate[] = [
      {
        scope: 'organization',
        scopeId: null,
        totalTasksCreated: orgSummary.totalTasksCreated,
        totalTasksCompleted: orgSummary.totalTasksCompleted,
        completionRate: orgSummary.completionRate,
      },
    ];

    const departmentIds = (await this.analyticsService.listActiveDepartmentIds(organizationId)).slice(
      0,
      MAX_DEPARTMENT_CANDIDATES,
    );
    const departmentSummaries = await Promise.all(
      departmentIds.map((id) => this.analyticsService.getSummary(organizationId, range, id)),
    );
    departmentIds.forEach((departmentId, i) => {
      const summary = departmentSummaries[i];
      if (summary.totalTasksCreated === 0) return; // khong co hoat dong trong khoang - khong co gi de nhan xet.
      candidates.push({
        scope: 'department',
        scopeId: departmentId,
        totalTasksCreated: summary.totalTasksCreated,
        totalTasksCompleted: summary.totalTasksCompleted,
        completionRate: summary.completionRate,
      });
    });

    const projects = await this.analyticsService.getProjectProgress(organizationId, range);
    const topProjects = [...projects].sort((a, b) => b.tasksCreated - a.tasksCreated).slice(0, MAX_PROJECT_CANDIDATES);
    for (const project of topProjects) {
      candidates.push({
        scope: 'project',
        scopeId: project.projectId,
        totalTasksCreated: project.tasksCreated,
        totalTasksCompleted: project.tasksCompleted,
        completionRate: project.completionRate,
      });
    }

    return candidates;
  }

  /**
   * 20/08/2026: Gemini free tier thinh thoang tra ve 503 "qua tai" khi Google gap spike nhu cau
   * toan cuc (anh huong moi tier, khong rieng free - da xac minh qua log thuc te) - them Groq
   * (phan cung suy luan chuyen dung LPU, free tier it bi nghen hon vi khong dung chung GPU pool)
   * lam phuong an du phong TU DONG thay vi bat nguoi dung phai bam thu lai. Uu tien Gemini truoc
   * (van phong tieng Viet tot hon, model doc quyen lon hon), chi rot xuong Groq khi Gemini
   * loi/chua cau hinh.
   *
   * 22/09/2026: mo rong pham vi "that bai" ngoai loi HTTP/mang - neu Gemini tra ve 200 OK nhung
   * noi dung KHONG PHAI JSON hop le hoac khong co muc nao vuot qua validate (xem parseInsightsJson()),
   * cung coi la that bai va rot xuong Groq du phong - truoc day (ban prose) chi loi mang/HTTP moi
   * kich hoat du phong, "tra ve OK nhung noi dung vo dung" khong duoc coi la loi vi chi la 1 doan
   * van tu do, khong co gi de validate.
   */
  private async generateStructuredInsights(
    prompt: string,
    geminiApiKey?: string,
    groqApiKey?: string,
  ): Promise<RawLlmInsight[]> {
    if (geminiApiKey) {
      try {
        const text = await this.callGemini(geminiApiKey, prompt);
        return parseInsightsJson(text);
      } catch (err) {
        this.logger.warn(`Gemini that bai/tra ve JSON khong hop le, thu Groq du phong (neu co cau hinh): ${(err as Error).message}`);
      }
    }
    if (groqApiKey) {
      try {
        const text = await this.callGroq(groqApiKey, prompt);
        return parseInsightsJson(text);
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
   * generateStructuredInsights() bat va co the rot xuong Groq du phong, nem thang HTTP exception o
   * day se lam loi vuot qua ca bau du phong.
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
   * Gemini co "thinking token"), dat reasoning_effort: 'low' vi tac vu nay chi can 1 mang JSON
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
 * 22/09/2026: parse + validate phan hoi AI thanh mang RawLlmInsight[] - CA 2 nha cung cap (Gemini/
 * Groq) thinh thoang boc ket qua JSON trong markdown code fence (```json ... ```) du prompt yeu
 * cau "khong kem markdown", nen luon thu boc tach truoc khi JSON.parse(). Loc bo tung phan tu
 * KHONG hop le (thay vi nem loi toan bo mang) - 1 phan tu sai dinh dang khong nen huy hoai ca 3
 * phan tu con lai hop le. Nem loi (kich hoat rot xuong Groq du phong o generateStructuredInsights())
 * CHI khi KHONG CON phan tu hop le nao sau khi loc.
 */
function parseInsightsJson(text: string): RawLlmInsight[] {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new Error(`Phan hoi AI khong phai JSON hop le: ${stripped.slice(0, 200)}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Phan hoi AI khong phai mot mang JSON');
  }

  const VALID_SEVERITIES = new Set(['critical', 'warning', 'info']);
  const validated: RawLlmInsight[] = [];
  for (const item of parsed) {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as Record<string, unknown>).itemIndex === 'number' &&
      typeof (item as Record<string, unknown>).severity === 'string' &&
      VALID_SEVERITIES.has((item as Record<string, unknown>).severity as string) &&
      typeof (item as Record<string, unknown>).metric === 'string' &&
      ((item as Record<string, unknown>).metric as string).trim().length > 0 &&
      typeof (item as Record<string, unknown>).headline === 'string' &&
      ((item as Record<string, unknown>).headline as string).trim().length > 0 &&
      typeof (item as Record<string, unknown>).detail === 'string' &&
      ((item as Record<string, unknown>).detail as string).trim().length > 0 &&
      ((item as Record<string, unknown>).recommendation === null ||
        typeof (item as Record<string, unknown>).recommendation === 'string')
    ) {
      validated.push(item as unknown as RawLlmInsight);
    }
  }

  if (validated.length === 0) {
    throw new Error('Khong co insight hop le nao trong phan hoi AI');
  }
  return validated;
}

/**
 * 22/09/2026: prompt YEU CAU JSON THUAN (khong phai 1 doan van tu do nhu ban thiet ke cu) - dan
 * ro rang schema tung truong + 1 vi du dinh dang. Nhac lai NHIEU LAN "KHONG duoc neu ten rieng"
 * trong headline/detail vi AI KHONG BIET ten that cua phong ban/du an (chi thay itemIndex an
 * danh) - frontend se tu resolve ten qua scopeId sau khi nhan phan hoi (cung quy uoc voi
 * ProjectProgress.projectId, xem StructuredInsight).
 */
function buildStructuredPrompt(range: string, candidates: Candidate[]): string {
  const rangeLabel = RANGE_LABELS[range] ?? range;
  const lines = candidates
    .map((c, index) => {
      const scopeLabel = c.scope === 'organization' ? 'toàn tổ chức' : c.scope === 'department' ? 'phòng ban' : 'dự án';
      return `[${index}] Phạm vi: ${scopeLabel} | Công việc tạo mới: ${c.totalTasksCreated} | Đã hoàn thành: ${c.totalTasksCompleted} | Tỷ lệ hoàn thành: ${c.completionRate}%`;
    })
    .join('\n');

  return `Bạn là hệ thống phân tích dữ liệu cho một nền tảng quản lý công việc dành cho doanh nghiệp vừa và nhỏ (SME). Dưới đây là các chỉ số ĐÃ TỔNG HỢP SẴN của nhiều phạm vi khác nhau (toàn tổ chức / từng phòng ban / từng dự án) trong khoảng "${rangeLabel}", mỗi phạm vi được đánh số [itemIndex].

NHIỆM VỤ: KHÔNG liệt kê hết - chỉ CHỌN RA 2 đến 4 mục ĐÁNG CHÚ Ý NHẤT (bất thường so với các mục còn lại, có rủi ro cần theo dõi, hoặc tích cực đáng ghi nhận).

Với MỖI mục được chọn, trả về một object JSON với ĐÚNG các trường sau, không thêm trường khác:
- "itemIndex": số nguyên, đúng bằng số [n] của mục trong danh sách dưới đây
- "severity": "critical" (cần hành động ngay) | "warning" (cần theo dõi) | "info" (điểm tích cực đáng ghi nhận)
- "metric": tên chỉ số ngắn gọn bằng tiếng Anh không dấu, ví dụ "completion_rate"
- "headline": MỘT câu tiếng Việt có dấu, dưới 20 từ. QUAN TRỌNG: bạn KHÔNG biết tên thật của phòng ban/dự án (chỉ thấy số thứ tự ẩn danh) - TUYỆT ĐỐI không nêu tên riêng hay số thứ tự, chỉ mô tả hiện tượng, ví dụ "Tỷ lệ hoàn thành công việc thấp hơn đáng kể so với phần còn lại của tổ chức"
- "detail": 1-2 câu tiếng Việt giải thích thêm, CHỈ dựa trên số liệu đã cho, không bịa thêm số liệu nào khác
- "recommendation": một câu gợi ý hành động bằng tiếng Việt, hoặc null nếu mục này không cần hành động gì (vd điểm tích cực đơn thuần)

Chỉ trả về DUY NHẤT một mảng JSON hợp lệ, KHÔNG kèm markdown code fence, KHÔNG kèm bất kỳ chữ giải thích nào khác. Ví dụ định dạng phản hồi:
[{"itemIndex":1,"severity":"warning","metric":"completion_rate","headline":"...","detail":"...","recommendation":"..."}]

Danh sách chỉ số:
${lines}`;
}
