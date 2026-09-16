export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  kafka: {
    broker: process.env.KAFKA_BROKER ?? 'localhost:9092',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    // 15/09/2026: secret RIENG cho token "Quen mat khau" (khac han access/refresh secret o tren
    // - xem chu thich tai PasswordResetToken entity ve ly do tach rieng).
    resetSecret: process.env.JWT_RESET_SECRET,
    resetExpiresIn: process.env.JWT_RESET_EXPIRES_IN ?? '30m',
  },
  // 15/09/2026: "Quen mat khau" - gui email that qua SMTP (xem email/email.service.ts).
  // SMTP_HOST rong la trang thai HOP LE (dev/demo chua cau hinh MailHog/nha cung cap that) -
  // EmailService tu chuyen sang ghi log link reset thay vi gui that, cung triet ly voi
  // GEMINI_API_KEY/GROQ_API_KEY rong (analytics-service/src/config/configuration.ts).
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '1025', 10),
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM ?? 'noreply@ecap-demo.local',
  },
  // 15/09/2026: URL goc cua frontend (apps/web) - dung de dung link dat lai mat khau gui qua
  // email (vd http://localhost:5173/reset-password?token=...). TACH RIENG voi CORS_ORIGIN (co the
  // la danh sach nhieu origin phan tach boi dau phay) vi day can DUNG 1 gia tri duy nhat.
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
});
