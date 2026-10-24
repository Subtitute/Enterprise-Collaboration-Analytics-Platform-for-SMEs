/**
 * 24/10/2026: POST JSON co timeout (AbortController) qua `fetch` co san cua Node 20 - cung cach goi
 * REST truc tiep (khong them SDK) nhu callGemini()/callGroq() cua AiInsightsService. Timer chi duoc
 * huy SAU KHI doc xong body (1 phan hoi "treo" giua chung luc doc body van bi cat dung han). Nem Error
 * thuong (khong phai HttpException) de ChatbotAgentService bat va chuyen sang nha cung cap du phong.
 */
export async function postJsonWithTimeout<T>(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let status: number;
  let text: string;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    status = response.status;
    text = await response.text();
  } catch (err) {
    throw new Error(`Goi ${label} API that bai (mang/timeout ${timeoutMs}ms): ${(err as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }
  if (status < 200 || status >= 300) {
    throw new Error(`${label} API tra ve loi HTTP ${status}: ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${label} API tra ve phan hoi khong phai JSON: ${text.slice(0, 200)}`);
  }
}
