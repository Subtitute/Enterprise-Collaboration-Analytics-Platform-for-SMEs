export default () => ({
  port: parseInt(process.env.PORT ?? '3010', 10),
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
  // Anh san pham - mirror document-service/hrm-service (bucket MinIO RIENG cho service nay, xem
  // minio/minio.service.ts).
  minio: {
    endpoint: process.env.MINIO_ENDPOINT ?? 'localhost',
    port: parseInt(process.env.MINIO_PORT ?? '9000', 10),
    useSsl: (process.env.MINIO_USE_SSL ?? 'false') === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    bucket: process.env.MINIO_BUCKET,
    publicEndpoint: process.env.MINIO_PUBLIC_ENDPOINT ?? process.env.MINIO_ENDPOINT ?? 'localhost',
    publicPort: parseInt(process.env.MINIO_PUBLIC_PORT ?? process.env.MINIO_PORT ?? '9000', 10),
    publicUseSsl: (process.env.MINIO_PUBLIC_USE_SSL ?? process.env.MINIO_USE_SSL ?? 'false') === 'true',
  },
});
