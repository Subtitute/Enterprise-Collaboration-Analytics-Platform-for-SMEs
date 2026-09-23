import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiInsightsService } from './ai-insights.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { RedisService } from '../redis/redis.service';

/**
 * 22/09/2026: rewrite hoan toan cho thiet ke moi (INSIGHT CO CAU TRUC thay vi 1 doan van tu do -
 * xem chu thich dau file ai-insights.service.ts). Mock 4 phuong thuc AnalyticsService (khong goi
 * TimescaleDB that) va mock `global.fetch` (khong goi Gemini/Groq API that) - mau tham chieu:
 * analytics.service.spec.ts.
 */
describe('AiInsightsService', () => {
  let service: AiInsightsService;
  let analyticsServiceMock: {
    getSummary: jest.Mock;
    getProjectProgress: jest.Mock;
    listActiveDepartmentIds: jest.Mock;
  };
  let redisServiceMock: { getJson: jest.Mock; setJson: jest.Mock };
  let configServiceMock: { get: jest.Mock };
  let fetchMock: jest.Mock;

  const ORG_SUMMARY = { totalTasksCreated: 40, totalTasksCompleted: 28, completionRate: 70, newDocumentsThisWeek: 2, activeUsersLast7Days: 10 };
  const DEPT_SUMMARY_LOW = { totalTasksCreated: 10, totalTasksCompleted: 2, completionRate: 20, newDocumentsThisWeek: 0, activeUsersLast7Days: 2 };
  const DEPT_SUMMARY_EMPTY = { totalTasksCreated: 0, totalTasksCompleted: 0, completionRate: 0, newDocumentsThisWeek: 0, activeUsersLast7Days: 0 };
  const PROJECTS = [{ projectId: 'p-1', tasksCreated: 8, tasksCompleted: 6, completionRate: 75 }];

  function geminiResponse(jsonText: string) {
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: jsonText }] } }] }) };
  }
  function groqResponse(jsonText: string) {
    return { ok: true, json: async () => ({ choices: [{ message: { content: jsonText } }] }) };
  }

  const VALID_INSIGHT_JSON = JSON.stringify([
    { itemIndex: 1, severity: 'warning', metric: 'completion_rate', headline: 'Tỷ lệ hoàn thành thấp hơn đáng kể.', detail: 'Chi tiết.', recommendation: 'Xem lại phân bổ nhân sự.' },
  ]);

  beforeEach(() => {
    analyticsServiceMock = {
      getSummary: jest.fn().mockImplementation((_org: string, _range: string, departmentId?: string) => {
        if (departmentId === 'dept-empty') return Promise.resolve(DEPT_SUMMARY_EMPTY);
        if (departmentId) return Promise.resolve(DEPT_SUMMARY_LOW);
        return Promise.resolve(ORG_SUMMARY);
      }),
      getProjectProgress: jest.fn().mockResolvedValue(PROJECTS),
      listActiveDepartmentIds: jest.fn().mockResolvedValue(['dept-1']),
    };
    redisServiceMock = {
      getJson: jest.fn().mockResolvedValue(null),
      setJson: jest.fn().mockResolvedValue(undefined),
    };
    configServiceMock = {
      get: jest.fn((key: string) => {
        if (key === 'gemini.apiKey') return 'fake-api-key';
        if (key === 'gemini.model') return 'gemini-2.5-flash';
        return undefined;
      }),
    };
    fetchMock = jest.fn().mockResolvedValue(geminiResponse(VALID_INSIGHT_JSON));
    global.fetch = fetchMock as unknown as typeof fetch;

    service = new AiInsightsService(
      analyticsServiceMock as unknown as AnalyticsService,
      redisServiceMock as unknown as RedisService,
      configServiceMock as unknown as ConfigService,
    );
  });

  it('tra ve ket qua da cache neu co, KHONG goi AnalyticsService/Gemini', async () => {
    const cached = { range: '7d', generatedAt: '2026-09-22T00:00:00.000Z', insights: [] };
    redisServiceMock.getJson.mockResolvedValueOnce(cached);

    const result = await service.generateInsights('org-1', '7d');

    expect(result).toEqual(cached);
    expect(analyticsServiceMock.getSummary).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('nem ServiceUnavailableException neu chua cau hinh GEMINI_API_KEY lan GROQ_API_KEY', async () => {
    configServiceMock.get.mockImplementation((key: string) => (key === 'gemini.model' ? 'gemini-2.5-flash' : undefined));

    await expect(service.generateInsights('org-1', '7d')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('quet toan to chuc + phong ban dang hoat dong + top du an, bo qua phong ban rong (0 task)', async () => {
    analyticsServiceMock.listActiveDepartmentIds.mockResolvedValueOnce(['dept-1', 'dept-empty']);

    await service.generateInsights('org-1', '7d');

    const prompt = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string).contents[0].parts[0].text as string;
    // [0] to chuc, [1] dept-1 (co hoat dong), [2] du an p-1 - dept-empty KHONG xuat hien vi 0 task.
    expect(prompt).toContain('[0] Phạm vi: toàn tổ chức');
    expect(prompt).toContain('[1] Phạm vi: phòng ban');
    expect(prompt).toContain('[2] Phạm vi: dự án');
    expect(prompt).not.toContain('[3]');
  });

  it('gan scope/scopeId/evidence TU DU LIEU THAT cua candidate (khong lay so lieu tu AI) khi map itemIndex thanh cong', async () => {
    const result = await service.generateInsights('org-1', '7d');

    expect(result.insights).toHaveLength(1);
    expect(result.insights[0]).toMatchObject({
      scope: 'department',
      scopeId: 'dept-1',
      severity: 'warning',
      headline: 'Tỷ lệ hoàn thành thấp hơn đáng kể.',
      evidence: { value: 20, comparisonValue: 70, unit: 'percent' },
    });
  });

  it('bo qua muc co itemIndex khong hop le (AI "bia" so vuot qua danh sach candidate) thay vi crash toan bo', async () => {
    fetchMock.mockResolvedValueOnce(
      geminiResponse(
        JSON.stringify([
          { itemIndex: 99, severity: 'warning', metric: 'x', headline: 'Muc khong ton tai.', detail: 'x', recommendation: null },
          { itemIndex: 1, severity: 'info', metric: 'completion_rate', headline: 'Hop le.', detail: 'x', recommendation: null },
        ]),
      ),
    );

    const result = await service.generateInsights('org-1', '7d');

    expect(result.insights).toHaveLength(1);
    expect(result.insights[0].headline).toBe('Hop le.');
  });

  it('boc tach markdown code fence (```json ... ```) truoc khi parse JSON', async () => {
    fetchMock.mockResolvedValueOnce(geminiResponse('```json\n' + VALID_INSIGHT_JSON + '\n```'));

    const result = await service.generateInsights('org-1', '7d');

    expect(result.insights).toHaveLength(1);
  });

  it('rot xuong Groq du phong khi Gemini tra ve JSON KHONG hop le (200 OK nhung sai dinh dang)', async () => {
    configServiceMock.get.mockImplementation((key: string) => {
      if (key === 'gemini.apiKey') return 'fake-gemini-key';
      if (key === 'gemini.model') return 'gemini-2.5-flash';
      if (key === 'groq.apiKey') return 'fake-groq-key';
      if (key === 'groq.model') return 'openai/gpt-oss-120b';
      return undefined;
    });
    fetchMock
      .mockResolvedValueOnce(geminiResponse('day khong phai JSON hop le'))
      .mockResolvedValueOnce(groqResponse(VALID_INSIGHT_JSON));

    const result = await service.generateInsights('org-1', '7d');

    expect(result.insights).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rot xuong Groq du phong khi Gemini loi HTTP (vd 503 qua tai)', async () => {
    configServiceMock.get.mockImplementation((key: string) => {
      if (key === 'gemini.apiKey') return 'fake-gemini-key';
      if (key === 'gemini.model') return 'gemini-2.5-flash';
      if (key === 'groq.apiKey') return 'fake-groq-key';
      if (key === 'groq.model') return 'openai/gpt-oss-120b';
      return undefined;
    });
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'Gemini qua tai' })
      .mockResolvedValueOnce(groqResponse(VALID_INSIGHT_JSON));

    const result = await service.generateInsights('org-1', '7d');

    expect(result.insights).toHaveLength(1);
    const [groqUrl, groqOptions] = fetchMock.mock.calls[1];
    expect(groqUrl).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect((groqOptions as RequestInit).headers).toMatchObject({ Authorization: 'Bearer fake-groq-key' });
  });

  it('nem ServiceUnavailableException khi CA Gemini lan Groq deu that bai/tra ve JSON vo hieu', async () => {
    configServiceMock.get.mockImplementation((key: string) => {
      if (key === 'gemini.apiKey') return 'fake-gemini-key';
      if (key === 'gemini.model') return 'gemini-2.5-flash';
      if (key === 'groq.apiKey') return 'fake-groq-key';
      if (key === 'groq.model') return 'openai/gpt-oss-120b';
      return undefined;
    });
    fetchMock.mockResolvedValueOnce(geminiResponse('[]')).mockResolvedValueOnce(groqResponse('khong phai JSON'));

    await expect(service.generateInsights('org-1', '7d')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('tra ve candidates[] day du (moi pham vi da quet) - khong chi cac muc duoc AI chon lam insight', async () => {
    const result = await service.generateInsights('org-1', '7d');

    // [0] to chuc, [1] dept-1, [2] du an p-1 - ca 3 deu co mat trong candidates du chi 1 (dept-1)
    // duoc chon lam insight (xem VALID_INSIGHT_JSON, itemIndex=1).
    expect(result.candidates).toEqual([
      { scope: 'organization', scopeId: null, completionRate: 70 },
      { scope: 'department', scopeId: 'dept-1', completionRate: 20 },
      { scope: 'project', scopeId: 'p-1', completionRate: 75 },
    ]);
  });

  it('ghi cache voi key/TTL dung sau khi tao thanh cong', async () => {
    const result = await service.generateInsights('org-1', '7d');

    expect(redisServiceMock.setJson).toHaveBeenCalledWith('analytics:ai-insights:org-1:7d', result, 1800);
  });

  it('van tra ve ket qua binh thuong neu doc/ghi cache Redis loi (fail-open, giong AnalyticsService)', async () => {
    redisServiceMock.getJson.mockRejectedValueOnce(new Error('Redis timeout'));
    redisServiceMock.setJson.mockRejectedValueOnce(new Error('Redis timeout'));

    const result = await service.generateInsights('org-1', '7d');

    expect(result.insights).toHaveLength(1);
  });

  it('goi thang Groq, KHONG goi Gemini, khi chi cau hinh GROQ_API_KEY', async () => {
    configServiceMock.get.mockImplementation((key: string) => {
      if (key === 'groq.apiKey') return 'fake-groq-key';
      if (key === 'groq.model') return 'openai/gpt-oss-120b';
      return undefined;
    });
    fetchMock.mockResolvedValueOnce(groqResponse(VALID_INSIGHT_JSON));

    const result = await service.generateInsights('org-1', '7d');

    expect(result.insights).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
