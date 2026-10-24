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
    model: process.env.GEMINI_MODEL ?? 'gemini-flash-latest',
  },
  // 20/08/2026: phuong an du phong TU DONG cho "Nhan xet AI" khi Gemini loi/qua tai (xem
  // AiInsightsService.generateText()) - Groq (console.groq.com) dung phan cung suy luan chuyen
  // dung, free tier it bi loi 503 "qua tai" hon Gemini. apiKey RONG cung la trang thai HOP LE,
  // cung quy uoc voi gemini o tren.
  groq: {
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b',
  },
  // 24/10/2026: Chat bot noi bo (Technical_Spec.md muc 23, xem chatbot/). Dung lai gemini.apiKey/
  // groq.apiKey/groq.model o tren (cung thu tu uu tien Gemini -> Groq du phong nhu "Nhan xet AI"),
  // chi tach rieng MODEL Gemini: hoi-dap co nhieu vong goi tool lien tiep nen can model phan hoi
  // nhanh - xac minh song 24/10/2026: gemini-flash-latest > 40s/vong (qua tai), gemini-flash-lite-latest
  // ~1-2s/vong, ca 2 deu ho tro function calling. gatewayUrl: Gateway CONG KHAI ma tool goi lai kem
  // JWT nguoi hoi (trong Docker la http://gateway:3000).
  chatbot: {
    geminiModel: process.env.CHATBOT_GEMINI_MODEL ?? 'gemini-flash-lite-latest',
    gatewayUrl: process.env.CHATBOT_GATEWAY_URL ?? 'http://localhost:3000',
    dailyQuestionLimit: parseInt(process.env.CHATBOT_DAILY_QUESTION_LIMIT ?? '30', 10),
  },
});
