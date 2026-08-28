import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DomainEvent } from '@app/common-dto';

/**
 * 25/07/2026 (Fix 2 - Major, audit): kieu dung chung cho tham so `runner` cua tung ham ghi o
 * duoi - cho phep goi qua DataSource (mac dinh, khi ghi doc lap ngoai transaction) HOAC qua
 * EntityManager cua 1 transaction Postgres dang mo (`dataSource.transaction(async (manager) =>
 * ...)`, xem KafkaConsumerService.handleEvent()) ma khong can 2 overload rieng - ca DataSource
 * lan EntityManager cua TypeORM deu co phuong thuc `query(sql, params)` cung chu ky.
 */
type QueryExecutor = Pick<DataSource, 'query'>;

/**
 * Ghi du lieu tho tu Kafka event vao 3 hypertable cua TimescaleDB (infra/timescale-init/001-init.sql).
 * Dung raw SQL tham so hoa qua DataSource.query - KHONG dung TypeORM entity/repository vi hypertable
 * khong map duoc vao ORM entity model (xem ghi chu trong app.module.ts).
 *
 * 28/07/2026: bo sung upsertUserDepartment() - ghi vao dim_user, 1 bang LOOKUP THUAN (khong phai
 * hypertable) cho tinh nang KPI theo phong ban. Xem ghi chu rieng tren chinh ham do ve ly do bang
 * nay KHONG theo pattern idempotent "ON CONFLICT (time, event_id)" nhu 3 ham hypertable duoi day.
 *
 * Moi INSERT deu dung `ON CONFLICT (time, event_id) DO NOTHING` de idempotent theo eventId: neu
 * OutboxPublisherJob phia producer publish trung 1 message (Technical_Spec.md muc 4.1 - gioi han
 * da biet), ban ghi thu 2 se bi bo qua thay vi tao du lieu trung lap trong bao cao KPI.
 *
 * 22/07/2026: cac ham o day KHONG tu bat loi Postgres (khong try/catch) - moi loi (tam thoi
 * hay vinh vien/du lieu sai) deu duoc de nguyen bubble len cho KafkaConsumerService.handleEvent()
 * phan loai va quyet dinh rethrow (retry) hay log-and-skip (poison pill), giu dung 1 noi duy
 * nhat so huu chinh sach retry/skip thay vi rai rac o ca 2 lop (xem kafka-consumer.service.ts).
 *
 * 25/07/2026 (Fix 2 - Major, audit): tung ham nhan them tham so `runner` TUY CHON, mac dinh la
 * `this.dataSource` (giu nguyen hanh vi cu khi goi doc lap). KafkaConsumerService.handleEvent()
 * gio boc nhieu loi goi lien tiep (vd recordUserActivity() + recordTaskEvent()) cho CUNG 1 event
 * trong 1 transaction DUY NHAT bang cach truyen EntityManager cua transaction do lam `runner` -
 * xem ghi chu chi tiet trong kafka-consumer.service.ts ve loi WebSocket push bi mat vinh vien ma
 * fix nay xu ly.
 */
