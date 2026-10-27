import { DEV_FALLBACK_INTERNAL_SHARED_SECRET } from '@app/common-dto';

export default () => ({
  port: parseInt(process.env.PORT ?? '3003', 10),
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
  minio: {
    // Dung de PUT/REMOVE object server-to-server, ben trong Docker network (vd "minio").
    endpoint: process.env.MINIO_ENDPOINT ?? 'localhost',
    port: parseInt(process.env.MINIO_PORT ?? '9000', 10),
    useSsl: (process.env.MINIO_USE_SSL ?? 'false') === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    bucket: process.env.MINIO_BUCKET,
    // Dung rieng de KY presigned GET URL - phai la host:port ma TRINH DUYET cua client
    // phan giai duoc (vd "localhost:9010" qua port mapping cua docker-compose), khac voi
    // hostname noi bo "minio" o tren. Neu khong cau hinh, fallback ve endpoint/port noi bo
    // (dung cho truong hop chay MinIO truc tiep tren localhost, khong qua Docker).
    publicEndpoint: process.env.MINIO_PUBLIC_ENDPOINT ?? process.env.MINIO_ENDPOINT ?? 'localhost',
    publicPort: parseInt(process.env.MINIO_PUBLIC_PORT ?? process.env.MINIO_PORT ?? '9000', 10),
    publicUseSsl: (process.env.MINIO_PUBLIC_USE_SSL ?? process.env.MINIO_USE_SSL ?? 'false') === 'true',
  },
  // 24/10/2026: RAG tai lieu cho Chat bot noi bo (Technical_Spec.md muc 23) - nhung van ban qua
  // Gemini API (dung chung GEMINI_API_KEY voi "Nhan xet AI" cua analytics-service, KHONG chay model
  // local). apiKey RONG la trang thai HOP LE: service van chay binh thuong, chi tat RAG (khong index,
  // search tra ket qua rong kem co `ragEnabled: false`) - mirror quy uoc gemini.apiKey cua analytics.
  // Model mac dinh da xac minh song 24/10/2026: gemini-embedding-001 (outputDimensionality 768) -
  // text-embedding-004 da bi Google ngung (404).
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    embeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001',
  },
  // 26/10/2026: tai lieu theo pham vi du an - backfill read-model thanh vien du an tu Project-Task
  // Service luc khoi dong (project-scope/project-scope-sync.service.ts). Mac dinh la hostname noi bo
  // cua docker-compose (cung internal-net); chay local ngoai Docker thi dat PROJECT_TASK_SERVICE_URL.
  // Bi mat noi bo: cung bien INTERNAL_SHARED_SECRET voi InternalAuthGuard (fallback dev giong guard).
  projectTask: {
    url: process.env.PROJECT_TASK_SERVICE_URL ?? 'http://project-task-service:3002',
  },
  internalSecret: process.env.INTERNAL_SHARED_SECRET || DEV_FALLBACK_INTERNAL_SHARED_SECRET,
});
