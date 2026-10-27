import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * 15/09/2026: gui email that qua SMTP (nodemailer) - dung cho "Quen mat khau". Cau hinh qua bien
 * moi truong SMTP_HOST/PORT/USER/PASSWORD/FROM (xem configuration.ts), TRONG DEV/DEMO mac dinh tro
 * toi container `mailhog` moi (infra/docker-compose.yml) - SMTP gia lap KHONG can tai khoan that,
 * co giao dien web (localhost:8025) xem lai moi email da "gui" - cho phep demo luong quen mat khau
 * TRON VEN (bam link that trong email) ma khong can cau hinh Gmail/SendGrid that. Doi sang nha
 * cung cap that (Gmail app-password, SendGrid...) chi can doi gia tri SMTP_* trong .env, khong doi
 * code - mirror dung triet ly "config optional, co the doi nha cung cap ma khong sua code" da ap
 * dung cho GEMINI_API_KEY/GROQ_API_KEY (analytics-service).
 *
 * KHAC voi Gemini/Groq (apiKey rong = tinh nang tra loi 503 ro rang cho nguoi dung): o day, SMTP
 * chua cau hinh/gui that bai KHONG duoc phep lam that bai request "Quen mat khau" cua nguoi dung -
 * endpoint do BAT BUOC luon tra ve thanh cong chung chung (chong do email, xem AuthService.
 * forgotPassword()) bat ke email co gui duoc hay khong. Vi vay sendPasswordResetEmail() nuot loi,
 * chi log lai - va khi SMTP_HOST rong (chua cau hinh), IN THANG link reset ra log server (muc LOG,
 * de thay khi doc `docker compose logs iam-service`) thay vi thu gui that, giup dev/demo van lay
 * duoc link ngay ca khi chua dung MailHog.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter?: Transporter;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('smtp.host');
    if (!host) return;

    const user = this.configService.get<string>('smtp.user');
    const password = this.configService.get<string>('smtp.password');
    this.transporter = nodemailer.createTransport({
      host,
      port: this.configService.get<number>('smtp.port'),
      // MailHog khong yeu cau xac thuc - chi dat `auth` khi CO khai bao user/password that.
      // Luu y: nodemailer dat ten field mat khau la `pass` (KHONG phai `password`).
      auth: user && password ? { user, pass: password } : undefined,
    });
  }

  /**
   * 26/10/2026: email kich hoat tai khoan duoc moi KHONG kem mat khau (Technical_Spec.md muc 27.9,
   * Q7) - KHONG BAO GIO chua mat khau; nhac xac nhan anh nhan dien neu quan tri vien co tai kem.
   * Cung quy uoc nuot loi nhu sendPasswordResetEmail() (moi thanh vien van thanh cong).
   */
  async sendInviteEmail(to: string, fullName: string, activationLink: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`SMTP chua duoc cau hinh (SMTP_HOST rong) - link kich hoat tai khoan cho ${to}: ${activationLink}`);
      return;
    }
    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('smtp.from'),
        to,
        subject: 'Kích hoạt tài khoản - Enterprise Collaboration & Analytics Platform',
        text: `Xin chào ${fullName},\n\nBạn vừa được mời tham gia hệ thống. Nhấp vào liên kết sau để đặt mật khẩu và kích hoạt tài khoản (liên kết hết hạn sau 72 giờ):\n\n${activationLink}\n\nNếu quản trị viên đã tải ảnh nhận diện chấm công cho bạn, hãy vào Hồ sơ cá nhân để xem và xác nhận trong vòng 30 ngày. Từ chối không ảnh hưởng tới việc chấm công.`,
        html: `<p>Xin chào ${escapeHtml(fullName)},</p><p>Bạn vừa được mời tham gia hệ thống. <a href="${activationLink}">Nhấp vào đây để đặt mật khẩu và kích hoạt tài khoản</a> (liên kết hết hạn sau 72 giờ).</p><p>Nếu quản trị viên đã tải ảnh nhận diện chấm công cho bạn, hãy vào Hồ sơ cá nhân để xem và xác nhận trong vòng 30 ngày. Từ chối không ảnh hưởng tới việc chấm công.</p>`,
      });
    } catch (err) {
      this.logger.error(`Gui email kich hoat that bai (${to}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    const from = this.configService.get<string>('smtp.from');

    if (!this.transporter) {
      this.logger.log(
        `SMTP chua duoc cau hinh (SMTP_HOST rong) - link dat lai mat khau cho ${to}: ${resetLink}`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from,
        to,
        subject: 'Đặt lại mật khẩu - Enterprise Collaboration & Analytics Platform',
        text: `Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu cho tài khoản này. Nhấp vào liên kết sau để đặt mật khẩu mới (liên kết hết hạn sau 30 phút):\n\n${resetLink}\n\nNếu bạn không yêu cầu điều này, có thể bỏ qua email này - mật khẩu hiện tại vẫn không đổi.`,
        html: `<p>Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu cho tài khoản này.</p><p><a href="${resetLink}">Nhấp vào đây để đặt mật khẩu mới</a> (liên kết hết hạn sau 30 phút).</p><p>Nếu bạn không yêu cầu điều này, có thể bỏ qua email này - mật khẩu hiện tại vẫn không đổi.</p>`,
      });
    } catch (err) {
      // Xem chu thich dau file - KHONG duoc rethrow, forgotPassword() van phai tra ve thanh cong
      // chung chung bat ke buoc gui email nay co thanh cong hay khong (chong do email).
      this.logger.error(
        `Gui email dat lai mat khau that bai (${to}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

// 26/10/2026: ho ten do quan tri vien nhap duoc chen vao HTML email moi - thoat ky tu de khong chen duoc the HTML.
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}
