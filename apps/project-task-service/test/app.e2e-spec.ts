/**
 * E2E test toi thieu cho Project & Task Service - Technical_Spec.md muc 10:
 * "Integration test | Jest + Supertest | Luong API chinh (dang nhap, tao task, upload file)".
 * Bai IAM (apps/iam-service/test/app.e2e-spec.ts) da bao phu "dang nhap"; bai nay bao phu
 * "tao task" (tao du an -> tao task -> giao viec -> doi trang thai Kanban), la luong quan
 * trong thu 2 duoc lieu ke ten. Truoc ban sua nay KHONG co e2e test nao trong repo cho service nay.
 *
 * Cach chay: `npm run test:e2e -w apps/project-task-service` TU THU MUC GOC REPO (can Postgres
 * cua Project-Task Service + Kafka dang chay va ket noi duoc - xem chu thich chi tiet ben duoi,
 * cung dang gia dinh nhu apps/iam-service/test/app.e2e-spec.ts).
 *
 * KHAC BIET QUAN TRONG so voi bai IAM: service nay KHONG co route @Public() nao (moi endpoint
 * deu di qua InternalAuthGuard toan cuc - APP_GUARD trong app.module.ts). Do dinh tuyen that
 * qua API Gateway (xac thuc JWT + dinh danh nguoi dung) khong nam trong pham vi test nay (chi
 * boot AppModule cua rieng Project-Task Service), request phai TU cung cap dung bo header noi
 * bo ma Gateway le ra se forward (Technical_Spec.md muc 6): `x-internal-secret` (khop
 * INTERNAL_SHARED_SECRET dat o beforeAll ben duoi) + `x-org-id`/`x-user-id`/`x-permissions`.
 *
 * MOI TRUONG GIA DINH: mac dinh tro toi DB/Kafka cua Project-Task Service theo dung cong host
 * trong infra/docker-compose.yml (xem infra/.env): DB_HOST=localhost DB_PORT=5434
 * DB_NAME=project_task_db DB_USER=pt_user DB_PASSWORD=pt_password, KAFKA_BROKER=localhost:9092.
 * Ghi de qua bien moi truong tuong ung neu ha tang cua ban khac di.
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5434';
process.env.DB_NAME = process.env.DB_NAME || 'project_task_db';
process.env.DB_USER = process.env.DB_USER || 'pt_user';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'pt_password';
process.env.KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';
// Bi mat noi bo dung RIENG cho lan chay test nay (khong phu thuoc gia tri that cua moi truong
// dev/production) - guard se fallback ve 1 gia tri dev mac dinh neu bien nay khong duoc dat,
// nhung ta dat tuong minh o day de test khong phu thuoc vao chi tiet noi bo do cua guard.
process.env.INTERNAL_SHARED_SECRET = process.env.INTERNAL_SHARED_SECRET || 'e2e-test-internal-secret';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PERMISSIONS } from '@app/common-dto';
import { AppModule } from '../src/app.module';

const INTERNAL_SECRET = process.env.INTERNAL_SHARED_SECRET;

/** Xay header noi bo ma le ra API Gateway se forward sau khi xac thuc JWT (Technical_Spec.md muc 6). */
function internalHeaders(organizationId: string, userId: string, permissions: string[]) {
  return {
    'x-internal-secret': INTERNAL_SECRET,
    'x-org-id': organizationId,
    'x-user-id': userId,
    'x-user-email': 'e2e-user@demo-sme.vn',
    'x-roles': 'Org Admin',
    'x-permissions': permissions.join(','),
  };
}

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

