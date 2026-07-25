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
  // RedisModule/RedisService nao dung `config.get('redis.*')`) - Notification Service dung
  // MongoDB (danh sach thong bao) + WebSocket phong theo userId (xem realtime/notifications.gateway.ts)
  // chu khong can Redis. Van GIU LAI khoi nay (khong xoa) vi infra/docker-compose.yml van dang
  // tiem REDIS_HOST/REDIS_PORT/REDIS_PASSWORD vao environment cua container nay (dong bo voi cac
  // service khac dung chung 1 Redis instance) - xoa khoi day se khong gay loi runtime nhung se
  // lam mat ghi chep ve viec bien moi truong nay TON TAI o container ma khong duoc dung, de gay
  // nham lan sau nay tuong day la 1 dependency dang hoat dong. Neu ve sau xac nhan chac chan
  // khong bao gio can Redis o service nay, nen xoa CA khoi nay LAN cac bien REDIS_* tuong ung
  // trong docker-compose.yml/.env.example cung luc.
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
  },
});
