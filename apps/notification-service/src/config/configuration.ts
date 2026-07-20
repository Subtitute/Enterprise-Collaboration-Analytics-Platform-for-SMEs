export default () => ({
  port: parseInt(process.env.PORT ?? '3004', 10),
  mongo: {
    uri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/notification_db',
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
  },
});
