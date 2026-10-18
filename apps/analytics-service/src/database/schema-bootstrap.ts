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
 *
 * 26/08/2026 (fix audit - Minor/Major, dim_user upsert khong co "guard" chong event den SAI THU
 * TU): bo sung cot `last_event_at` (luu event.occurredAt cua lan upsert GAN NHAT ap dung THANH
 * CONG - khac `updated_at` van la thoi diem ghi theo dong ho he thong) - xem ghi chu chi tiet tai
 * FactWriterService.upsertUserDepartment() (fact-writer.service.ts). Dung ALTER TABLE ADD COLUMN
 * IF NOT EXISTS (khong phai CREATE TABLE lai) vi dim_user co the DA TON TAI tu truoc ban fix nay
 * tren moi truong dev/staging dang chay - dong bo voi cach fact_task_events.assignee_id da duoc
 * them ben duoi.
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
  // 26/08/2026: xem ghi chu Fix ordering o tren - dung NULLABLE (khong DEFAULT now()) vi cac hang
  // dim_user DA TON TAI truoc ban fix nay chua tung co 1 event.occurredAt nao duoc ghi nhan; NULL
  // duoc upsertUserDepartment() coi la "chua co moc so sanh" nen event tiep theo bat ky LUON duoc
  // ap dung (tuong duong hanh vi last-write-wins CU cho toi khi co it nhat 1 lan ghi MOI).
  await dataSource.query(`
    ALTER TABLE dim_user ADD COLUMN IF NOT EXISTS last_event_at TIMESTAMPTZ
  `);
  await dataSource.query(`
    ALTER TABLE fact_task_events ADD COLUMN IF NOT EXISTS assignee_id UUID
  `);
  // 24/09/2026: due_date - dong bo voi infra/timescale-init/001-init.sql (xem ghi chu tai do).
  await dataSource.query(`
    ALTER TABLE fact_task_events ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ
  `);
  // 23/09/2026: dim_department_manager - bang lookup THUAN (department_id -> nguoi phu trach
  // HIEN TAI), cung mau voi dim_user o tren (last_event_at de chong event den sai thu tu - xem
  // FactWriterService.upsertDepartmentManager()). Phuc vu scoping "Manager chi thay Hoat dong gan
  // day cua phong ban minh phu trach" (AnalyticsService.getRecentActivity()).
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS dim_department_manager (
      department_id    UUID             PRIMARY KEY,
      organization_id  UUID             NOT NULL,
      manager_id       UUID,
      updated_at       TIMESTAMPTZ      NOT NULL DEFAULT now(),
      last_event_at    TIMESTAMPTZ
    )
  `);
  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_dim_department_manager_org_manager ON dim_department_manager (organization_id, manager_id)
  `);
  logger.log(
    'Da kiem tra/tao xong schema KPI theo phong ban (dim_user + dim_user.last_event_at, fact_task_events.assignee_id/due_date, dim_department_manager).',
  );
}

/**
 * 15/10/2026: tu cham (self-heal) hypertable fact_product_sales (Inventory Service - Danh muc san
 * pham + Kho, Technical_Spec.md muc 22) tren moi truong dev/staging DANG CHAY SAN (volume KHONG
 * con "moi" nen infra/timescale-init/001-init.sql khong tu chay lai - xem ghi chu dau file nay va
 * tai 001-init.sql, DDL PHAI giu dong bo giua 2 noi).
 *
 * KHONG tu tao continuous aggregate `daily_product_sales_summary` o day - mirror dung gioi han da
 * ghi nhan tu truoc cho daily_task_summary/weekly_project_progress/daily_document_activity (xem
 * chu thich tai 001-init.sql): materialized view CHI duoc tao qua script fresh-install, moi truong
 * dang chay san can DROP + tao lai thu cong (khong co migration runner that su trong du an nay).
 */
export async function bootstrapProductSalesSchema(dataSource: DataSource): Promise<void> {
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS fact_product_sales (
      time             TIMESTAMPTZ      NOT NULL,
      event_id         UUID             NOT NULL,
      organization_id  UUID             NOT NULL,
      event_type       TEXT             NOT NULL,
      purchase_id      UUID,
      product_id       UUID,
      category_id      UUID,
      customer_id      UUID,
      quantity         INT,
      unit_price       NUMERIC(14,2),
      actor_id         UUID,
      PRIMARY KEY (time, event_id)
    )
  `);
  await dataSource.query(`
    SELECT create_hypertable('fact_product_sales', by_range('time'), if_not_exists => TRUE)
  `);
  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_fact_product_sales_org ON fact_product_sales (organization_id, time DESC)
  `);
  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_fact_product_sales_product ON fact_product_sales (product_id, time DESC)
  `);
  await dataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_fact_product_sales_category ON fact_product_sales (category_id, time DESC)
  `);
  logger.log('Da kiem tra/tao xong hypertable fact_product_sales (Inventory Service).');
}
