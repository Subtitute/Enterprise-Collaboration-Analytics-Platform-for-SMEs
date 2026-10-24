import { Transform, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** 24/10/2026: body POST /files/search-chunks - tim kiem ngu nghia tai lieu (RAG, Technical_Spec.md muc 23). */
export class SearchChunksDto {
  // 24/10/2026 (fix kiem thu RAG): trim truoc khi validate - truoc day query chi gom khoang trang/xuong
  // dong qua duoc @IsNotEmpty, van ton 1 lan goi Gemini va tra ve 5 doan "lien quan" (diem ~0.62-0.64)
  // hoan toan ngau nhien.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  query: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  topK?: number;
}
