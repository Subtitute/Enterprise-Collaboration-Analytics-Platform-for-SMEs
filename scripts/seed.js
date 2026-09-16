// 2026-07-18: Script seed du lieu demo cho toan bo nen tang (General_idea.md muc 9 - giam thieu
// rui ro "du lieu demo khong du phong phu"). Chay sau khi `docker compose up` da khoi dong xong
// toan bo he thong (hoac cac service chay o local qua `npm run dev:*`).
//
// Cach chay:  npm run seed   (tu thu muc goc repo)
// Yeu cau bien moi truong SEED_API_BASE_URL (mac dinh http://localhost:3000/api/v1).
//
// 2026-07-21: Lam giau du lieu seed (code review - Doc/General_idea.md muc 9, Doc/Technical_Spec.md
// muc 10) de dashboard/KPI "co y nghia" hon khi demo:
//   1. Moi task tao ra deu duoc giao (assign) cho 1 nhan vien ngau nhien -> phat that su su kien
//      `task.assigned`, giup Notification Service co du lieu de hien thi (truoc day khong bao gio
//      goi endpoint assign nen Notification Service demo luon trong).
//   2. Them buoc upload vai tai lieu mau (text/CSV sinh trong bo nho, khong can asset nhi phan
//      that) vao 1 thu muc rieng cho tung du an, qua Document Service - giup "Hoat dong tai lieu"
//      tren Analytics co du lieu that va bucket MinIO khong con trong rong.
//   3. Them 1 buoc BO SUNG (xem seedHistoricalAnalyticsData ben duoi) noi TRUC TIEP vao TimescaleDB
//      de tao lich su ~8 tuan cho bieu do xu huong - xem chu thich chi tiet o buoc do ve ly do
//      khong the/khong nen lam dieu nay qua API cong khai.

const crypto = require('crypto');

const API_BASE_URL = process.env.SEED_API_BASE_URL || 'http://localhost:3000/api/v1';

const DEPARTMENTS = ['Kinh doanh', 'Kỹ thuật', 'Nhân sự', 'Marketing'];

const EMPLOYEES = [
  { fullName: 'Nguyen Van An', email: 'an.nguyen@demo-sme.vn' },
  { fullName: 'Tran Thi Binh', email: 'binh.tran@demo-sme.vn' },
  { fullName: 'Le Van Chi', email: 'chi.le@demo-sme.vn' },
  { fullName: 'Pham Thi Dung', email: 'dung.pham@demo-sme.vn' },
  { fullName: 'Hoang Van Duc', email: 'duc.hoang@demo-sme.vn' },
  { fullName: 'Vu Thi Em', email: 'em.vu@demo-sme.vn' },
  { fullName: 'Do Van Phong', email: 'phong.do@demo-sme.vn' },
  { fullName: 'Ngo Thi Giang', email: 'giang.ngo@demo-sme.vn' },
];

const PROJECTS = [
  { name: 'Website ban hang SME', description: 'Xay dung website thuong mai dien tu cho SME' },
  { name: 'Trien khai CRM noi bo', description: 'Trien khai he thong CRM quan ly khach hang' },
  { name: 'Nang cap ha tang Docker', description: 'Container hoa toan bo he thong noi bo' },
  { name: 'Ung dung di dong ban hang', description: 'Xay dung app mobile ho tro nhan vien kinh doanh' },
  { name: 'He thong bao cao KPI', description: 'Xay dung dashboard bao cao KPI noi bo cho ban giam doc' },
];

const TASK_TITLES = [
  'Thiet ke giao dien trang chu',
  'Tich hop cong thanh toan',
  'Viet tai lieu API',
  'Kiem thu chuc nang dang nhap',
  'Toi uu hoa truy van co so du lieu',
  'Chuan bi bao cao tien do tuan',
  'Ra soat bao mat API',
  'Toi uu hoa hieu nang frontend',
  'Xay dung quy trinh CI/CD',
  'Dao tao nhan vien moi',
];

