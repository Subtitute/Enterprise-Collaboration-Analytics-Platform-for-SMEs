import { ArrayNotEmpty, IsArray, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ConversationType } from '../../entities/conversation-type.enum';

/**
 * Tao cuoc tro chuyen DIRECT (1:1) hoac GROUP (nhom). "type=GROUP thi name bat buoc" va "type=DIRECT
 * thi participantUserIds phai dung 1 phan tu" duoc validate o SERVICE layer (khong o day) - 2 dieu
 * kien nay phu thuoc lan nhau giua `type` va cac field khac, class-validator co ho tro @ValidateIf
 * nhung thong bao loi tra ve se kem rieng (khong the gop thanh 1 loi nghiep vu ro rang nhu
 * BadRequestException + ERROR_CODES tai service).
 */
export class CreateConversationDto {
  @IsEnum(ConversationType)
  type: ConversationType;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  participantUserIds: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}
