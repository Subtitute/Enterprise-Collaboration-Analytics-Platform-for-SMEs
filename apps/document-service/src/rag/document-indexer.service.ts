import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DocumentChunk } from '../entities/document-chunk.entity';
import { MinioService } from '../minio/minio.service';
import { GeminiEmbeddingError, GeminiEmbeddingService } from './gemini-embedding.service';
import { CHUNK_SIZE, chunkText } from './utils/chunking.util';
import { extractText, isIndexableMimeType } from './utils/text-extraction.util';

const INDEX_POLL_INTERVAL_MS = 10_000;
// So file toi da xu ly trong 1 lan quet - xu ly TUAN TU (khong song song) de ton trong han ngach
// free tier cua Gemini embedding API (dung chung voi cau hoi tim kiem cua nguoi dung).
const FILES_PER_TICK = 3;
// Tran an toan bo nho/chi phi: file lon hon (toi da 25MB - MAX_UPLOAD_SIZE_BYTES) van luu/tai binh
// thuong, chi khong duoc index. 100 doan x ~800 ky tu ~ 80.000 ky tu (~30 trang van ban) - phan sau
// do cua 1 tai lieu rat dai bi bo qua (gioi han da biet).
export const MAX_INDEXABLE_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_CHUNKS_PER_FILE = 100;
// 24/10/2026 (fix kiem thu RAG): chi trich toi da chung nay ky tu (du cho MAX_CHUNKS_PER_FILE doan, du
// 50% cho phan khoang trang bi gop khi chuan hoa) - xem extractText() ve ly do bo nho.
export const MAX_EXTRACTED_CHARS = Math.ceil(MAX_CHUNKS_PER_FILE * CHUNK_SIZE * 1.5);
// File index loi (Gemini qua tai/het han ngach, MinIO tam mat...) tam bo qua 10 phut thay vi thu lai
// moi 10s; danh sach nay chi nam trong bo nho - restart service la thu lai ngay (chap nhan duoc).
const FAILURE_BACKOFF_MS = 10 * 60_000;
// 24/10/2026 (fix kiem thu RAG): loi cap DICH VU cua Gemini (GeminiEmbeddingError.serviceLevel: het han
// ngach, key sai, 5xx, mat mang) -> tam dung CA vong index, tang gap doi moi lan lien tiep (1 -> 2 -> 4
// ... toi da 30 phut), ve 0 khi co 1 file index thanh cong. Truoc day chi lui lich TUNG file nen key
// sai/het han ngach ngay van goi API cho 3 file moi moi 10s, lan luot qua toan bo kho tai lieu.
const SERVICE_PAUSE_BASE_MS = 60_000;
const SERVICE_PAUSE_MAX_MS = 30 * 60_000;

export interface PendingFile {
  id: string;
  organizationId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: string | number;
  objectKey: string;
  currentVersion: number;
  /** 24/10/2026: xem FileMeta.ragExtractAttemptVersion. */
  extractAttemptVersion?: number | null;
}

/**
 * 24/10/2026: index tai lieu cho RAG (Chat bot noi bo, Technical_Spec.md muc 23) - quet DINH KY (mirror
 * OutboxPublisherJob: @Interval + co `isRunning` chong chay chong) moi FileMeta co `rag_indexed_version`
 * lech `current_version` roi: tai noi dung tu MinIO -> trich van ban -> chia doan -> nhung (Gemini) ->
 * thay the TOAN BO chunk cu cua file.
 *
 * Vi sao quet dinh ky thay vi goi ngay trong FilesService.upload(): (1) upload KHONG BAO GIO bi chan
 * hay that bai vi RAG (chi doc du lieu da COMMIT, chay nen, loi chi ghi log); (2) CUNG 1 co che phuc
 * vu ca file moi, phien ban moi (uploadNewVersion doi currentVersion) LAN backfill file demo co san
 * (cot moi = NULL) - khong can buoc "re-upload" hay script rieng; (3) FilesService/FilesController
 * giu nguyen, khong phu thuoc nguoc vao module RAG. Danh doi: do tre toi da ~10s + thoi gian xu ly.
 */