// 25/07/2026: to chuc demo CO DINH (khong con hau to timestamp trong ten/email admin) - xem main()
// de biet cach script PHAT HIEN to chuc nay da ton tai tu lan chay truoc (API tra ve 409 Conflict
// tren adminEmail) va TAI SU DUNG (dang nhap lai) thay vi luon tao to chuc moi. Truoc day moi lan
// `npm run seed` deu tao 1 to chuc rieng voi ten/email co hau to Date.now() - neu script that bai
// giua chung (vi du fetchWithRetry() het luot thu lai do 429), to chuc partial do bi "mo coi" vinh
// vien (khong co duong phuc hoi) va lan chay lai ke tiep chi tao THEM 1 to chuc moi khac thay vi
// tiep tuc/thay the to chuc loi (loi MAJOR, audit 25/07/2026).
const DEMO_ORG_NAME = 'Demo SME (Seed Script)';
const DEMO_ADMIN_EMAIL = 'admin@demo-sme.vn';
const DEMO_ADMIN_PASSWORD = 'Password123!';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Script nay lam giau du lieu seed nen sinh ra rat nhieu request lien tiep (tao task, giao
 * viec, doi trang thai, upload tai lieu...) - de dang vuot nguong rate-limit mac dinh cua
 * Gateway (100 request/60s theo organizationId+IP - xem apps/gateway/src/rate-limit). Thay vi
 * gia dinh 1 con so cu the (co the khac nhau giua cac moi truong), tu dong cho va thu lai khi
 * gap 429 TooManyRequestsException - giup script chay xong on dinh du toc do Gateway rate-limit
 * cau hinh the nao.
 */
async function fetchWithRetry(url, options) {
  const maxRetries = 8;
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(url, options);
    if (res.status !== 429 || attempt >= maxRetries) return res;
    const delayMs = Math.min(2000 * (attempt + 1), 15000);
    console.warn(
      `  (429 - Gateway rate-limit, doi ${Math.round(delayMs / 1000)}s roi thu lai - lan ${attempt + 1}/${maxRetries})`,
    );
    await sleep(delayMs);
  }
}

