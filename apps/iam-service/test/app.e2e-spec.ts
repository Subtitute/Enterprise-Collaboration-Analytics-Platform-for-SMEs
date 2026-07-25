/**
 * E2E test toi thieu cho IAM Service - Technical_Spec.md muc 10:
 * "Integration test | Jest + Supertest | Luong API chinh (dang nhap, tao task, upload file)
 * chay tren DB test (Docker)". Truoc ban sua nay KHONG co bat ky integration/e2e test nao
 * trong toan bo repo. Bai nay uu tien phan "dang nhap" cua yeu cau tren (dang ky to chuc ->
 * dang nhap) vi day la buoc nen tang ma moi luong khac (tao task, upload file...) deu phu
 * thuoc (can accessToken hop le); cac buoc con lai (tao task o project-task-service, upload
 * file o document-service) la ung vien cho bai e2e rieng cua tung service do sau nay.
 *
 * Cach chay: `npm run test:e2e -w apps/iam-service` TU THU MUC GOC REPO.
 *
 * MOI TRUONG GIA DINH (quan trong - doc truoc khi chay):
 * Bai test nay boot THAT SU AppModule cua IAM Service (Test.createTestingModule + AppModule
 * that, khong mock DataSource/Kafka/Redis) nen can ha tang that dang chay va co the ket noi
 * duoc tu moi truong chay Jest:
 *   - PostgreSQL cua IAM Service (bang `synchronize: true` nen KHONG can migrate thu cong -
 *     xem app.module.ts).
 *   - Kafka broker (KafkaProducerService.onModuleInit() goi producer.connect() khi app khoi
 *     tao - se treo/loi neu khong ket noi duoc).
 *   - Redis (dung cho refresh-token blacklist).
 * Gia tri mac dinh cua cac bien moi truong ben duoi KHOP VOI cong host maptrong
 * infra/docker-compose.yml khi chay `docker compose up -d` tu thu muc infra/ (xem infra/.env):
 *   DB_HOST=localhost DB_PORT=5433 DB_NAME=iam_db DB_USER=iam_user DB_PASSWORD=iam_password
 *   KAFKA_BROKER=localhost:9092
 *   REDIS_HOST=localhost REDIS_PORT=6380 REDIS_PASSWORD=redis_password (luu y: host port cua
 *   Redis la 6380 khong phai 6379 mac dinh - xem chu thich trong infra/docker-compose.yml,
 *   may host co the da co Redis khac o cong 6379).
 * Neu ha tang cua ban chay o dia chi khac, ghi de qua bien moi truong tuong ung TRUOC khi chay
 * `npm run test:e2e -w apps/iam-service`, vi du (PowerShell):
 *   $env:DB_PORT=5433; $env:KAFKA_BROKER="localhost:9092"; npm run test:e2e -w apps/iam-service
 * Bai test dung du lieu ngau nhien (email/ten to chuc co suffix timestamp) nen co the chay lap
 * lai an toan tren cung 1 DB dang duoc iam-service (container that) su dung dong thoi - khong
 * xoa/reset du lieu co san.
 */

// Dat bien moi truong TRUOC khi import AppModule (ConfigModule.forRoot({load:[configuration]})
// doc process.env NGAY LUC module duoc compile trong Test.createTestingModule().compile(),
// khong phai luc file duoc import) - dung `??=` kieu gan co dieu kien de khong ghi de neu nguoi
// chay da tu set bien moi truong truoc do.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5433';
process.env.DB_NAME = process.env.DB_NAME || 'iam_db';
process.env.DB_USER = process.env.DB_USER || 'iam_user';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'iam_password';
process.env.KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6380';
process.env.REDIS_PASSWORD = process.env.REDIS_PASSWORD || 'redis_password';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'change_me_access_secret_dev_only';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'change_me_refresh_secret_dev_only';
process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';

/** Ten cookie httpOnly chua refresh token - phai khop REFRESH_TOKEN_COOKIE trong auth.controller.ts. */
const REFRESH_TOKEN_COOKIE = 'ecap_refresh_token';

function findCookie(setCookieHeader: string | string[] | undefined, name: string): string | undefined {
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader ? [setCookieHeader] : [];
  return cookies.find((c) => c.startsWith(`${name}=`));
}

