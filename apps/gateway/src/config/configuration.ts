export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
  },
  // Base URL cua tung downstream service - Gateway proxy path-preserving toi day
  // (Technical_Spec.md muc 6: tat ca downstream service dung chung tien to /api/v1).
  services: {
    iam: process.env.IAM_SERVICE_URL ?? 'http://localhost:3001',
    projectTask: process.env.PROJECT_TASK_SERVICE_URL ?? 'http://localhost:3002',
    document: process.env.DOCUMENT_SERVICE_URL ?? 'http://localhost:3003',
    notification: process.env.NOTIFICATION_SERVICE_URL ?? 'http://localhost:3004',
    analytics: process.env.ANALYTICS_SERVICE_URL ?? 'http://localhost:3005',
    // 04/08/2026: CRM-lite Service (Technical_Spec.md muc 16).
    crm: process.env.CRM_SERVICE_URL ?? 'http://localhost:3007',
    // 05/08/2026: HRM-lite Service (Technical_Spec.md muc 17).
    hrm: process.env.HRM_SERVICE_URL ?? 'http://localhost:3006',
    // 24/09/2026: ML Service (Layer 3 Anomaly Detection, Python/FastAPI - Technical_Spec.md muc 19).
    ml: process.env.ML_SERVICE_URL ?? 'http://localhost:3008',
  },
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
    windowSeconds: parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS ?? '60', 10),
  },
});