async function apiCall(path, options = {}) {
  const res = await fetchWithRetry(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    // 25/07/2026: dinh kem res.status vao Error (thay vi chi nhet vao chuoi message) - de noi goi
    // (vd main() khi dang ky to chuc demo) co the phan biet ro rang 409 Conflict (to chuc/email da
    // ton tai - can tai su dung) voi cac loi khac (can nem lai nguyen ven), khong phai parse chuoi.
    const err = new Error(`${options.method || 'GET'} ${path} -> ${res.status}: ${JSON.stringify(body)}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

/**
 * Upload multipart/form-data - KHONG dat header Content-Type thu cong (khac apiCall()):
 * global fetch/FormData cua Node 20 tu sinh boundary dung chuan, tu dat lai se lam hong request.
 */
async function uploadFile(path, { headers = {}, formData }) {
  const res = await fetchWithRetry(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`POST ${path} (upload) -> ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Sinh 2-4 tai lieu mau (noi dung sinh trong bo nho, khong can asset nhi phan that) cho 1 du an. */
function buildSampleDocuments(project) {
  const count = randomInt(2, 4);
  const docs = [];
  const today = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < count; i += 1) {
    if (i % 2 === 0) {
      docs.push({
        filename: `bao-cao-tien-do-${i + 1}.txt`,
        mimeType: 'text/plain',
        content:
          `Bao cao tien do du an: ${project.name}\n` +
          `Ngay cap nhat: ${today}\n` +
          `Mo ta: ${project.description}\n` +
          `Trang thai tong quan: dang trien khai theo ke hoach.\n`,
      });
    } else {
      docs.push({
        filename: `du-lieu-cong-viec-${i + 1}.csv`,
        mimeType: 'text/csv',
        content:
          'task,gio_lam,trang_thai\n' +
          `Thiet ke,${randomInt(4, 12)},DOING\n` +
          `Kiem thu,${randomInt(2, 8)},TODO\n` +
          `Trien khai,${randomInt(6, 16)},DONE\n`,
      });
    }
  }
  return docs;
}

async function main() {
  console.log(`Seeding vao ${API_BASE_URL} ...`);

  // 25/07/2026: suffix chi con dung cho EMAIL NHAN VIEN ben duoi (De script van chay lai duoc
  // nhieu lan tren CUNG 1 to chuc ma khong trung email nhan vien voi lan chay truoc) - KHONG con
  // dung cho ten to chuc/email admin (xem khoi try/catch ben duoi va hang so DEMO_ORG_NAME/
  // DEMO_ADMIN_EMAIL dau file).
  const suffix = Date.now().toString().slice(-6);
  const adminEmail = DEMO_ADMIN_EMAIL;
  const adminPassword = DEMO_ADMIN_PASSWORD;

  // 25/07/2026: dang ky to chuc demo CO DINH (ten/email khong con hau to timestamp). Neu to chuc
  // nay da ton tai tu lan chay truoc (API tra ve 409 Conflict do adminEmail da duoc dung), TAI SU
  // DUNG bang cach dang nhap lai thay vi de loi lam hong script hoac (nhu truoc day) tao them 1 to
  // chuc "mo coi" moi - dam bao mot lan chay giua chung that bai KHONG lam ro ri to chuc partial
  // khong co duong phuc hoi, va script THAT SU idempotent o cap to chuc/admin (xem chu thich
  // DEMO_ORG_NAME dau file).
  let registerRes;
  try {
    registerRes = await apiCall('/auth/register-organization', {
      method: 'POST',
      body: JSON.stringify({
        organizationName: DEMO_ORG_NAME,
        adminFullName: 'Quan Tri Vien Demo',
        adminEmail,
        adminPassword,
      }),
    });
    console.log(`Da tao to chuc moi "${registerRes.organization.name}" - Org Admin: ${adminEmail}`);
  } catch (err) {
    if (err.status !== 409) throw err;
    console.log(
      `To chuc demo "${DEMO_ORG_NAME}" da ton tai tu lan chay truoc (adminEmail trung) - dang nhap ` +
        'lai de tai su dung thay vi tao to chuc moi...',
    );
    const loginRes = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    // 25/07/2026: /auth/login khong tra ve ten to chuc (chi tra { accessToken, user }, user.organizationId
    // - xem AuthService.login()/toPublicUser() apps/iam-service) nen dung lai DEMO_ORG_NAME hang so o
    // day cho phan hien thi/log; organizationId that su van lay dung tu user.organizationId da dang nhap.
    registerRes = {
      accessToken: loginRes.accessToken,
      user: loginRes.user,
      organization: { id: loginRes.user.organizationId, name: DEMO_ORG_NAME },
    };
    console.log(`Da dang nhap lai to chuc demo hien co - Org Admin: ${adminEmail}`);
  }
  const { accessToken } = registerRes;
  const organizationId = registerRes.organization.id;
  const authHeaders = { Authorization: `Bearer ${accessToken}` };

  const departments = [];
  for (const name of DEPARTMENTS) {
    const dept = await apiCall('/departments', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name }),
    });
    departments.push(dept);
  }
  console.log(`Da tao ${departments.length} phong ban`);

  const roles = await apiCall('/roles', { headers: authHeaders });
  const employeeRole = roles.find((r) => r.name === 'Employee');

  // Luu lai user duoc tra ve (co id) - CAN THIET de sau nay giao (assign) task cho nhan vien
  // that su qua API, thay vi chi "moi cho co" roi bo qua ket qua nhu ban truoc.
  const employees = [];
  for (const emp of EMPLOYEES) {
    // Email phai duy nhat TOAN CUC (UsersService.invite() kiem tra trung email khong loc theo
    // organizationId - shared-schema multi-tenant), khong chi trong pham vi 1 to chuc. Them
    // suffix ${suffix} cua lan chay nay (giong adminEmail o tren) de script THAT SU re-runnable
    // nhieu lan tren cung 1 DB, thay vi chi org/admin duy nhat con nhan vien thi bi trung email
    // voi lan chay truoc va lam hong ca script (409 Conflict).
    const email = emp.email.replace('@demo-sme.vn', `+${suffix}@demo-sme.vn`);
    const created = await apiCall('/users/invite', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        email,
        fullName: emp.fullName,
        initialPassword: adminPassword,
        departmentId: randomFrom(departments).id,
        roleIds: employeeRole ? [employeeRole.id] : [],
      }),
    });
    employees.push(created);
  }
  console.log(`Da moi ${employees.length} nhan vien (mat khau: ${adminPassword})`);

  // Nguon nguoi dung co the giao viec / lam actor: nhan vien + chinh Org Admin (thuc te Org
  // Admin cung thuong tu nhan task nho trong doanh nghiep SME).
  const assignablePool = [...employees, registerRes.user];

  const projectIds = [];
  const folderIds = [];
  let totalTasks = 0;
  let totalFiles = 0;

  for (const proj of PROJECTS) {
    const project = await apiCall('/projects', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(proj),
    });
    projectIds.push(project.id);

    // --- Thu muc + tai lieu mau cho du an (Document Activity analytics + MinIO khong con trong) ---
    const folder = await apiCall('/folders', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: `${project.name} - Tai lieu` }),
    });
    folderIds.push(folder.id);

    const sampleDocs = buildSampleDocuments(project);
    for (const doc of sampleDocs) {
      const formData = new FormData();
      const blob = new Blob([doc.content], { type: doc.mimeType });
      formData.append('file', blob, doc.filename);
      formData.append('folderId', folder.id);
      await uploadFile('/files/upload', { headers: authHeaders, formData });
      totalFiles += 1;
    }

    // --- Cong viec cua du an ---
    const taskCount = randomInt(6, 10);
    for (let i = 0; i < taskCount; i += 1) {
      const task = await apiCall('/tasks', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          projectId: project.id,
          title: `${randomFrom(TASK_TITLES)} #${i + 1}`,
        }),
      });
      totalTasks += 1;

      // Luon giao (assign) task cho 1 nhan vien ngau nhien -> phat that su su kien
      // `task.assigned` qua Outbox/Kafka, de Notification Service co du lieu demo (truoc day
      // task khong bao gio duoc assign qua seed script nen Notification Service luon trong).
      const assignee = randomFrom(assignablePool);
      await apiCall(`/tasks/${task.id}/assignees`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ userId: assignee.id }),
      });

      // Mo phong hoat dong: mot vai task duoc chuyen sang DOING/DONE de sinh su kien
      // task.status_changed thuc su qua Kafka -> Analytics Service (khong chi task.created).
      const roll = Math.random();
      if (roll > 0.3) {
        await apiCall(`/tasks/${task.id}/status`, {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({ status: 'DOING' }),
        });
      }
      if (roll > 0.6) {
        await apiCall(`/tasks/${task.id}/status`, {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({ status: 'DONE' }),
        });
      }
    }
    console.log(
      `Du an "${project.name}": da tao ${taskCount} task (co giao nguoi), 1 thu muc + ${sampleDocs.length} tai lieu`,
    );
  }

  console.log('\n=== Seed hoan tat (qua API cong khai) ===');
  console.log(`Dang nhap Org Admin: ${adminEmail} / ${adminPassword}`);
  console.log('Nhan vien demo dung chung mat khau tren.');
  console.log(`Tong: ${projectIds.length} du an, ${totalTasks} task, ${totalFiles} tai lieu da upload.`);
  console.log('Mo dashboard va cho vai giay de Analytics Service xu ly xong hang doi Kafka.');

  // ==========================================================================================
  // DEMO-ONLY: dữ liệu lịch sử tổng hợp trực tiếp vào hypertable để minh họa biểu đồ xu hướng,
  // không đi qua pipeline sự kiện thật.
  //
  // Ly do buoc nay TACH BIET va KHONG di qua REST API cong khai (khac toan bo phia tren):
  // moi endpoint tao task/document deu tu dong dung `now()` lam createdAt/occurredAt (xem
  // TasksService.create/FilesService.upload) - KHONG co co che hop le nao qua API cong khai
  // de "backdate" thoi gian tao, va co tinh lam vay se la du lieu khong trung thuc (gia mao
  // occurredAt). Vi bieu do xu huong tuan/thang can du lieu trai dai nhieu tuan de khong bi
  // "phang" (1 diem duy nhat), buoc nay ket noi TRUC TIEP vao TimescaleDB (bo qua toan bo
  // Kafka/Outbox) va tu chen cac hang gia lap co timestamp trong qua khu (~8 tuan gan nhat)
  // vao dung 3 hypertable ma FactWriterService dung (xem infra/timescale-init/001-init.sql).
  // Neu TimescaleDB khong the ket noi duoc tu moi truong dang chay script nay, buoc nay CHI
  // canh bao va bo qua - khong lam that bai phan seed du lieu qua API o tren (da hoan tat).
  // ==========================================================================================
  await seedHistoricalAnalyticsData({
    organizationId,
    projectIds,
    folderIds,
    userIds: assignablePool.map((u) => u.id),
  });
}

