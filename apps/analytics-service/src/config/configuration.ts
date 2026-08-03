export default () => ({
  port: parseInt(process.env.PORT ?? '3005', 10),
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
    // Chi can access secret - Analytics Service khong phat hanh token, chi verify
    // token do IAM Service ky khi client mo ket noi WebSocket (xem realtime/analytics.gateway.ts).
    accessSecret: process.env.JWT_ACCESS_SECRET,
  },
  // 28/07/2026: cau hinh cho tinh nang "Nhan xet AI" (GET /analytics/ai-insights, xem
  // ai-insights/ai-insights.service.ts) - goi Google Gemini API (free tier, khong yeu cau ha
  // tang GPU/local model, phu hop dieu kien tai nguyen han che). apiKey RONG (chua cau hinh) la
  // trang thai HOP LE (dich vu con lai van hoat dong binh thuong) - AiInsightsService tu kiem tra
  // va tra loi ro rang thay vi de fetch() that bai kho hieu.
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
  },
});
