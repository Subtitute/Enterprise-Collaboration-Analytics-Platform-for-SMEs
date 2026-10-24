import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { l2Normalize } from './utils/vector.util';

// 24/10/2026: so chieu vector - khop cot `embedding real[]` (DocumentChunk). Doi so nay = phai index lai
// TOAN BO tai lieu (vector cu khac so chieu se bi cosineSimilarity() coi la 0 diem).
export const EMBEDDING_DIMENSIONS = 768;
const EMBEDDING_TIMEOUT_MS = 15_000;
// 24/10/2026 (fix kiem thu RAG): cau hoi tim kiem nam tren duong dong bo cua Chat bot - analytics-service
// chi cho moi tool call 10s (TOOL_CALL_TIMEOUT_MS) - nen timeout rieng ngan hon han va KHONG cho 429
// (truoc day cho toi 60s roi goi lai: Chat bot da bo cuoc tu lau, lan goi lai chi dot them han ngach).
const QUERY_TIMEOUT_MS = 8_000;
// batchEmbedContents cho toi da 100 request/lan - giu nho hon nhieu de 1 lan goi khong "an" qua
// nhieu han ngach token/phut cua free tier.
const EMBEDDING_BATCH_SIZE = 20;
// Nghi giua 2 batch cua CUNG 1 file - han ngach free tier tinh theo phut, nghi ngan giup 1 file
// lon khong dot ngot vuot tran va de "danh" cho cau hoi tim kiem cua nguoi dung (dung chung han ngach).
const PAUSE_BETWEEN_BATCHES_MS = 1_500;
const MAX_RATE_LIMIT_WAIT_MS = 60_000;

type EmbeddingTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

/**
 * 24/10/2026 (fix kiem thu RAG): loi tu Gemini API. `serviceLevel` = loi cua CA dich vu (het han ngach
 * 429, key sai/bi chan, Google 5xx, mat mang/timeout) - moi file deu se that bai nhu nhau, nen
 * DocumentIndexerService tam dung CA vong index thay vi lan luot "thu" tung file (truoc day: key sai
 * hoac het han ngach ngay -> moi 10s van goi API cho 3 file moi, lap qua toan bo kho tai lieu).
 */
export class GeminiEmbeddingError extends Error {
  constructor(
    message: string,
    readonly serviceLevel: boolean,
  ) {
    super(message);
    this.name = 'GeminiEmbeddingError';
  }
}

function isServiceLevelStatus(status: number, body: string): boolean {
  if (status === 429 || status === 401 || status === 403 || status >= 500) return true;
  // Google tra 400 (khong phai 401) cho API key sai.
  return status === 400 && /API_KEY_INVALID|API key not valid/i.test(body);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Doc "retryDelay" (vd "23s") tu loi 429 cua Google API (google.rpc.RetryInfo) - mac dinh 20s. */
function parseRetryDelayMs(body: string): number {
  const match = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(body);
  const ms = match ? Math.ceil(parseFloat(match[1]) * 1000) : 20_000;
  return Math.min(ms, MAX_RATE_LIMIT_WAIT_MS);
}

/**
 * 24/10/2026: client nhung van ban qua Gemini REST API (fetch co san cua Node 20 - khong them SDK,
 * mirror cach analytics-service goi Gemini cho "Nhan xet AI"). Gui API key qua header
 * `x-goog-api-key` thay vi query string `?key=` de key khong bao gio lot vao log URL/loi.
 *
 * Moi vector tra ve DA chuan hoa L2 (xem vector.util.ts). Loi 429 (vuot han ngach) duoc cho DUNG
 * thoi gian Google goi y (toi da 60s) roi thu lai DUNG 1 lan - CHI khi index tai lieu (chay nen); cau
 * hoi tim kiem bao loi ngay (xem QUERY_TIMEOUT_MS); loi khac nem thang cho noi goi xu ly
 * (indexer: ghi log + lui lich thu lai; search: tra 503 ro rang).
 */
@Injectable()
export class GeminiEmbeddingService {
  private readonly logger = new Logger(GeminiEmbeddingService.name);

  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    return !!this.configService.get<string>('gemini.apiKey');
  }

  async embedQuery(text: string): Promise<number[]> {
    const [vector] = await this.embedBatch([text], 'RETRIEVAL_QUERY', undefined, { waitOnRateLimit: false, timeoutMs: QUERY_TIMEOUT_MS });
    return vector;
  }

  /** `title` (ten file) giup model hieu ngu canh doan van - tham so chinh thuc cua RETRIEVAL_DOCUMENT. */
  async embedDocuments(texts: string[], title: string): Promise<number[][]> {
    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
      if (i > 0) await sleep(PAUSE_BETWEEN_BATCHES_MS);
      vectors.push(
        ...(await this.embedBatch(texts.slice(i, i + EMBEDDING_BATCH_SIZE), 'RETRIEVAL_DOCUMENT', title, {
          waitOnRateLimit: true,
          timeoutMs: EMBEDDING_TIMEOUT_MS,
        })),
      );
    }
    return vectors;
  }

  private async embedBatch(
    texts: string[],
    taskType: EmbeddingTaskType,
    title: string | undefined,
    options: { waitOnRateLimit: boolean; timeoutMs: number },
  ): Promise<number[][]> {
    const apiKey = this.configService.get<string>('gemini.apiKey');
    if (!apiKey) throw new GeminiEmbeddingError('GEMINI_API_KEY chua duoc cau hinh - RAG dang tat', true);
    const model = this.configService.get<string>('gemini.embeddingModel');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents`;
    const body = JSON.stringify({
      requests: texts.map((text) => ({
        model: `models/${model}`,
        content: { parts: [{ text }] },
        taskType,
        ...(title && taskType === 'RETRIEVAL_DOCUMENT' ? { title } : {}),
        outputDimensionality: EMBEDDING_DIMENSIONS,
      })),
    });

    for (let attempt = 0; ; attempt++) {
      const response = await this.post(url, apiKey, body, options.timeoutMs);
      if (response.status === 429 && attempt === 0 && options.waitOnRateLimit) {
        const waitMs = parseRetryDelayMs(response.body);
        this.logger.warn(`Gemini embedding vuot han ngach (429) - cho ${waitMs}ms roi thu lai 1 lan`);
        await sleep(waitMs);
        continue;
      }
      if (response.status !== 200) {
        throw new GeminiEmbeddingError(
          `Gemini embedding API tra ve loi HTTP ${response.status}: ${response.body.slice(0, 300)}`,
          isServiceLevelStatus(response.status, response.body),
        );
      }
      const data = JSON.parse(response.body) as { embeddings?: { values?: number[] }[] };
      const vectors = (data.embeddings ?? []).map((e) => e.values ?? []);
      if (vectors.length !== texts.length || vectors.some((v) => v.length !== EMBEDDING_DIMENSIONS)) {
        throw new Error(`Gemini embedding API tra ve ${vectors.length}/${texts.length} vector khong hop le`);
      }
      return vectors.map(l2Normalize);
    }
  }

  private async post(url: string, apiKey: string, body: string, timeoutMs: number): Promise<{ status: number; body: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body,
        signal: controller.signal,
      });
      return { status: response.status, body: await response.text() };
    } catch (err) {
      throw new GeminiEmbeddingError(`Goi Gemini embedding API that bai (mang/timeout): ${(err as Error).message}`, true);
    } finally {
      clearTimeout(timeout);
    }
  }
}
