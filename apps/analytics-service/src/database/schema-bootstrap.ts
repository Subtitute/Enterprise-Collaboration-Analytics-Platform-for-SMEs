import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

const logger = new Logger('SchemaBootstrap');

/**
 * 28/07/2026: DDL idempotent "tu cham" (self-heal) schema TimescaleDB cho tinh nang KPI theo
 * phong ban (dim_user + fact_task_events.assignee_id) - duoc goi tu app.module.ts
 * (`dataSourceFactory` cua TypeOrmModule.forRootAsync) NGAY SAU KHI DataSource ket noi thanh
 * cong, TRUOC KHI DataSource duoc tra ve cho Nest DI container.
 *
 * VI SAO CAN CA NOI NAY LAN infra/timescale-init/001-init.sql CUNG CHUA 1 DDL:
 *  - infra/timescale-init/001-init.sql CHI duoc TimescaleDB image tu dong chay 1 LAN DUY NHAT
 *    (co che docker-entrypoint-initdb.d) khi container khoi tao TREN 1 VOLUME HOAN TOAN MOI - noi
 *    do CHI phuc vu fresh-install/tai lieu hoa schema, KHONG bao gio tu chay lai tren volume da
 *    co du lieu.
 *  - Moi truong dev/staging cua do an nay da co TimescaleDB dang chay san VOI DU LIEU (volume
 *    KHONG con "moi" nen sua 001-init.sql khong tu dong ap dung) - can 1 buoc DDL THEM chay
 *    ngay trong code ung dung, dung CREATE TABLE/INDEX IF NOT EXISTS va ALTER TABLE ADD COLUMN
 *    IF NOT EXISTS (Postgres ho tro ca 2, an toan goi lai nhieu lan/idempotent) de database dang
 *    chay "bat kip" schema moi ngay lan restart tiep theo MA KHONG can 1 buoc migration thu cong
 *    (do an nay khong co migration runner that - xem ghi chu app.module.ts).
 *
 * Sua doi schema o day PHAI dong bo voi infra/timescale-init/001-init.sql (giu 2 noi cung 1 DDL).
 *
 * dim_user la bang lookup THUAN (user_id -> phong ban HIEN TAI), KHONG phai hypertable - KHONG
 * goi create_hypertable() cho bang nay vi no khong co chieu thoi gian (time dimension).
 */
export async function bootstrapDepartmentKpiSchema(dataSource: DataSource): Promise<void> {
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS dim_user (
      user_id          UUID             PRIMARY KEY,
      organization_id  UUID             NOT NULL,
      department_id    UUID,
      updated_at       TIMESTAMPTZ      NOT NULL DEFAULT now()
    )
  `);
  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_dim_user_org ON dim_user (organization_id)
  `);
  await dataSource.query(`
    ALTER TABLE fact_task_events ADD COLUMN IF NOT EXISTS assignee_id UUID
  `);
  logger.log(
    'Da kiem tra/tao xong schema KPI theo phong ban (dim_user, fact_task_events.assignee_id).',
  );
}
