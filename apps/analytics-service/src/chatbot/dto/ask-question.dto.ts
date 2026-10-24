import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** 24/10/2026: body POST /chatbot/conversations/:id/messages - 1 cau hoi gui Chat bot noi bo. */
export class AskQuestionDto {
  // 24/10/2026: cat khoang trang 2 dau TRUOC khi kiem tra - cau hoi chi gom khoang trang/xuong dong
  // truoc day qua duoc @IsNotEmpty, van tru 1 luot han ngach + goi LLM va dat tieu de hoi thoai rong.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  question: string;
}