describe('IAM Service - dang ky to chuc & dang nhap (e2e)', () => {
  let app: INestApplication;

  // 60s - boot Kafka producer connect() + PostgreSQL connect() that su co the mat vai giay,
  // lau hon nhieu so voi mac dinh 5s cua Jest cho beforeAll.
  jest.setTimeout(60_000);

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    // Phai lap lai dung cau hinh cua main.ts (KHONG duoc goi qua NestFactory.create/bootstrap()
    // trong test) de hanh vi request/response giong het production: helmet, cookie-parser (doc
    // refresh token tu httpOnly cookie), tien to /api/v1 va ValidationPipe (whitelist + transform)
    // - thieu buoc nay se lam sai lech ca route path lan cach DTO validate/transform so voi that.
    app.use(helmet());
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.enableCors({ origin: 'http://localhost:5173', credentials: true });

    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('POST /api/v1/auth/register-organization -> tao to chuc moi, tra ve accessToken + user + organization', async () => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    const adminEmail = `e2e-admin-${suffix}@demo-sme.vn`;

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register-organization')
      .send({
        organizationName: `E2E Test Org ${suffix}`,
        adminFullName: 'E2E Test Admin',
        adminEmail,
        adminPassword: 'Password123!',
      })
      .expect(201);

    expect(res.body).toMatchObject({
      accessToken: expect.any(String),
      user: {
        email: adminEmail,
        fullName: 'E2E Test Admin',
      },
      organization: {
        id: expect.any(String),
        name: `E2E Test Org ${suffix}`,
      },
    });
    // Mat khau/hash TUYET DOI khong duoc lo ra response (Technical_Spec.md muc 9 - bao mat).
    expect(res.body.user.passwordHash).toBeUndefined();

    // Refresh token KHONG con nam trong JSON body - duoc set qua httpOnly cookie thay the
    // (auth.controller.ts, Technical_Spec.md muc 6, bo sung 21/07/2026) de chong XSS doc cap token.
    expect(res.body.refreshToken).toBeUndefined();
    const refreshCookie = findCookie(res.headers['set-cookie'], REFRESH_TOKEN_COOKIE);
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/HttpOnly/i);
  });

  it('dang ky roi dang nhap thanh cong voi dung email/mat khau vua tao (luong "dang nhap" - Technical_Spec.md muc 10)', async () => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    const adminEmail = `e2e-login-${suffix}@demo-sme.vn`;
    const adminPassword = 'Password123!';

    await request(app.getHttpServer())
      .post('/api/v1/auth/register-organization')
      .send({
        organizationName: `E2E Login Org ${suffix}`,
        adminFullName: 'E2E Login Admin',
        adminEmail,
        adminPassword,
      })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(200);

    expect(loginRes.body).toMatchObject({
      accessToken: expect.any(String),
      user: { email: adminEmail },
    });
    expect(loginRes.body.refreshToken).toBeUndefined();
    expect(findCookie(loginRes.headers['set-cookie'], REFRESH_TOKEN_COOKIE)).toBeDefined();
  });

  it('dang nhap that bai (401) khi sai mat khau', async () => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    const adminEmail = `e2e-badlogin-${suffix}@demo-sme.vn`;

    await request(app.getHttpServer())
      .post('/api/v1/auth/register-organization')
      .send({
        organizationName: `E2E Bad Login Org ${suffix}`,
        adminFullName: 'E2E Bad Login Admin',
        adminEmail,
        adminPassword: 'Password123!',
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: 'Sai-Mat-Khau-123' })
      .expect(401);

    expect(res.body.error).toBeDefined();
  });

  // 25/07/2026: bai bad-login truoc do (ngay tren) chi test nhanh "email TON TAI nhung sai mat
  // khau" cua login() - chua bao gio goi toi nhanh "email KHONG TON TAI" (`!user`), tuc la chua
  // bao gio thuc su chay qua nhanh DUMMY_PASSWORD_HASH (timing-normalization, xem chu thich dau
  // auth.service.ts). Bai nay xac nhan ca 2 dieu kien cung luc: (1) email khong ton tai van tra ve
  // CUNG 1 status code (401) va CUNG 1 thong diep loi chung chung "Email hoac mat khau khong dung"
  // nhu nhanh sai-mat-khau o tren - KHONG duoc phep lo ra 1 status/message khac (vd 404 "khong tim
  // thay nguoi dung") vi dieu do se cho ke tan cong biet ngay email nao TON TAI trong he thong ma
  // khong can do timing; (2) request van hoan tat binh thuong (khong throw/crash) du user = null,
  // xac nhan nhanh `await bcrypt.compare(dto.password, DUMMY_PASSWORD_HASH)` thuc su duoc thuc thi
  // thay vi bi bo qua truoc khi tra loi.
  it('dang nhap that bai (401) voi CUNG thong diep loi chung chung khi email KHONG TON TAI (nhanh DUMMY_PASSWORD_HASH) - review 25/07/2026', async () => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    const nonexistentEmail = `e2e-nonexistent-${suffix}@demo-sme.vn`;
    const realEmail = `e2e-badlogin-cmp-${suffix}@demo-sme.vn`;

    // Dang ky 1 tai khoan THAT de lam doi chung cho nhanh "email TON TAI nhung sai mat khau" -
    // phai la 1 user THAT trong DB (khong phai 1 email nguoc doi khac) de phep so sanh nay co y
    // nghia: xac nhan nhanh "khong ton tai" (test chinh ben duoi) tra ve HET SUC giong nhanh "ton
    // tai nhung sai mat khau" (da test o bai ngay tren, lap lai o day de doi chieu status/message
    // truc tiep trong CUNG 1 bai).
    await request(app.getHttpServer())
      .post('/api/v1/auth/register-organization')
      .send({
        organizationName: `E2E Badlogin Cmp Org ${suffix}`,
        adminFullName: 'E2E Badlogin Cmp Admin',
        adminEmail: realEmail,
        adminPassword: 'Password123!',
      })
      .expect(201);

    const wrongPasswordRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: realEmail, password: 'Sai-Mat-Khau-Khac-123' })
      .expect(401);

    const nonexistentRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: nonexistentEmail, password: 'Password123!' })
      .expect(401);

    expect(nonexistentRes.body.error).toBeDefined();
    // Cung 1 status code (401) va CUNG 1 message chung chung cho ca 2 nhanh "email khong ton tai"
    // va "email ton tai nhung sai mat khau" - khong duoc phep phan biet duoc email nao ton tai.
    expect(nonexistentRes.status).toBe(wrongPasswordRes.status);
    expect(nonexistentRes.body.message).toEqual(wrongPasswordRes.body.message);
    expect(nonexistentRes.body.message).toEqual('Email hoac mat khau khong dung');
  });

  it('dang ky that bai (409) khi email da duoc dung boi 1 to chuc khac', async () => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    const adminEmail = `e2e-duplicate-${suffix}@demo-sme.vn`;
    const payload = {
      organizationName: `E2E Duplicate Org ${suffix}`,
      adminFullName: 'E2E Duplicate Admin',
      adminEmail,
      adminPassword: 'Password123!',
    };

    await request(app.getHttpServer()).post('/api/v1/auth/register-organization').send(payload).expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/register-organization')
      .send({ ...payload, organizationName: `${payload.organizationName} (lan 2)` })
      .expect(409);
  });

  it('dang ky that bai (400) khi thieu truong bat buoc (validation DTO - class-validator)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register-organization')
      .send({ organizationName: 'Thieu cac truong khac' })
      .expect(400);
  });

  // 22/07/2026 (Fix 1, CRITICAL, review 22/07/2026): dang nhap -> dang xuat -> replay LAI DUNG
  // cookie refresh token cu vao /auth/refresh -> ky vong 401. Day la bai kiem chung "logout() thuc
  // su thu hoi session" ma truoc do KHONG co test nao bao ve - loi goc la logout() doc token tu
  // request body (1 chuoi placeholder do frontend gui, vi frontend khong nam giu refresh token
  // that) thay vi tu httpOnly cookie nhu refresh() nen authService.logout() luon nhan 1 token gia,
  // verifyAsync() luon that bai, bi catch nuot loi va coi nhu "da dang xuat" MA KHONG BAO GIO goi
  // toi revokeRefreshToken() - session khong bao gio thuc su bi thu hoi. Test nay dung dung
  // luong that qua HTTP (khong mock JwtService/DB) nen se BAT DUOC ca loi o tang controller (Fix 1)
  // lan loi rotation khong nguyen tu o tang service (Fix 3, xem ghi chu duoi).
  it('dang nhap roi dang xuat -> refresh token cu bi thu hoi that su (401 khi replay) - Fix 1', async () => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    const adminEmail = `e2e-logout-${suffix}@demo-sme.vn`;
    const adminPassword = 'Password123!';

    await request(app.getHttpServer())
      .post('/api/v1/auth/register-organization')
      .send({
        organizationName: `E2E Logout Org ${suffix}`,
        adminFullName: 'E2E Logout Admin',
        adminEmail,
        adminPassword,
      })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(200);

    const setCookieHeader = findCookie(loginRes.headers['set-cookie'], REFRESH_TOKEN_COOKIE);
    expect(setCookieHeader).toBeDefined();
    // Set-Cookie tra ve ca thuoc tinh (Path=..., HttpOnly, SameSite=...) - chi lay dung phan
    // "ten=gia-tri" dau tien de gui lai dung dinh dang header Cookie cua request.
    const refreshCookiePair = (setCookieHeader as string).split(';')[0];

    // Dang xuat: gui KEM cookie httpOnly that (khong gui refreshToken qua body nhu client that
    // khong con nam giu token that - xem chu thich logout() trong auth.controller.ts) - phai tra
    // 204 va cookie response phai la lenh xoa cookie (Max-Age=0 hoac Expires trong qua khu).
    const logoutRes = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', refreshCookiePair)
      .expect(204);
    expect(findCookie(logoutRes.headers['set-cookie'], REFRESH_TOKEN_COOKIE)).toMatch(
      new RegExp(`${REFRESH_TOKEN_COOKIE}=;`),
    );

    // Replay: dung LAI DUNG cookie refresh token da bi dang xuat -> phai bi tu choi 401 (session
    // da thuc su bi thu hoi trong Postgres + Redis blacklist, khong con "song sot" duoc nua). Truoc
    // Fix 1, buoc nay se sai vi logout() chua bao gio thu hoi token that su (van tra 200 + cap
    // token moi thay vi 401).
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookiePair)
      .expect(401);
  });
});
