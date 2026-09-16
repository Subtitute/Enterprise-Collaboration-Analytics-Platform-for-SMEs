import { IsEmail } from 'class-validator';

/** Yeu cau gui email dat lai mat khau - Technical_Spec.md "Quen mat khau". */
export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}
