import { HttpException, HttpStatus, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ERROR_CODES } from '@app/common-dto';
import { DocumentChunk } from '../entities/document-chunk.entity';
import { FileMeta } from '../entities/file-meta.entity';
import { FilesService } from '../files/files.service';
import { AccessContext } from '../folders/folder-access.service';
import { GeminiEmbeddingService } from './gemini-embedding.service';
import { SearchChunksDto } from './dto/search-chunks.dto';
import { rankBySimilarity } from './utils/vector.util';

const DEFAULT_TOP_K = 5;
// Diem cosine toi thieu de 1 doan duoc coi la "lien quan" - duoi nguong nay bo han, de chat bot
// tra loi ro "khong tim thay" thay vi dua doan van khong lien quan cho LLM dien giai. Can chinh theo
// do dac song 24/10/2026 (gemini-embedding-001, 768 chieu): doan DUNG chu de dat ~0.69-0.73, cau hoi
// hoan toan khong lien quan ("cong thuc nau pho bo") van dat ~0.53-0.57 voi tai lieu demo - nguong 0.5
// ban dau khong loc duoc nhieu nay.
export const MIN_RELEVANCE_SCORE = 0.6;

// 24/10/2026: gioi han tan suat THEO NGUOI DUNG cho moi lan goi nhung cau hoi (phat hien qua ra soat
// cuoi): endpoint nay goi duoc truc tiep qua Gateway, khong qua han ngach 30 cau/ngay cua chat bot,
// trong khi GEMINI_API_KEY dung CHUNG cho toan nen tang - 1 nguoi co the dot het han ngach free tier,
// lam chat bot ngung hoat dong voi MOI to chuc. 40 lan/10 phut du rong cho dung that (moi cau hoi
// chat bot thuong chi tim 1-2 lan). Dem trong bo nho - gia dinh 1 instance, giong khoa "hoi thoai dang
// ban" cua chat bot; khoi dong lai service thi bo dem ve 0 (chap nhan duoc).
export const SEARCH_RATE_LIMIT = { maxRequests: 40, windowMs: 10 * 60_000 };
// Don cac nguoi dung khong con lan goi nao trong cua so khi so khoa vuot nguong nay - giu Map khong
// phinh mai theo so nguoi dung tung goi (RAM may dev co han, xem Technical_Spec.md muc 25).
const RATE_LIMIT_SWEEP_THRESHOLD = 500;

export interface ChunkSearchResult {
  fileId: string;
  fileName: string;
  content: string;
  score: number;
}

export interface SearchChunksResponse {
  /** false khi RAG chua cau hinh (thieu GEMINI_API_KEY) - `results` luon rong, KHONG phai loi. */
  ragEnabled: boolean;
  results: ChunkSearchResult[];
}

/**
 * 24/10/2026: tim kiem ngu nghia tai lieu (RAG) cho Chat bot noi bo - Technical_Spec.md muc 23.
 *
 * Thu tu xu ly co chu dich: (1) loc o muc FILE truoc - chi giu file nguoi goi THAT SU xem duoc theo
 * FilesService.canAccessFile() (dung nguyen quy tac thu muc RESTRICTED/FolderShare/FileShare da co,
 * KHONG viet lai o day); (2) nhung cau hoi; (3) cosine brute-force CHI tren chunk cua cac file da qua
 * buoc 1 - doan van cua file nguoi goi khong co quyen KHONG BAO GIO duoc nap vao de cham diem.
 *
 * Gioi han da biet: buoc 3 nap toan bo vector
 * cua cac file hop le vao bo nho - phu hop quy mo demo (vai tram tai lieu); quy mo lon hon can pgvector
 * + ANN index (ngoai pham vi do an, xem Technical_Spec.md muc 23.8).
 */
@Injectable()
export class DocumentSearchService {
  private readonly logger = new Logger(DocumentSearchService.name);
  /** userId -> moc thoi gian (ms) cac lan goi nhung cau hoi con nam trong cua so SEARCH_RATE_LIMIT. */
  private readonly recentSearches = new Map<string, number[]>();