const WEEKS_OF_HISTORY = 8;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function randomTimestampInRange(startMs, endMs) {
  return new Date(startMs + Math.random() * (endMs - startMs));
}

/**
 * Chen du lieu lich su gia lap (~8 tuan) truc tiep vao fact_task_events / fact_document_events /
 * fact_user_activity - xem chu thich DEMO-ONLY o noi goi ham nay (main()) de biet ly do.
 *
 * Moi hang deu dung eventId la UUID that su ngau nhien (crypto.randomUUID()) nen khong trung
 * voi eventId cua bat ky su kien that nao tung/se di qua Kafka (chong dung idempotency key that).
 * organizationId luon la to chuc vua duoc seed o tren (khong "ro ri" sang to chuc khac).
 *
 * 25/07/2026: vi eventId la UUID NGAU NHIEN moi lan chay, `ON CONFLICT (time, event_id) DO NOTHING`
 * (xem insertTaskEvent/insertDocumentEvent/insertUserActivity ben duoi) khong bao gio tu kich hoat
 * duoc giua cac lan chay khac nhau -> chay `npm run seed` nhieu lan tren CUNG 1 to chuc demo (nay
 * da CO DINH, xem DEMO_ORG_NAME/main()) truoc day se cong don du lieu synthetic trung lap vo han.
 * Thay vi ep timestamp/eventId tat dinh (mau thuan voi thiet ke "cua so 8 tuan tinh den hien tai"
 * + jitter ngau nhien de bieu do xu huong trong that hon), ham nay XOA cac hang synthetic CU cua
 * CHINH to chuc nay (time < now - 7 ngay) truoc khi chen lai - xem doan xoa dau khoi try{} ben duoi.
 */
