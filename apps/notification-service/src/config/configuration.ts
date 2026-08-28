/**
 * 26/08/2026 (fix audit - Major): truoc day MONGO_URI duoc GHEP SAN thanh 1 chuoi hoan chinh
 * ngay trong infra/docker-compose.yml bang noi chuoi truc tiep
 * (`mongodb://${MONGO_INITDB_ROOT_USERNAME}:${MONGO_INITDB_ROOT_PASSWORD}@mongodb:27017/...`),
 * KHONG qua bat ky buoc encode nao - neu mat khau chua 1 trong cac ky tu dac biet co y nghia cu
 * phap trong URI (`@ : / ? # [ ] %`), chuoi ket noi bi HIEU SAI (vd dau `@` trong mat khau bi
 * nham la ranh gioi ket thuc phan credentials) va Mongoose khong the ket noi. Theo dung mau da
 * dung cho Postgres o CAC service khac (vd apps/iam-service/src/config/configuration.ts - DB_HOST/
 * DB_PORT/DB_USER/DB_PASSWORD/DB_NAME RIENG LE, khong ghep chuoi ket noi san o docker-compose.yml):
 * doi sang nhan 5 bien MONGO_HOST/MONGO_PORT/MONGO_USER/MONGO_PASSWORD/MONGO_DATABASE roi TU xay
 * dung URI TAI DAY, dung encodeURIComponent() cho rieng phan user/password truoc khi noi vao
 * chuoi - encodeURIComponent() escape dung het nhom ky tu dac biet noi tren nen mat khau chua bat
 * ky ky tu nao trong so do van tao ra 1 URI hop le. Xem infra/docker-compose.yml (block environment
 * cua notification-service) va infra/.env.example.
 */
function buildMongoUri(): string {
  const host = process.env.MONGO_HOST ?? 'localhost';
  const port = process.env.MONGO_PORT ?? '27017';
  const database = process.env.MONGO_DATABASE ?? 'notification_db';
  const user = process.env.MONGO_USER;
  const password = process.env.MONGO_PASSWORD;
  // Chi co credentials (va ?authSource=admin di kem) khi CA user LAN password deu duoc cung cap -
  // giu duoc kha nang ket noi Mongo KHONG xac thuc luc dev cuc bo (vd chay `mongod` tran tren may,
  // khong dat MONGO_USER/MONGO_PASSWORD) giong hanh vi mac dinh cu.
  const credentials = user && password ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}@` : '';
  const authSource = user && password ? '?authSource=admin' : '';
  return `mongodb://${credentials}${host}:${port}/${database}${authSource}`;
}

export default () => ({
  port: parseInt(process.env.PORT ?? '3004', 10),
  mongo: {
    uri: buildMongoUri(),
  },
  kafka: {
    broker: process.env.KAFKA_BROKER ?? 'localhost:9092',
  },
  // 25/07/2026 (audit - MINOR): khoi nay hien KHONG duoc doc o bat ky dau trong
  // notification-service (da grep toan bo apps/notification-service/src: khong co
  // RedisModule/RedisService nao dung `config.get('redis.*')`) - ghi chu nay tu 25/07/2026 da CU:
  // 25/08/2026, fix ra soat bao mat bo sung redis/redis.service.ts (chi 1 ham DOC
  // isUserBlacklisted(), dung cho realtime/notifications.gateway.ts kiem tra tai khoan bi
  // deactivate truoc khi cho ket noi WebSocket - WS khong di qua Gateway/InternalAuthGuard nen
  // khong tu duoc bao ve boi kiem tra blacklist da co cho REST). Bien REDIS_HOST/PORT/PASSWORD
  // duoc tiem san tu truoc trong infra/docker-compose.yml (dong bo voi cac service khac dung
  // chung 1 Redis instance) nen khong can sua gi them o do.
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
  },
});