  constructor(
    @InjectRepository(DocumentChunk) private readonly chunkRepo: Repository<DocumentChunk>,
    @InjectRepository(FileMeta) private readonly fileMetaRepo: Repository<FileMeta>,
    private readonly filesService: FilesService,
    private readonly embeddingService: GeminiEmbeddingService,
  ) {}

  async search(organizationId: string, dto: SearchChunksDto, ctx: AccessContext): Promise<SearchChunksResponse> {
    if (!this.embeddingService.isEnabled()) return { ragEnabled: false, results: [] };

    const accessibleFiles = await this.findAccessibleIndexedFiles(organizationId, ctx);
    if (accessibleFiles.size === 0) return { ragEnabled: true, results: [] };

    // Chi dem khi THAT SU sap goi Gemini (sau 2 nhanh tra som o tren - khong ton han ngach).
    this.consumeSearchQuota(ctx.userId);

    let queryVector: number[];
    try {
      queryVector = await this.embeddingService.embedQuery(dto.query);
    } catch (err) {
      this.logger.warn(`Nhung cau hoi tim kiem that bai: ${(err as Error).message}`);
      throw new ServiceUnavailableException({
        message: 'Tim kiem tai lieu tam thoi khong kha dung, vui long thu lai sau',
        errorCode: ERROR_CODES.DOCUMENT_SEARCH_UNAVAILABLE,
      });
    }

    const chunks = await this.chunkRepo.find({
      select: { fileId: true, content: true, embedding: true },
      where: { organizationId, fileId: In([...accessibleFiles.keys()]) },
    });
    const ranked = rankBySimilarity(queryVector, chunks, dto.topK ?? DEFAULT_TOP_K, MIN_RELEVANCE_SCORE);

    return {
      ragEnabled: true,
      results: ranked.map(({ item, score }) => ({
        fileId: item.fileId,
        fileName: accessibleFiles.get(item.fileId)?.fileName ?? '',
        content: item.content,
        score: Math.round(score * 1000) / 1000,
      })),
    };
  }

  /**
   * File DA co chunk trong to chuc ma nguoi goi xem duoc (theo FilesService.canAccessFile).
   * 24/10/2026: dung FilesService.createFileAccessFilter() (cung quy tac, nay ke thua quyen tu thu muc
   * cha) - 3 truy van cho ca lan tim thay vi 2-3 truy van cho MOI file.
   */
  private async findAccessibleIndexedFiles(organizationId: string, ctx: AccessContext): Promise<Map<string, FileMeta>> {
    const indexed = await this.chunkRepo
      .createQueryBuilder('chunk')
      .select('DISTINCT chunk.fileId', 'fileId')
      .where('chunk.organizationId = :organizationId', { organizationId })
      .getRawMany<{ fileId: string }>();
    const accessible = new Map<string, FileMeta>();
    if (indexed.length === 0) return accessible;

    const files = await this.fileMetaRepo.find({
      where: { organizationId, id: In(indexed.map((row) => row.fileId)) },
    });
    const canAccessFile = await this.filesService.createFileAccessFilter(organizationId, ctx);
    for (const file of files) {
      if (canAccessFile(file)) accessible.set(file.id, file);
    }
    return accessible;
  }

  /** Cua so truot theo nguoi dung - xem SEARCH_RATE_LIMIT. Vuot tran -> 429, KHONG goi Gemini. */
  private consumeSearchQuota(userId: string): void {
    const now = Date.now();
    const windowStart = now - SEARCH_RATE_LIMIT.windowMs;
    if (this.recentSearches.size > RATE_LIMIT_SWEEP_THRESHOLD) {
      for (const [key, stamps] of this.recentSearches) {
        if (stamps[stamps.length - 1] <= windowStart) this.recentSearches.delete(key);
      }
    }
    const recent = (this.recentSearches.get(userId) ?? []).filter((at) => at > windowStart);
    if (recent.length >= SEARCH_RATE_LIMIT.maxRequests) {
      this.recentSearches.set(userId, recent);
      throw new HttpException(
        {
          message: 'Ban da tim kiem tai lieu qua nhieu lan trong thoi gian ngan, vui long thu lai sau it phut',
          errorCode: ERROR_CODES.DOCUMENT_SEARCH_RATE_LIMITED,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.recentSearches.set(userId, recent);
  }
}
