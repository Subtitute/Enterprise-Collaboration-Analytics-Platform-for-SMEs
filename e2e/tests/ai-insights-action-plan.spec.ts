import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

// 24/09/2026: Layer 5 Recommendation Engine - kiem tra TRUC TIEP POST /analytics/ai-insights kem
// du lieu bat thuong TONG HOP (khong phu thuoc vao viec mo hinh IsolationForest CO flag duoc ai
// hay khong tren du lieu demo hien tai - xem ml-anomalies.spec.ts, ket qua do phu thuoc du lieu va
// khong on dinh de assert cung 1 lan chay) - dung 1 truong hop bat thuong TU TAO de dam bao prompt
// LUON co boi canh, roi xac nhan dung hop dong du lieu tra ve (actionPlan la null HOAC 1 object
// dung dinh dang), khong assert AI CHAC CHAN phai gan actionPlan cho MOI insight (do la lua chon
// cua AI, khong phai bat buoc - xem buildAnomalyContext() ben backend).
test('POST /analytics/ai-insights kem du lieu bat thuong tra ve dung hop dong actionPlan', async ({ page }) => {
  test.setTimeout(60_000); // goi Gemini/Groq that co the mat vai giay.
  await loginAsAdmin(page);

  const token = await page.evaluate(() => {
    const raw = localStorage.getItem('ecap-auth');
    if (!raw) return null;
    return (JSON.parse(raw)?.state?.accessToken as string | undefined) ?? null;
  });
  expect(token).toBeTruthy();
  const authHeaders = { Authorization: `Bearer ${token}` };

  const syntheticAnomalies = [
    {
      metrics: { totalTasks: 10, completionRate: 35, overdueTasks: 6, attendanceRate: 58 },
      topDeviation: { metric: 'attendanceRate', value: 58, teamAverage: 93, direction: 'down' },
    },
  ];

  const res = await page.request.post('/api/v1/analytics/ai-insights', {
    data: { range: '30d', anomalies: syntheticAnomalies },
    headers: authHeaders,
  });
  expect(res.ok()).toBe(true);
  const body = await res.json();

  expect(body.range).toBe('30d');
  expect(Array.isArray(body.insights)).toBe(true);
  expect(body.insights.length).toBeGreaterThan(0);

  for (const insight of body.insights) {
    // actionPlan la TUY CHON tren TUNG insight (xem StructuredInsight.actionPlan) - hop le la
    // null HOAC 1 object dung du 5 truong.
    expect(insight).toHaveProperty('actionPlan');
    if (insight.actionPlan !== null) {
      expect(typeof insight.actionPlan.action).toBe('string');
      expect(['high', 'medium', 'low']).toContain(insight.actionPlan.priority);
      expect(typeof insight.actionPlan.reason).toBe('string');
      expect(typeof insight.actionPlan.expectedEffect).toBe('string');
      expect(typeof insight.actionPlan.effort).toBe('string');
    }
  }
});

// 24/09/2026: xac nhan GET cu (khong kem anomalies) KHONG doi hanh vi - actionPlan luon null, dung
// tinh than "backward compatible 100%" da ghi trong generateInsights()/fetchAiInsights().
test('GET /analytics/ai-insights (khong kem du lieu bat thuong) luon co actionPlan la null', async ({ page }) => {
  test.setTimeout(30_000);
  await loginAsAdmin(page);

  const token = await page.evaluate(() => {
    const raw = localStorage.getItem('ecap-auth');
    if (!raw) return null;
    return (JSON.parse(raw)?.state?.accessToken as string | undefined) ?? null;
  });
  expect(token).toBeTruthy();

  const res = await page.request.get('/api/v1/analytics/ai-insights', {
    params: { range: '30d' },
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok()).toBe(true);
  const body = await res.json();

  for (const insight of body.insights) {
    expect(insight.actionPlan).toBeNull();
  }
});