async function seedHistoricalAnalyticsData({ organizationId, projectIds, folderIds, userIds }) {
  console.log('\n--- [DEMO-ONLY] Bat dau chen du lieu lich su tong hop (~8 tuan) vao TimescaleDB ---');

  let Client;
  try {
    // eslint-disable-next-line global-require
    ({ Client } = require('pg'));
  } catch (err) {
    console.warn(`Bo qua buoc backfill lich su: khong tim thay module "pg" (${err.message}).`);
    console.warn('Cai dat bang `npm install pg` o thu muc goc repo roi chay lai `npm run seed`.');
    return;
  }

  const client = new Client({
    host: process.env.SEED_TIMESCALE_HOST || 'localhost',
    port: parseInt(process.env.SEED_TIMESCALE_PORT || '5436', 10),
    database: process.env.SEED_TIMESCALE_DB || 'analytics_db',
    user: process.env.SEED_TIMESCALE_USER || 'analytics_user',
    password: process.env.SEED_TIMESCALE_PASSWORD || 'analytics_password',
  });

  try {
    await client.connect();
  } catch (err) {
    console.warn(`Bo qua buoc backfill lich su: khong ket noi duoc TimescaleDB (${err.message}).`);
    console.warn(
      'Kiem tra `docker compose ps` tu thu muc infra/ (container "timescaledb" phai dang chay va ' +
        'expose cong host - mac dinh 5436), hoac chinh bien SEED_TIMESCALE_* cho dung moi truong.',
    );
    return;
  }

  try {
    const now = Date.now();
    let taskEventCount = 0;
    let documentEventCount = 0;
    let activityEventCount = 0;

    // 25/07/2026: XOA cac hang backfill synthetic CU cua CHINH to chuc demo nay (neu co tu lan
    // chay `npm run seed` truoc do) TRUOC khi chen lai - xem ly do chi tiet o docstring ham nay o
    // tren. CHI xoa nhung hang co time < (now - 7 ngay): du lieu THAT vua duoc seed qua API o cac
    // buoc tren (task/document, luon mang timestamp ~ "now" cua LAN CHAY NAY) khong bao gio roi
    // vao dieu kien nay nen khong bi anh huong; vong lap backfill ben duoi cung duoc gioi han chi
    // sinh du lieu synthetic tu 2 tuan truoc tro ve truoc (xem "weeksAgo >= 2" ben duoi), tranh
    // chong lan khoang thoi gian voi du lieu that noi tren.
    const historicalCutoffIso = new Date(now - 7 * MS_PER_DAY).toISOString();
    const delTaskEvents = await client.query(
      'DELETE FROM fact_task_events WHERE organization_id = $1 AND time < $2::timestamptz',
      [organizationId, historicalCutoffIso],
    );
    const delDocEvents = await client.query(
      'DELETE FROM fact_document_events WHERE organization_id = $1 AND time < $2::timestamptz',
      [organizationId, historicalCutoffIso],
    );
    const delActivity = await client.query(
      'DELETE FROM fact_user_activity WHERE organization_id = $1 AND time < $2::timestamptz',
      [organizationId, historicalCutoffIso],
    );
    const deletedTotal = (delTaskEvents.rowCount || 0) + (delDocEvents.rowCount || 0) + (delActivity.rowCount || 0);
    if (deletedTotal > 0) {
      console.log(`Da xoa ${deletedTotal} hang synthetic cu (backfill tu lan chay truoc) truoc khi chen lai.`);
    }

    // 25/07/2026: dung lai o "weeksAgo >= 2" (bo qua tuan gan nhat, weeksAgo = 1) - tuan gan nhat
    // da duoc du lieu THAT (task/document vua tao qua API o tren) bao phu, dong thoi tranh chong
    // lan thoi gian voi nguong xoa historicalCutoffIso o tren (xem giai thich chi tiet o docstring).
    for (let weeksAgo = WEEKS_OF_HISTORY; weeksAgo >= 2; weeksAgo -= 1) {
      const weekEndMs = now - (weeksAgo - 1) * 7 * MS_PER_DAY;
      const weekStartMs = weekEndMs - 7 * MS_PER_DAY;
      // recency: 0 (8 tuan truoc) -> 1 (tuan gan nhat) - dung de tao xu huong "cai thien dan
      // theo thoi gian" (nhieu viec hon, ty le hoan thanh cao hon) thay vi du lieu phang deu.
      const recency = (WEEKS_OF_HISTORY - weeksAgo + 1) / WEEKS_OF_HISTORY;

      const tasksThisWeek = Math.max(2, Math.round(3 + recency * 6 + (Math.random() * 2 - 1)));
      const completionRate = Math.min(0.9, 0.3 + recency * 0.55);
      const docsThisWeek = Math.max(1, Math.round(2 + recency * 4 + (Math.random() * 2 - 1)));

      for (let i = 0; i < tasksThisWeek; i += 1) {
        const taskId = crypto.randomUUID();
        const projectId = randomFrom(projectIds);
        const creatorId = randomFrom(userIds);
        const createdAt = randomTimestampInRange(weekStartMs, weekEndMs);
        const createdEventId = crypto.randomUUID();

        await insertTaskEvent(client, {
          time: createdAt,
          eventId: createdEventId,
          organizationId,
          eventType: 'task.created',
          projectId,
          taskId,
          fromStatus: null,
          toStatus: null,
          actorId: creatorId,
        });
        await insertUserActivity(client, {
          time: createdAt,
          eventId: createdEventId,
          organizationId,
          eventType: 'task.created',
          producer: 'project-task-service',
          actorId: creatorId,
          payload: { taskId, projectId, actorId: creatorId },
        });
        taskEventCount += 1;
        activityEventCount += 1;

        if (Math.random() > 0.2) {
          const assigneeId = randomFrom(userIds);
          const assignTime = new Date(createdAt.getTime() + Math.random() * MS_PER_DAY);
          const assignEventId = crypto.randomUUID();
          await insertTaskEvent(client, {
            time: assignTime,
            eventId: assignEventId,
            organizationId,
            eventType: 'task.assigned',
            projectId,
            taskId,
            fromStatus: null,
            toStatus: null,
            actorId: assigneeId,
          });
          await insertUserActivity(client, {
            time: assignTime,
            eventId: assignEventId,
            organizationId,
            eventType: 'task.assigned',
            producer: 'project-task-service',
            actorId: assigneeId,
            payload: { taskId, projectId, assigneeId },
          });
          taskEventCount += 1;
          activityEventCount += 1;
        }

        if (Math.random() < 0.85) {
          const doingTime = new Date(createdAt.getTime() + Math.random() * 2 * MS_PER_DAY);
          const doingEventId = crypto.randomUUID();
          await insertTaskEvent(client, {
            time: doingTime,
            eventId: doingEventId,
            organizationId,
            eventType: 'task.status_changed',
            projectId,
            taskId,
            fromStatus: 'TODO',
            toStatus: 'DOING',
            actorId: creatorId,
          });
          await insertUserActivity(client, {
            time: doingTime,
            eventId: doingEventId,
            organizationId,
            eventType: 'task.status_changed',
            producer: 'project-task-service',
            actorId: creatorId,
            payload: { taskId, projectId, fromStatus: 'TODO', toStatus: 'DOING', actorId: creatorId },
          });
          taskEventCount += 1;
          activityEventCount += 1;

          if (Math.random() < completionRate) {
            const doneTime = new Date(doingTime.getTime() + Math.random() * 3 * MS_PER_DAY);
            const doneEventId = crypto.randomUUID();
            await insertTaskEvent(client, {
              time: doneTime,
              eventId: doneEventId,
              organizationId,
              eventType: 'task.status_changed',
              projectId,
              taskId,
              fromStatus: 'DOING',
              toStatus: 'DONE',
              actorId: creatorId,
            });
            await insertUserActivity(client, {
              time: doneTime,
              eventId: doneEventId,
              organizationId,
              eventType: 'task.status_changed',
              producer: 'project-task-service',
              actorId: creatorId,
              payload: { taskId, projectId, fromStatus: 'DOING', toStatus: 'DONE', actorId: creatorId },
            });
            taskEventCount += 1;
            activityEventCount += 1;
          }
        }
      }

      for (let i = 0; i < docsThisWeek; i += 1) {
        const fileId = crypto.randomUUID();
        const folderId = folderIds.length > 0 ? randomFrom(folderIds) : null;
        const actorId = randomFrom(userIds);
        const uploadTime = randomTimestampInRange(weekStartMs, weekEndMs);
        const uploadEventId = crypto.randomUUID();

        await insertDocumentEvent(client, {
          time: uploadTime,
          eventId: uploadEventId,
          organizationId,
          eventType: 'document.uploaded',
          fileId,
          folderId,
          actorId,
        });
        await insertUserActivity(client, {
          time: uploadTime,
          eventId: uploadEventId,
          organizationId,
          eventType: 'document.uploaded',
          producer: 'document-service',
          actorId,
          payload: { fileId, folderId, actorId },
        });
        documentEventCount += 1;
        activityEventCount += 1;

        if (Math.random() > 0.6) {
          const sharedWithUserId = randomFrom(userIds);
          const shareTime = new Date(uploadTime.getTime() + Math.random() * MS_PER_DAY);
          const shareEventId = crypto.randomUUID();
          await insertDocumentEvent(client, {
            time: shareTime,
            eventId: shareEventId,
            organizationId,
            eventType: 'document.shared',
            fileId,
            folderId,
            actorId,
          });
          await insertUserActivity(client, {
            time: shareTime,
            eventId: shareEventId,
            organizationId,
            eventType: 'document.shared',
            producer: 'document-service',
            actorId,
            payload: { fileId, sharedWithUserId, actorId },
          });
          documentEventCount += 1;
          activityEventCount += 1;
        }
      }
    }

    console.log(
      `Da chen ${taskEventCount} hang fact_task_events, ${documentEventCount} hang fact_document_events, ` +
        // 25/07/2026: chi con ${WEEKS_OF_HISTORY - 1} tuan la synthetic (tuan gan nhat da duoc du
        // lieu THAT o buoc seed qua API bao phu - xem "weeksAgo >= 2" o tren).
        `${activityEventCount} hang fact_user_activity (trai dai ${WEEKS_OF_HISTORY - 1} tuan truoc, ` +
        'cong voi du lieu that cua tuan gan nhat da seed qua API o tren).',
    );

    // Cac continuous aggregate (daily_task_summary/weekly_project_progress/daily_document_activity)
    // duoc tao WITH NO DATA va chinh sach add_continuous_aggregate_policy chi tu refresh 1 CUA SO
    // GAN HIEN TAI (start_offset 3 ngay / 3 tuan - xem infra/timescale-init/001-init.sql). Du lieu
    // gia lap 8 tuan truoc se KHONG bao gio duoc chinh sach do tu dong "quet" toi vi nam ngoai cua
    // so - phai goi refresh_continuous_aggregate() THU CONG mot lan cho toan bo khoang thoi gian
    // vua chen, neu khong bieu do xu huong se chi thay vai ngay/tuan gan nhat thay vi ca 8 tuan.
    const refreshStart = new Date(now - (WEEKS_OF_HISTORY + 1) * 7 * MS_PER_DAY).toISOString();
    const refreshEnd = new Date(now + 60 * 60 * 1000).toISOString();
    const continuousAggregates = ['daily_task_summary', 'weekly_project_progress', 'daily_document_activity'];
    for (const viewName of continuousAggregates) {
      try {
        await client.query(`CALL refresh_continuous_aggregate($1, $2::timestamptz, $3::timestamptz)`, [
          viewName,
          refreshStart,
          refreshEnd,
        ]);
        console.log(`Da refresh continuous aggregate "${viewName}" cho khoang thoi gian vua chen.`);
      } catch (err) {
        console.warn(
          `Khong the refresh continuous aggregate "${viewName}" ngay (${err.message}). ` +
            'Se tu dong duoc lap day trong vong 1 gio qua add_continuous_aggregate_policy hien co.',
        );
      }
    }
  } catch (err) {
    console.warn(
      `Loi khi chen du lieu lich su gia lap (KHONG anh huong den du lieu da seed qua API o tren): ${err.message}`,
    );
  } finally {
    await client.end();
  }
}

