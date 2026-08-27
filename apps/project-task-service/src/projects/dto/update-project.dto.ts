import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ProjectPriority } from '../../entities/project.entity';

// 26/08/2026 (fix code review, loi MAJOR): BO field `status` khoi DTO nay - truoc day PATCH
// /projects/:id (dung chung cho sua name/description/dueDate) cho phep gui kem `status` va
// ProjectsService.update() ap dung THANG qua findOne()+save() thuong, KHONG co lock/state-machine
// check/khong ghi Outbox event nao ca - bo qua toan bo cac rang buoc ma complete()/reopen()/
// archive() (cung file projects.service.ts) co chu y cai dat (khoa pessimistic_write + re-check +
// phat dung event PROJECT_COMPLETED/...). Mot client goi PATCH /projects/:id voi { status:
// 'COMPLETED' } se doi trang thai "am tham" ma khong qua bat ky safeguard nao, va Analytics
// (nghe Outbox event) khong bao gio biet du an do vua hoan thanh. Doi trang thai gio CHI con duoc
// phep qua 3 endpoint chuyen dung POST /projects/:id/complete|reopen|archive - dung mirror quy uoc
// da co san cua UpdateTaskDto (tasks/dto/update-task.dto.ts) va UpdateDealDto (crm-service/src/
// deals/dto/update-deal.dto.ts): ca 2 DTO update chung do deu CO CHU DICH khong khai bao field
// status/stage, chi doi qua endpoint rieng.
export class UpdateProjectDto {
  @IsOptional()
  @IsString({ message: 'Ten du an phai la chuoi ky tu' })
  @IsNotEmpty({ message: 'Ten du an khong duoc de trong' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Mo ta du an phai la chuoi ky tu' })
  description?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Han hoan thanh du an phai la ngay hop le (ISO-8601)' })
  dueDate?: string;

  // 26/08/2026 (fix code review, loi MAJOR - Fix 3): 2 field moi (priority/leadUserId) - KHAC voi
  // `status` da bi bo o tren, 2 field nay khong co state-machine/lock/outbox event nao can bao ve
  // (chi la thuoc tinh mo ta, khong anh huong luong nghiep vu hoan thanh/mo lai/luu tru du an) nen
  // an toan de cho phep cap nhat qua PATCH /projects/:id dung chung voi name/description/dueDate.
  @IsOptional()
  @IsEnum(ProjectPriority, { message: 'Do uu tien du an khong hop le' })
  priority?: ProjectPriority;

  @IsOptional()
  @IsUUID('4', { message: 'leadUserId phai la UUID hop le' })
  leadUserId?: string;
}
