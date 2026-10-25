/**
 * 25/10/2026 (CDC Debezium, profile `cdc`; fix ra soat: chuyen tu outbox-publisher.job.ts vao day cho
 * dong bo voi cac cau hinh khac): ENABLE_OUTBOX_POLLING=false (khong phan biet hoa thuong/khoang
 * trang) tat polling khi Debezium doc WAL bang outbox_events va publish thay (scripts/cdc-on.ps1).
 * Moi gia tri khac, ke ca khong dat, la BAT - mac dinh an toan: thua 1 nguon publish chi gay trung
 * lap (consumer idempotent theo eventId), con thieu nguon publish se lam mat su kien.
 */
export function isOutboxPollingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ENABLE_OUTBOX_POLLING?.trim().toLowerCase() !== 'false';
}

export default () => ({
  port: parseInt(process.env.PORT ?? '3002', 10),
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
  outbox: {
    pollingEnabled: isOutboxPollingEnabled(),
  },
});