async function insertTaskEvent(client, row) {
  await client.query(
    `
    INSERT INTO fact_task_events (time, event_id, organization_id, event_type, project_id, task_id, from_status, to_status, actor_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (time, event_id) DO NOTHING
    `,
    [
      row.time,
      row.eventId,
      row.organizationId,
      row.eventType,
      row.projectId,
      row.taskId,
      row.fromStatus,
      row.toStatus,
      row.actorId,
    ],
  );
}

async function insertDocumentEvent(client, row) {
  await client.query(
    `
    INSERT INTO fact_document_events (time, event_id, organization_id, event_type, file_id, folder_id, actor_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (time, event_id) DO NOTHING
    `,
    [row.time, row.eventId, row.organizationId, row.eventType, row.fileId, row.folderId, row.actorId],
  );
}

async function insertUserActivity(client, row) {
  await client.query(
    `
    INSERT INTO fact_user_activity (time, event_id, organization_id, event_type, producer, actor_id, payload)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (time, event_id) DO NOTHING
    `,
    [
      row.time,
      row.eventId,
      row.organizationId,
      row.eventType,
      row.producer,
      row.actorId,
      JSON.stringify(row.payload ?? {}),
    ],
  );
}

main().catch((err) => {
  console.error('Seed that bai:', err.message);
  process.exit(1);
});
