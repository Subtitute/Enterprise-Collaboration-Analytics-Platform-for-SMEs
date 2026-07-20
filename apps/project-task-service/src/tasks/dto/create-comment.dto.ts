import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCommentDto {
  @IsString({ message: 'Noi dung binh luan phai la chuoi ky tu' })
  @IsNotEmpty({ message: 'Noi dung binh luan khong duoc de trong' })
  content: string;
}