@Injectable()
export class DocumentIndexerService {
  private readonly logger = new Logger(DocumentIndexerService.name);
  private isRunning = false;
  private readonly retryAfter = new Map<string, number>();
  private pausedUntil = 0;
  private consecutiveServiceFailures = 0;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly minioService: MinioService,
    private readonly embeddingService: GeminiEmbeddingService,
  ) {}

  @Interval(INDEX_POLL_INTERVAL_MS)
  async indexPendingFiles(): Promise<void> {
    if (this.isRunning || !this.embeddingService.isEnabled() || Date.now() < this.pausedUntil) return;
    this.isRunning = true;
    try {
      const now = Date.now();
      for (const [fileId, until] of this.retryAfter) {
        if (until <= now) this.retryAfter.delete(fileId);
      }
      const pending = await this.findPendingFiles([...this.retryAfter.keys()]);
      for (const file of pending) {
        try {
          const chunkCount = await this.indexFile(file);
          if (chunkCount !== null && chunkCount > 0) this.consecutiveServiceFailures = 0;
          if (chunkCount === null) {
            this.logger.log(`Bo qua ket qua index file ${file.id}: file da doi phien ban/bi xoa trong luc xu ly`);
          } else {
            this.logger.log(`Da index file ${file.id} v${file.currentVersion} (${chunkCount} doan van ban)`);
          }
        } catch (err) {
          if (err instanceof GeminiEmbeddingError && err.serviceLevel) {
            this.consecutiveServiceFailures++;
            const pauseMs = Math.min(SERVICE_PAUSE_BASE_MS * 2 ** (this.consecutiveServiceFailures - 1), SERVICE_PAUSE_MAX_MS);
            this.pausedUntil = Date.now() + pauseMs;
            this.logger.warn(`Gemini embedding tam thoi khong dung duoc - tam dung index ${pauseMs / 1000}s: ${err.message}`);
            break;
          }
          this.retryAfter.set(file.id, Date.now() + FAILURE_BACKOFF_MS);
          this.logger.warn(`Index file ${file.id} that bai, thu lai sau ${FAILURE_BACKOFF_MS / 60_000} phut: ${(err as Error).message}`);
        }
      }
    } catch (err) {
      this.logger.error(`Loi khi quet file can index: ${(err as Error).message}`);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * So doan da ghi (0 = loai file khong ho tro/qua lon/khong co chu - van danh dau DA index de khong
   * quet lai mai), hoac null neu ket qua bi bo vi file da doi phien ban/bi xoa trong luc xu ly.
   */
  async indexFile(file: PendingFile): Promise<number | null> {
    let chunks: string[] = [];
    const indexable = isIndexableMimeType(file.mimeType) && Number(file.sizeBytes) <= MAX_INDEXABLE_FILE_BYTES;
    if (indexable && file.extractAttemptVersion === file.currentVersion) {
      this.logger.warn(`Lan trich van ban truoc cua file ${file.id} v${file.currentVersion} khong ket thuc (process bi dung giua chung) - bo qua noi dung`);
    } else if (indexable) {
      chunks = await this.extractChunks(file);
    }
    const embeddings = chunks.length > 0 ? await this.embeddingService.embedDocuments(chunks, file.fileName) : [];
    const applied = await this.replaceChunks(file, chunks, embeddings);
    return applied ? chunks.length : null;
  }

  /**
   * 24/10/2026: tai noi dung + trich van ban + chia doan, boc bang co "dang trich" (xem
   * FileMeta.ragExtractAttemptVersion): dat SAU khi tai xong (loi/restart luc tai khong bi tinh), xoa
   * trong `finally` - chi con sot lai khi process chet ngay trong luc trich.
   */
  private async extractChunks(file: PendingFile): Promise<string[]> {
    const buffer = await this.minioService.getObjectBuffer(file.objectKey, MAX_INDEXABLE_FILE_BYTES);
    await this.setExtractAttempt(file.id, file.currentVersion);
    try {
      let text: string | null = null;
      try {
        text = await extractText(buffer, file.mimeType, MAX_EXTRACTED_CHARS);
      } catch (err) {
        // 24/10/2026 (fix kiem thu RAG): PDF/DOCX hong la loi VINH VIEN cua phien ban nay - danh dau da
        // index (0 doan) thay vi lui lich thu lai: truoc day file hong bi tai + phan tich lai moi 10
        // phut (va ngay moi lan restart service) mai mai. Loi MinIO/Gemini van nem ra de thu lai.
        this.logger.warn(`Khong trich duoc van ban file ${file.id} (bo qua, khong index): ${(err as Error).message}`);
      }
      return chunkText(text ?? '').slice(0, MAX_CHUNKS_PER_FILE);
    } finally {
      await this.setExtractAttempt(file.id, null);
    }
  }

  private async setExtractAttempt(fileId: string, version: number | null): Promise<void> {
    await this.dataSource.query('UPDATE file_metas SET rag_extract_attempt_version = $1 WHERE id = $2', [version, fileId]);
  }

  private findPendingFiles(excludedIds: string[]): Promise<PendingFile[]> {
    return this.dataSource.query(
      `SELECT id, organization_id AS "organizationId", file_name AS "fileName", mime_type AS "mimeType",
              size_bytes AS "sizeBytes", object_key AS "objectKey", current_version AS "currentVersion",
              rag_extract_attempt_version AS "extractAttemptVersion"
         FROM file_metas
        WHERE rag_indexed_version IS DISTINCT FROM current_version
          AND NOT (id = ANY($1::uuid[]))
        ORDER BY updated_at DESC
        LIMIT $2`,
      [excludedIds, FILES_PER_TICK],
    );
  }

  /**
   * Thay the chunk + danh dau phien ban da index trong 1 transaction, KHOA dong FileMeta (FOR UPDATE -
   * cung kieu khoa voi FilesService.uploadNewVersion()) va chi ghi neu currentVersion VAN la phien ban
   * vua xu ly: neu nguoi dung tai phien ban moi trong luc dang nhung, ket qua cu bi bo (lan quet sau
   * se index phien ban moi) thay vi ghi de chunk sai phien ban.
   */
  private replaceChunks(file: PendingFile, chunks: string[], embeddings: number[][]): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const rows: { current_version: number }[] = await manager.query(
        'SELECT current_version FROM file_metas WHERE id = $1 FOR UPDATE',
        [file.id],
      );
      if (rows.length === 0 || rows[0].current_version !== file.currentVersion) return false;

      await manager.delete(DocumentChunk, { fileId: file.id });
      if (chunks.length > 0) {
        await manager.insert(
          DocumentChunk,
          chunks.map((content, chunkIndex) => ({
            organizationId: file.organizationId,
            fileId: file.id,
            chunkIndex,
            content,
            embedding: embeddings[chunkIndex],
          })),
        );
      }
      // SQL tho (khong qua save()) de KHONG cap nhat updated_at - xem chu thich cot rag_indexed_version.
      await manager.query('UPDATE file_metas SET rag_indexed_version = $1, rag_extract_attempt_version = NULL WHERE id = $2', [
        file.currentVersion,
        file.id,
      ]);
      return true;
    });
  }
}
