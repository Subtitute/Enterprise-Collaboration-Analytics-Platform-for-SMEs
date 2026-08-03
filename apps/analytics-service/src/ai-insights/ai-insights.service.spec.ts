import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiInsightsService } from './ai-insights.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { RedisService } from '../redis/redis.service';

/**
 * Unit test cho AiInsightsService (tinh nang "Nhan xet AI", 28/07/2026). Mock ca 3 phuong thuc
 * cua AnalyticsService (khong goi TimescaleDB that) va mock `global.fetch` (khong goi Gemini API
 * that) - MAU THAM CHIEU: analytics.service.spec.ts (mock DataSource.query truc tiep, khong dung
 * NestJS TestingModule).
 */
describe('AiInsightsService', () => {
  let service: AiInsightsService;
  let analyticsServiceMock: {
    getSummary: jest.Mock;
    getTaskStatusBreakdown: jest.Mock;
    getProjectProgress: jest.Mock;
  };
  let redisServiceMock: { getJson: jest.Mock; setJson: jest.Mock };
  let configServiceMock: { get: jest.Mock };
  let fetchMock: jest.Mock;

  const SUMMARY = {
    totalTasksCreated: 10,
    totalTasksCompleted: 4,
    completionRate: 40,
    newDocumentsThisWeek: 2,
    activeUsersLast7Days: 3,
  };
  const BREAKDOWN = { TODO: 4, DOING: 2, DONE: 4 };
  const PROJECTS = [{ projectId: 'p-1', tasksCreated: 5, tasksCompleted: 2, completionRate: 40 }];

  beforeEach(() => {
    analyticsServiceMock = {
      getSummary: jest.fn().mockResolvedValue(SUMMARY),
      getTaskStatusBreakdown: jest.fn().mockResolvedValue(BREAKDOWN),
      getProjectProgress: jest.fn().mockResolvedValue(PROJECTS),
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
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'Nhan xet gia lap.' }] } }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    service = new AiInsightsService(
      analyticsServiceMock as unknown as AnalyticsService,
      redisServiceMock as unknown as RedisService,
      configServiceMock as unknown as ConfigService,
    );
  });

  it('tra ve ket qua da cache neu co, KHONG goi AnalyticsService/Gemini', async () => {
    const cached = { insight: 'Da cache tu truoc.', generatedAt: '2026-07-28T00:00:00.000Z' };
    redisServiceMock.getJson.mockResolvedValueOnce(cached);

    const result = await service.generateInsight('org-1', '7d');

    expect(result).toEqual(cached);
    expect(analyticsServiceMock.getSummary).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('nem ServiceUnavailableException neu chua cau hinh GEMINI_API_KEY, khong goi Gemini', async () => {
    configServiceMock.get.mockImplementation((key: string) => (key === 'gemini.model' ? 'gemini-2.5-flash' : undefined));

    await expect(service.generateInsight('org-1', '7d')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('goi ca 3 phuong thuc AnalyticsService voi dung organizationId/range/departmentId', async () => {
    await service.generateInsight('org-1', '30d', 'dept-1', 'Kinh doanh');

    expect(analyticsServiceMock.getSummary).toHaveBeenCalledWith('org-1', '30d', 'dept-1');
    expect(analyticsServiceMock.getTaskStatusBreakdown).toHaveBeenCalledWith('org-1', '30d', undefined, 'dept-1');
    expect(analyticsServiceMock.getProjectProgress).toHaveBeenCalledWith('org-1', '30d', 'dept-1');
  });

  it('goi Gemini API voi prompt co chua so lieu KPI va ten phong ban', async () => {
    await service.generateInsight('org-1', '7d', 'dept-1', 'Kinh doanh');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('gemini-2.5-flash');
    expect(url).toContain('key=fake-api-key');
    const body = JSON.parse((options as RequestInit).body as string);
    const prompt = body.contents[0].parts[0].text as string;
    expect(prompt).toContain('phòng ban "Kinh doanh"');
    expect(prompt).toContain('10');
    expect(prompt).toContain('40%');
  });

  it('tra ve dung text tu candidates[0].content.parts[0].text va ghi cache', async () => {
    const result = await service.generateInsight('org-1', '7d');

    expect(result.insight).toBe('Nhan xet gia lap.');
    expect(result.generatedAt).toEqual(expect.any(String));
    expect(redisServiceMock.setJson).toHaveBeenCalledWith(
      'analytics:ai-insight:org-1:7d',
      result,
      1800,
    );
  });

  it('dung key cache khac nhau khi co departmentId, khop dinh dang cua AnalyticsService.getSummary()', async () => {
    await service.generateInsight('org-1', '7d', 'dept-1');

    expect(redisServiceMock.setJson).toHaveBeenCalledWith(
      'analytics:ai-insight:org-1:7d:dept:dept-1',
      expect.anything(),
      1800,
    );
  });

  it('nem ServiceUnavailableException khi Gemini API tra ve HTTP loi (vd 429 rate-limit)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'Rate limit exceeded' });

    await expect(service.generateInsight('org-1', '7d')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(redisServiceMock.setJson).not.toHaveBeenCalled();
  });

  it('nem ServiceUnavailableException khi fetch that bai (loi mang/timeout)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network error'));

    await expect(service.generateInsight('org-1', '7d')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('nem ServiceUnavailableException khi Gemini tra ve phan hoi khong co noi dung (vd bi chan boi safety filter)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ candidates: [] }) });

    await expect(service.generateInsight('org-1', '7d')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('van tra ve ket qua binh thuong neu doc/ghi cache Redis loi (fail-open, giong AnalyticsService)', async () => {
    redisServiceMock.getJson.mockRejectedValueOnce(new Error('Redis timeout'));
    redisServiceMock.setJson.mockRejectedValueOnce(new Error('Redis timeout'));

    const result = await service.generateInsight('org-1', '7d');

    expect(result.insight).toBe('Nhan xet gia lap.');
  });
});
