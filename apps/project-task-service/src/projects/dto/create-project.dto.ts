import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ProjectPriority } from '../../entities/project.entity';

/** Tao du an moi - Technical_Spec.md muc 3.3, Wireframe.md muc 4. */
export class CreateProjectDto {
  @IsString({ message: 'Ten du an phai la chuoi ky tu' })
  @IsNotEmpty({ message: 'Ten du an khong duoc de trong' })
  name: string;

  @IsOptional()
  @IsString({ message: 'Mo ta du an phai la chuoi ky tu' })
  description?: string;

  // 22/07/2026 (fix code review, loi MINOR - Fix 8): truoc do frontend (NewProjectModal.tsx) da gui
  // san field nay nhung DTO khong khai bao -> ValidationPipe (whitelist: true) am tham xoa field
  // khoi body, han hoan thanh du an bi mat ngay tu luc tao. Xem project.entity.ts (cot moi `due_date`).
  @IsOptional()
  @IsDateString({}, { message: 'Han hoan thanh du an phai la ngay hop le (ISO-8601)' })
  dueDate?: string;

  // 26/08/2026 (fix code review, loi MAJOR - Fix 3): 2 field moi - truoc do frontend chi luu
  // priority/leadId vao localStorage (rieng tung trinh duyet, khong dong bo giua nguoi dung). Xem
  // chu thich chi tiet tai project.entity.ts (cot moi `priority`/`lead_user_id`) va
  // projects.service.ts (create()).
  @IsOptional()
  @IsEnum(ProjectPriority, { message: 'Do uu tien du an khong hop le' })
  priority?: ProjectPriority;

  @IsOptional()
  @IsUUID('4', { message: 'leadUserId phai la UUID hop le' })
  leadUserId?: string;
}
