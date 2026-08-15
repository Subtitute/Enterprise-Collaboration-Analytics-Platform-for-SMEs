export default () => ({
  port: parseInt(process.env.PORT ?? '3006', 10),
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
    // Dung de PUT/GET object server-to-server, ben trong Docker network (vd "minio").
    endpoint: process.env.MINIO_ENDPOINT ?? 'localhost',
    port: parseInt(process.env.MINIO_PORT ?? '9000', 10),
    useSsl: (process.env.MINIO_USE_SSL ?? 'false') === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    bucket: process.env.MINIO_BUCKET,
    // Dung rieng de KY presigned GET URL (xem anh cham cong) - phai la host:port ma TRINH DUYET
    // cua client phan giai duoc, khac voi hostname noi bo "minio" o tren - mirror
    // apps/document-service/src/config/configuration.ts.
    publicEndpoint: process.env.MINIO_PUBLIC_ENDPOINT ?? process.env.MINIO_ENDPOINT ?? 'localhost',
    publicPort: parseInt(process.env.MINIO_PUBLIC_PORT ?? process.env.MINIO_PORT ?? '9000', 10),
    publicUseSsl: (process.env.MINIO_PUBLIC_USE_SSL ?? process.env.MINIO_USE_SSL ?? 'false') === 'true',
  },
  // 13/08/2026: toa do van phong - dung de gan co "on-site"/"off-site" (KHONG chan check-in/out,
  // chi la 1 co gan kem de Manager doi chieu voi anh, xem AttendanceService.computeIsOnSite()).
  // Con thieu latitude/longitude (chua cau hinh) -> bo qua tinh toan hoan toan, khong loi.
  office: {
    latitude: process.env.OFFICE_LATITUDE ? parseFloat(process.env.OFFICE_LATITUDE) : undefined,
    longitude: process.env.OFFICE_LONGITUDE ? parseFloat(process.env.OFFICE_LONGITUDE) : undefined,
    geofenceRadiusMeters: parseInt(process.env.OFFICE_GEOFENCE_RADIUS_METERS ?? '200', 10),
  },
});
