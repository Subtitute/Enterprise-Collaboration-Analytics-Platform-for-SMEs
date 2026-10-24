// 24/10/2026 (fix kiem thu RAG): unit test client nhung Gemini (gemini-embedding.service.ts) - mock
// global fetch, khong goi API that. Khoa lai: cau hoi tim kiem KHONG cho 429; loi duoc phan loai cap
// dich vu (indexer dua vao do de tam dung ca vong); API key khong lot vao thong diep loi.
import { EMBEDDING_DIMENSIONS, GeminiEmbeddingError, GeminiEmbeddingService } from './gemini-embedding.service';

const API_KEY = 'AIza-test-secret-key';

function buildService(apiKey: string | undefined = API_KEY) {
  const config = { get: jest.fn((key: string) => (key === 'gemini.apiKey' ? apiKey : 'gemini-embedding-001')) };
  return new GeminiEmbeddingService(config as never);
}

function mockFetch(...responses: { status: number; body: unknown }[]) {
  const fetchMock = jest.fn();
  for (const r of responses) {
    fetchMock.mockResolvedValueOnce({
      status: r.status,
      text: () => Promise.resolve(typeof r.body === 'string' ? r.body : JSON.stringify(r.body)),
    });
  }
  global.fetch = fetchMock as never;
  return fetchMock;
}

const okBody = (n: number) => ({ embeddings: Array.from({ length: n }, () => ({ values: Array(EMBEDDING_DIMENSIONS).fill(1) })) });
const rateLimited = { status: 429, body: { error: { code: 429, details: [{ retryDelay: '0s' }] } } };

async function captureError(promise: Promise<unknown>): Promise<GeminiEmbeddingError> {
  try {
    await promise;
  } catch (err) {
    return err as GeminiEmbeddingError;
  }
  throw new Error('expected rejection');
}

describe('GeminiEmbeddingService', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('embedQuery: 429 -> bao loi NGAY (khong cho/goi lai), loi cap dich vu', async () => {
    const fetchMock = mockFetch(rateLimited, { status: 200, body: okBody(1) });
    const err = await captureError(buildService().embedQuery('phong hop tang 5'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(err).toBeInstanceOf(GeminiEmbeddingError);
    expect(err.serviceLevel).toBe(true);
  });

  it('embedDocuments: 429 -> cho retryDelay roi thu lai dung 1 lan', async () => {
    const fetchMock = mockFetch(rateLimited, { status: 200, body: okBody(2) });
    const vectors = await buildService().embedDocuments(['doan 1', 'doan 2'], 'quy-dinh.txt');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vectors).toHaveLength(2);
    expect(vectors[0][0]).toBeCloseTo(1 / Math.sqrt(EMBEDDING_DIMENSIONS));
  });

  it('API key sai (Google tra 400 API_KEY_INVALID) -> loi cap dich vu, KHONG lo key trong thong diep', async () => {
    mockFetch({ status: 400, body: { error: { message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } } });
    const err = await captureError(buildService().embedQuery('xin chao'));

    expect(err.serviceLevel).toBe(true);
    expect(err.message).not.toContain(API_KEY);
  });

  it('400 khac (noi dung request) -> KHONG phai loi cap dich vu', async () => {
    mockFetch({ status: 400, body: { error: { message: 'Request payload size exceeds the limit', status: 'INVALID_ARGUMENT' } } });
    const err = await captureError(buildService().embedDocuments(['x'], 'a.txt'));
    expect(err.serviceLevel).toBe(false);
  });

  it('mat mang/timeout -> loi cap dich vu; key gui qua header, khong qua URL', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('fetch failed'));
    global.fetch = fetchMock as never;
    const err = await captureError(buildService().embedQuery('xin chao'));

    expect(err.serviceLevel).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).not.toContain(API_KEY);
    expect(init.headers['x-goog-api-key']).toBe(API_KEY);
  });
});
