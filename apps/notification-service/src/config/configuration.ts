export default () => ({
  port: parseInt(process.env.PORT ?? '3004', 10),
  mongo: {
    uri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/notification_db',
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