describe('Project & Task Service - tao du an & tao task (e2e)', () => {
  let app: INestApplication;
  // organizationId/userId gia lap cho lan chay test nay - service nay KHONG co FK vat ly sang
  // IAM (Technical_Spec.md muc 5: "chi luu ID, khong co foreign key vat ly xuyen service"), nen
  // dung UUID hop le bat ky la du de bai test doc lap voi IAM Service that.
  const organizationId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';
  const assigneeId = '33333333-3333-4333-8333-333333333333';

  jest.setTimeout(60_000);

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('tu choi (401) khi thieu header x-internal-secret - chan client bo qua Gateway', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set({ 'x-org-id': organizationId, 'x-user-id': userId })
      .expect(401);
  });

  it('POST /api/v1/projects -> POST /api/v1/tasks: tao du an roi tao task trong du an do', async () => {
    const projectRes = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set(internalHeaders(organizationId, userId, ALL_PERMISSIONS))
      .send({ name: 'E2E Test Project', description: 'Du an tao boi e2e test' })
      .expect(201);

    expect(projectRes.body).toMatchObject({
      id: expect.any(String),
      name: 'E2E Test Project',
      organizationId,
    });
    const projectId = projectRes.body.id;

    const taskRes = await request(app.getHttpServer())
      .post('/api/v1/tasks')
      .set(internalHeaders(organizationId, userId, ALL_PERMISSIONS))
      .send({ projectId, title: 'E2E Test Task' })
      .expect(201);

    expect(taskRes.body).toMatchObject({
      id: expect.any(String),
      projectId,
      title: 'E2E Test Task',
      status: 'TODO',
      organizationId,
    });
    const taskId = taskRes.body.id;

    // GET /api/v1/tasks/:id - xac nhan task vua tao doc lai duoc dung du lieu.
    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/tasks/${taskId}`)
      .set(internalHeaders(organizationId, userId, ALL_PERMISSIONS))
      .expect(200);
    expect(getRes.body).toMatchObject({ id: taskId, title: 'E2E Test Task', status: 'TODO' });

    // Giao viec (task.assigned) - endpoint quan trong de Notification Service co du lieu
    // (xem scripts/seed.js, cung sua trong dot review nay).
    await request(app.getHttpServer())
      .post(`/api/v1/tasks/${taskId}/assignees`)
      .set(internalHeaders(organizationId, userId, ALL_PERMISSIONS))
      .send({ userId: assigneeId })
      .expect(201);

    const afterAssign = await request(app.getHttpServer())
      .get(`/api/v1/tasks/${taskId}`)
      .set(internalHeaders(organizationId, userId, ALL_PERMISSIONS))
      .expect(200);
    // 25/07/2026: findAll()/enrich doi ten truong assigneeIds -> assignees ({ userId }[]) trong
    // mot ban sua truoc do; cap nhat assertion e2e cho khop, tranh test sai voi field da xoa.
    expect(afterAssign.body.assignees).toContainEqual({ userId: assigneeId });

    // Doi trang thai Kanban TODO -> DOING (endpoint quan trong nhat cua pipeline outbox -> Kafka,
    // xem ghi chu trong tasks.controller.ts).
    const statusRes = await request(app.getHttpServer())
      .patch(`/api/v1/tasks/${taskId}/status`)
      .set(internalHeaders(organizationId, userId, ALL_PERMISSIONS))
      .send({ status: 'DOING' })
      .expect(200);
    expect(statusRes.body.status).toBe('DOING');
  });

  it('tu choi (400) khi tao task voi projectId khong dung dinh dang UUID', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/tasks')
      .set(internalHeaders(organizationId, userId, ALL_PERMISSIONS))
      .send({ projectId: 'khong-phai-uuid', title: 'Task khong hop le' })
      .expect(400);
  });

  it('tu choi (403) khi thieu permission task:create (RBAC - PermissionsGuard)', async () => {
    const projectRes = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set(internalHeaders(organizationId, userId, ALL_PERMISSIONS))
      .send({ name: 'E2E Project (khong du quyen tao task)' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/tasks')
      .set(internalHeaders(organizationId, userId, [PERMISSIONS.PROJECT_VIEW])) // thieu task:create
      .send({ projectId: projectRes.body.id, title: 'Se bi tu choi' })
      .expect(403);
  });

  it('cach ly tenant: khong doc duoc task cua to chuc khac du dung UUID hop le (Technical_Spec.md muc 6)', async () => {
    const projectRes = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set(internalHeaders(organizationId, userId, ALL_PERMISSIONS))
      .send({ name: 'E2E Project (kiem tra cach ly tenant)' })
      .expect(201);
    const taskRes = await request(app.getHttpServer())
      .post('/api/v1/tasks')
      .set(internalHeaders(organizationId, userId, ALL_PERMISSIONS))
      .send({ projectId: projectRes.body.id, title: 'Task cua to chuc A' })
      .expect(201);

    const otherOrganizationId = '99999999-9999-4999-8999-999999999999';
    await request(app.getHttpServer())
      .get(`/api/v1/tasks/${taskRes.body.id}`)
      .set(internalHeaders(otherOrganizationId, userId, ALL_PERMISSIONS))
      .expect(404);
  });
});