@Injectable()
export class FactWriterService {
  private readonly logger = new Logger(FactWriterService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Luon ghi - phuc vu feed "Hoat dong gan day" (GET /analytics/recent-activity).
   *
   * 22/07/2026: them `RETURNING event_id` va tra ve boolean (co ghi duoc dong MOI hay khong)
   * de KafkaConsumerService.handleEvent() biet duoc day co phai lan XU LY DAU TIEN cua eventId
   * nay hay khong. Truoc fix nay ham tra ve void nen consumer luon goi emitActivity() ke ca khi
   * `ON CONFLICT DO NOTHING` da am tham bo qua 1 ban ghi trung (OutboxPublisherJob phia producer
   * publish lai cung 1 event - Technical_Spec.md muc 4.1) - lam WebSocket push mat idempotent
   * trong khi du lieu da luu (fact table) van dung, khac voi notifications.service.ts (Mongo)
   * da xu ly dung truong hop nay tu truoc.
   *
   * 25/07/2026 (Fix 2 - Major, audit): them tham so `runner` tuy chon (mac dinh `this.dataSource`)
   * - xem ghi chu Fix 2 o dau file. KafkaConsumerService truyen EntityManager cua 1 transaction
   * dang mo vao day khi can gop ham nay voi recordTaskEvent()/recordDocumentEvent() thanh 1 don
   * vi atomic cho cung 1 event.
   */
  async recordUserActivity(event: DomainEvent, runner: QueryExecutor = this.dataSource): Promise<boolean> {
    const rows = await runner.query(
      `
      INSERT INTO fact_user_activity (time, event_id, organization_id, event_type, producer, actor_id, payload)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (time, event_id) DO NOTHING
      RETURNING event_id
      `,
      [
        event.occurredAt,
        event.eventId,
        event.organizationId,
        event.eventType,
        event.producer,
        extractString(event, 'actorId'),
        JSON.stringify(event.payload ?? {}),
      ],
    );
    return rows.length > 0;
  }

  /**
   * eventType bat dau bang "task." hoac "project." - Technical_Spec.md muc 4.3 (payload cac loai event).
   * 22/07/2026: tra ve boolean (co ghi duoc dong MOI hay khong) cung ly do nhu recordUserActivity() o tren.
   * 25/07/2026 (Fix 2 - Major, audit): them tham so `runner` tuy chon, cung ly do nhu recordUserActivity() o tren.
   * 28/07/2026: them cot assignee_id (nguoi duoc GAN task, chi co gia tri o event `task.assigned`
   * theo TaskAssignedPayload - null o cac event khac) - phuc vu KPI theo phong ban (JOIN voi
   * dim_user.user_id de biet task duoc gan cho user thuoc phong ban nao, xem AnalyticsService).
   */
  async recordTaskEvent(event: DomainEvent, runner: QueryExecutor = this.dataSource): Promise<boolean> {
    const rows = await runner.query(
      `
      INSERT INTO fact_task_events (time, event_id, organization_id, event_type, project_id, task_id, from_status, to_status, actor_id, assignee_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (time, event_id) DO NOTHING
      RETURNING event_id
      `,
      [
        event.occurredAt,
        event.eventId,
        event.organizationId,
        event.eventType,
        extractString(event, 'projectId'),
        extractString(event, 'taskId'),
        extractString(event, 'fromStatus'),
        extractString(event, 'toStatus'),
        extractString(event, 'actorId'),
        extractString(event, 'assigneeId'),
      ],
    );
    return rows.length > 0;
  }

  /**
   * eventType bat dau bang "document."
   * 22/07/2026: tra ve boolean (co ghi duoc dong MOI hay khong) cung ly do nhu recordUserActivity() o tren.
   * 25/07/2026 (Fix 2 - Major, audit): them tham so `runner` tuy chon, cung ly do nhu recordUserActivity() o tren.
   */
  async recordDocumentEvent(event: DomainEvent, runner: QueryExecutor = this.dataSource): Promise<boolean> {
    const rows = await runner.query(
      `
      INSERT INTO fact_document_events (time, event_id, organization_id, event_type, file_id, folder_id, actor_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (time, event_id) DO NOTHING
      RETURNING event_id
      `,
      [
        event.occurredAt,
        event.eventId,
        event.organizationId,
        event.eventType,
        extractString(event, 'fileId'),
        extractString(event, 'folderId'),
        extractString(event, 'actorId'),
      ],
    );
    return rows.length > 0;
  }

  /**
   * 28/07/2026: upsert dim_user tu event `iam.user.registered` (UserRegisteredPayload, mang san
   * departmentId ban dau) hoac `iam.user.department_changed` (UserDepartmentChangedPayload, phat
   * khi PATCH /users/:id doi phong ban CUA USER DA TON TAI, HOAC ban resync dinh ky luc IAM
   * Service khoi dong lai - xem KafkaConsumerService.handleEvent()).
   *
   * dim_user KHONG co cot time/event_id nen KHONG tham gia duoc pattern idempotent
   * "ON CONFLICT (time, event_id) DO NOTHING" nhu 3 ham hypertable o tren - thay vao do dung
   * chinh "ON CONFLICT (user_id) DO UPDATE" lam co che idempotent RIENG cua bang nay: du day la
   * lan phat DAU TIEN hay 1 ban RE-SYNC lap lai (an toan replay theo thiet ke cua IAM Service),
   * ket qua cuoi cung LUON la trang thai HIEN TAI cua user (last-write-wins) - dung y do, vi bang
   * nay chi luu SNAPSHOT hien tai chu khong phai 1 log lich su nhu cac fact table kia.
   *
   * 26/08/2026 (fix audit - Minor/Major, race co the xay ra): "last-write-wins" o tren truoc day
   * la last-write-wins theo THU TU XU LY THUC TE (updated_at = now() luc consumer chay), KHONG
   * phai theo THU TU PHAT SINH cua event (event.occurredAt) - neu 2 event USER_DEPARTMENT_CHANGED
   * cho CUNG 1 user bi Kafka giao KHONG DUNG THU TU (vd retry/redeliver sau 1 loi tam thoi o
   * KafkaConsumerService khien event cu hon duoc xu ly LAI sau event moi hon), ban ghi dim_user co
   * the ket thuc voi phong ban SAI (tu event CU, ghi de len ket qua DUNG cua event MOI da ap dung
   * truoc do). Them cot `last_event_at` (schema-bootstrap.ts, luu event.occurredAt CUA LAN GHI GAN
   * NHAT - khac updated_at chi la thoi diem ghi theo dong ho he thong) va dung 1 CAU LENH SQL DUY
   * NHAT "INSERT ... ON CONFLICT DO UPDATE ... WHERE" de kiem tra thu tu MOT CACH NGUYEN TU (atomic)
   * ngay trong Postgres - tranh race giua "SELECT kiem tra truoc" va "UPDATE sau" neu tach thanh 2
   * cau lenh rieng. Neu event.occurredAt CU HON hoac BANG last_event_at da luu, menh de WHERE sai
   * nen UPDATE khong duoc ap dung (RETURNING khong tra ve hang nao) - log debug va bo qua, KHONG
   * throw (day KHONG phai loi ha tang, chi la 1 event den KHONG DUNG THU TU, retry lai cung vo ich).
   */
  async upsertUserDepartment(event: DomainEvent, runner: QueryExecutor = this.dataSource): Promise<void> {
    const rows = await runner.query(
      `
      INSERT INTO dim_user (user_id, organization_id, department_id, updated_at, last_event_at)
      VALUES ($1, $2, $3, now(), $4)
      ON CONFLICT (user_id) DO UPDATE SET department_id = EXCLUDED.department_id, updated_at = now(), last_event_at = EXCLUDED.last_event_at
      WHERE dim_user.last_event_at IS NULL OR EXCLUDED.last_event_at > dim_user.last_event_at
      RETURNING user_id
      `,
      [
        extractString(event, 'userId'),
        event.organizationId,
        extractString(event, 'departmentId'),
        event.occurredAt,
      ],
    );
    if (rows.length === 0) {
      // 26/08/2026: xem ghi chu Fix ordering o tren - hang KHONG duoc UPDATE vi event.occurredAt
      // cu hon/bang last_event_at da luu (event den KHONG DUNG THU TU, vd bi Kafka redeliver sau
      // 1 event moi hon da xu ly truoc do).
      this.logger.debug(
        `Bo qua upsertUserDepartment cho event CU hon last_event_at da luu (userId=${extractString(event, 'userId')}, eventId=${event.eventId}, occurredAt=${event.occurredAt}).`,
      );
    }
  }
}

/**
 * Lay 1 truong string tu payload neu co, tra ve null neu khong ton tai/khac kieu du lieu -
 * khong phai event nao cung co du moi truong (vd TaskCreatedPayload khong co fromStatus/toStatus).
 */
function extractString(event: DomainEvent, field: string): string | null {
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  const value = payload[field];
  return typeof value === 'string' ? value : null;
}
