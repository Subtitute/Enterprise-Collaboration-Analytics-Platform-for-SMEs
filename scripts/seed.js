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
//      27/10/2026: bo cac tep text/CSV nay - thay bang tai lieu that trong scripts/seed-assets (xem main()).
//   3. Them 1 buoc BO SUNG (xem seedHistoricalAnalyticsData ben duoi) noi TRUC TIEP vao TimescaleDB
//      de tao lich su ~8 tuan cho bieu do xu huong - xem chu thich chi tiet o buoc do ve ly do
//      khong the/khong nen lam dieu nay qua API cong khai.

const crypto = require('crypto');
// 28/10/2026: bo du lieu nganh khac (vd SEED_DATASET=noi-that, xem scripts/seed-datasets/) ghi de cac hang so
// du lieu ben duoi; khong dat bien thi giu nguyen du lieu cong ty may tinh mac dinh.
const DATASET = require('./seed-datasets').loadDataset();

const API_BASE_URL = process.env.SEED_API_BASE_URL || 'http://localhost:3000/api/v1';

const DEPARTMENTS = DATASET.DEPARTMENTS || ['Kinh doanh', 'Kỹ thuật', 'Nhân sự', 'Marketing'];

const EMPLOYEES = DATASET.EMPLOYEES || [
  { fullName: 'Nguyễn Văn An', email: 'an.nguyen@demo-sme.vn' },
  { fullName: 'Trần Thị Bình', email: 'binh.tran@demo-sme.vn' },
  { fullName: 'Lê Văn Chi', email: 'chi.le@demo-sme.vn' },
  { fullName: 'Phạm Thị Dung', email: 'dung.pham@demo-sme.vn' },
  { fullName: 'Hoàng Văn Đức', email: 'duc.hoang@demo-sme.vn' },
  { fullName: 'Vũ Thị Em', email: 'em.vu@demo-sme.vn' },
  { fullName: 'Đỗ Văn Phong', email: 'phong.do@demo-sme.vn' },
  { fullName: 'Ngô Thị Giang', email: 'giang.ngo@demo-sme.vn' },
];

const PROJECTS = DATASET.PROJECTS || [
  { name: 'Website bán hàng SME', description: 'Xây dựng website thương mại điện tử cho SME' },
  { name: 'Triển khai CRM nội bộ', description: 'Triển khai hệ thống CRM quản lý khách hàng' },
  { name: 'Nâng cấp hạ tầng Docker', description: 'Container hóa toàn bộ hệ thống nội bộ' },
  { name: 'Ứng dụng di động bán hàng', description: 'Xây dựng app mobile hỗ trợ nhân viên kinh doanh' },
  { name: 'Hệ thống báo cáo KPI', description: 'Xây dựng dashboard báo cáo KPI nội bộ cho ban giám đốc' },
];

// 22/09/2026: danh dau san 1 phong ban tut hau (STRUGGLE), 1 phong ban vuot troi (THRIVE) va 1 du an
// co nguy co (AT_RISK) - de tinh nang "Nhan xet AI" (analytics-service/src/ai-insights) LUON co it
// nhat vai bat thuong dang chu y de phat hien khi demo, thay vi phu thuoc hoan toan vao may man cua
// Math.random() nhu truoc day (co lan chay ra du lieu qua "phang", AI khong tim thay gi dang noi).
// 2 phong ban con lai (Nhan su/Marketing) + 4 du an con lai van giu nguyen ty le ngau nhien trung lap
// (xem biasedProbability() ben duoi) de du lieu khong "qua hoan hao"/de bi nhan ra la gia mao.
const STRUGGLE_DEPT_NAME = DATASET.STRUGGLE_DEPT_NAME || 'Kinh doanh';
const THRIVE_DEPT_NAME = DATASET.THRIVE_DEPT_NAME || 'Kỹ thuật';
const AT_RISK_PROJECT_INDEX = DATASET.AT_RISK_PROJECT_INDEX ?? 2; // 'Nâng cấp hạ tầng Docker'

/**
 * Nhan 1 ty le xac suat "trung lap" (baseline) theo dung boi canh (du an nay co phai AT_RISK
 * khong, nguoi duoc giao thuoc phong ban nao) - dung CHUNG cho ca task tao qua API (vong lap chinh
 * trong main()) LAN du lieu lich su gia lap chen thang vao TimescaleDB (seedHistoricalAnalyticsData),
 * de 1 noi thien lech duy nhat ap dung nhat quan cho MOI khoang thoi gian AI co the quet (7d/30d/quy).
 * isAtRiskProject duoc uu tien hon phong ban (1 nhan vien gioi lam viec tren du an nguy co van tinh
 * la "nguy co" cho task do) - danh cho truong hop du an that su co van de bat ke ai dam nhan.
 */
function biasedProbability(baseline, { isAtRiskProject, deptId, struggleDeptId, thriveDeptId }) {
  if (isAtRiskProject || deptId === struggleDeptId) return Math.max(0.05, baseline * 0.45);
  if (deptId === thriveDeptId) return Math.min(0.95, baseline * 1.4);
  return baseline;
}

/**
 * Nhan ban cac thanh vien thuoc phong ban STRUGGLE/THRIVE trong 1 pool truoc khi randomFrom() -
 * de 2 phong ban nay nhan TY TRONG khoi luong cong viec cao hon (that te: phong ban dang "ngap dau"
 * hoac dang chay het cong suat thuong xu ly nhieu viec hon), THAY VI chi day xac suat DOING/DONE
 * len gan 100% (se qua hoan hao/de nhan la gia mao - da thu va van bi nhieu tu 2 phong ban KHONG
 * thien lech "may man" o mau nho). Tang N thuc su giup tin hieu da chu dich on dinh hon truoc bien
 * thien ngau nhien cua Marketing/Nhan su (van giu nguyen KHONG thien lech, chi la mau nho hon).
 */
function weightedByDept(pool, getDeptId, { struggleDeptId, thriveDeptId, weight = 2 }) {
  const weighted = [];
  for (const item of pool) {
    const deptId = getDeptId(item);
    const copies = deptId === struggleDeptId || deptId === thriveDeptId ? weight : 1;
    for (let i = 0; i < copies; i += 1) weighted.push(item);
  }
  return weighted;
}

const TASK_TITLES = DATASET.TASK_TITLES || [
  'Thiết kế giao diện trang chủ',
  'Tích hợp cổng thanh toán',
  'Viết tài liệu API',
  'Kiểm thử chức năng đăng nhập',
  'Tối ưu hóa truy vấn cơ sở dữ liệu',
  'Chuẩn bị báo cáo tiến độ tuần',
  'Rà soát bảo mật API',
  'Tối ưu hóa hiệu năng frontend',
  'Xây dựng quy trình CI/CD',
  'Đào tạo nhân viên mới',
];

// 16/09/2026: bo sung - toan bo 5 du an tren truoc day KHONG co khach hang/deal CRM nao di kem
// (script nay chua tung tao du lieu CRM), khien man hinh CRM luon trong tren 1 to chuc vua seed
// moi. Danh sach nay dung chung ten cong ty/nganh nghe VIET NAM thuc te (khong phai placeholder
// kieu "Khach hang A") de anh xa/bao cao cua tinh nang AI Insight (Gemini/Groq - xem
// analytics-service/src/ai-insights) va man hinh CRM trong nom that hon khi demo.
const CUSTOMERS = DATASET.CUSTOMERS || [
  { name: 'Nguyễn Thanh Tùng', company: 'Công ty TNHH Thương mại Đại Phát', email: 'tung.nguyen@daiphat.vn', phone: '0903123456', notes: 'Khách hàng quen thuộc, chuyên phân phối hàng gia dụng' },
  { name: 'Trần Thị Mai Anh', company: 'Công ty CP Thực phẩm Hương Việt', email: 'maianh.tran@huongviet.com.vn', phone: '0912345678', notes: 'Đang mở rộng chuỗi cửa hàng tại TP.HCM' },
  { name: 'Lê Hoàng Nam', company: 'Xưởng May Thành Công', email: 'nam.le@thanhcongtailor.vn', phone: '0987654321', notes: 'Khách hàng tiềm năng, quan tâm gói CRM và quản lý kho' },
  { name: 'Phạm Minh Đức', company: 'Công ty TNHH Xây dựng Phú Cường', email: 'duc.pham@phucuong.vn', phone: '0977888999', notes: '' },
  { name: 'Vũ Thị Ngọc Hà', company: 'Chuỗi Cà phê Hạt Dẻ', email: 'ha.vu@hatdecoffee.vn', phone: '0909111222', notes: 'Muốn tích hợp quản lý nhân sự cho 5 chi nhánh' },
  { name: 'Đặng Quốc Bảo', company: 'Công ty CP Vận tải Bảo Long', email: 'bao.dang@baolongtransport.vn', phone: '0938222333', notes: '' },
  { name: 'Hoàng Thị Thu Trang', company: 'Trung tâm Anh ngữ Global Link', email: 'trang.hoang@globallink.edu.vn', phone: '0918444555', notes: 'Khách hàng lâu năm, ký hợp đồng thường niên' },
  { name: 'Bùi Văn Hùng', company: 'Công ty TNHH Cơ khí Chính Xác', email: 'hung.bui@cokhichinhxac.vn', phone: '0944666777', notes: '' },
  { name: 'Ngô Thị Kim Oanh', company: 'Siêu thị Mini Xanh', email: 'oanh.ngo@sieuthixanh.vn', phone: '0966777888', notes: 'Chuỗi 3 cửa hàng, cần báo cáo doanh số theo thời gian thực' },
  { name: 'Đỗ Anh Tuấn', company: 'Công ty CP Công nghệ Việt Số', email: 'tuan.do@vietso.tech', phone: '0922333444', notes: 'Đối tác công nghệ, hợp tác triển khai module tích hợp' },
  { name: 'Lý Thị Bích Ngọc', company: 'Nhà thuốc An Khang', email: 'ngoc.ly@ankhangpharma.vn', phone: '0955666111', notes: '' },
  { name: 'Trương Văn Long', company: 'Công ty TNHH In ấn Sao Việt', email: 'long.truong@saovietprint.vn', phone: '0933555222', notes: 'Khách hàng mới, đang trong giai đoạn tư vấn' },
];

/**
 * 2 deal/khach hang, rai deu ca 6 giai doan pipeline (NEW/CONTACTED/PROPOSAL/NEGOTIATION/WON/LOST -
 * xem DEAL_STAGE_TRANSITIONS packages/common-dto) de Kanban CRM trong nhu 1 pipeline that dang van
 * hanh, khong phai toan bo deal moi tinh. `closeOffsetDays` am = da qua (danh cho WON/LOST, mo
 * phong ngay du kien chot trong qua khu), duong = trong tuong lai (deal dang hoat dong).
 */
const DEAL_TEMPLATES = DATASET.DEAL_TEMPLATES || [
  { customer: 0, title: 'Gói triển khai CRM cơ bản', value: 45000000, stage: 'WON', closeOffsetDays: -40 },
  { customer: 0, title: 'Hợp đồng bảo trì hệ thống năm 2027', value: 18000000, stage: 'NEGOTIATION', closeOffsetDays: 20 },
  { customer: 1, title: 'Gói quản lý chuỗi cung ứng thực phẩm', value: 120000000, stage: 'PROPOSAL', closeOffsetDays: 30 },
  { customer: 1, title: 'Dịch vụ tư vấn số hóa quy trình sản xuất', value: 65000000, stage: 'CONTACTED', closeOffsetDays: 45 },
  { customer: 2, title: 'Gói phần mềm quản lý kho vải', value: 32000000, stage: 'NEW', closeOffsetDays: 60 },
  { customer: 2, title: 'Demo dùng thử hệ thống CRM', value: 0, stage: 'CONTACTED', closeOffsetDays: 25 },
  { customer: 3, title: 'Hợp đồng quản lý dự án xây dựng', value: 250000000, stage: 'NEGOTIATION', closeOffsetDays: 15 },
  { customer: 3, title: 'Gói theo dõi tiến độ công trình', value: 40000000, stage: 'LOST', closeOffsetDays: -10 },
  { customer: 4, title: 'Gói quản lý nhân sự đa chi nhánh', value: 85000000, stage: 'WON', closeOffsetDays: -15 },
  { customer: 4, title: 'Gói báo cáo doanh thu theo chi nhánh', value: 28000000, stage: 'PROPOSAL', closeOffsetDays: 35 },
  { customer: 5, title: 'Hợp đồng tích hợp hệ thống điều phối xe', value: 180000000, stage: 'CONTACTED', closeOffsetDays: 50 },
  { customer: 5, title: 'Gói theo dõi đơn hàng thời gian thực', value: 55000000, stage: 'NEW', closeOffsetDays: 70 },
  { customer: 6, title: 'Gói quản lý học viên và lịch học', value: 38000000, stage: 'WON', closeOffsetDays: -60 },
  { customer: 6, title: 'Hợp đồng gia hạn dịch vụ năm 2', value: 38000000, stage: 'NEGOTIATION', closeOffsetDays: 5 },
  { customer: 7, title: 'Gói quản lý sản xuất và chất lượng', value: 95000000, stage: 'LOST', closeOffsetDays: -20 },
  { customer: 7, title: 'Demo hệ thống theo dõi máy móc', value: 0, stage: 'NEW', closeOffsetDays: 40 },
  { customer: 8, title: 'Gói quản lý bán lẻ đa cửa hàng', value: 60000000, stage: 'PROPOSAL', closeOffsetDays: 28 },
  { customer: 8, title: 'Gói báo cáo doanh số thời gian thực', value: 22000000, stage: 'CONTACTED', closeOffsetDays: 18 },
  { customer: 9, title: 'Hợp đồng hợp tác tích hợp API', value: 150000000, stage: 'WON', closeOffsetDays: -25 },
  { customer: 9, title: 'Gói mở rộng module phân tích dữ liệu', value: 90000000, stage: 'NEGOTIATION', closeOffsetDays: 12 },
  { customer: 10, title: 'Gói quản lý kho thuốc và hạn dùng', value: 48000000, stage: 'CONTACTED', closeOffsetDays: 33 },
  { customer: 10, title: 'Demo dùng thử 30 ngày', value: 0, stage: 'NEW', closeOffsetDays: 50 },
  { customer: 11, title: 'Gói thiết kế bộ nhận diện số', value: 15000000, stage: 'LOST', closeOffsetDays: -8 },
  { customer: 11, title: 'Gói quản lý đơn hàng in ấn', value: 26000000, stage: 'NEW', closeOffsetDays: 65 },
];

// 25/07/2026: to chuc demo CO DINH (khong con hau to timestamp trong ten/email admin) - xem main()
// de biet cach script PHAT HIEN to chuc nay da ton tai tu lan chay truoc (API tra ve 409 Conflict
// tren adminEmail) va TAI SU DUNG (dang nhap lai) thay vi luon tao to chuc moi. Truoc day moi lan
// `npm run seed` deu tao 1 to chuc rieng voi ten/email co hau to Date.now() - neu script that bai
// giua chung (vi du fetchWithRetry() het luot thu lai do 429), to chuc partial do bi "mo coi" vinh
// vien (khong co duong phuc hoi) va lan chay lai ke tiep chi tao THEM 1 to chuc moi khac thay vi
// tiep tuc/thay the to chuc loi (loi MAJOR, audit 25/07/2026).
// 25/09/2026: cho phep ghi de qua bien moi truong - dung de `npm run seed:e2e` seed 1 to chuc
// RIENG BIET danh cho Playwright (xem package.json), khong bao gio dung chung to chuc demo mac
// dinh nay (noi nguoi dung THAT xem/trinh bay dan chung do an) - fix loi du lieu rac ("Khach hang
// E2E ...", "Thanh vien E2E ...") tich luy vinh vien vao to chuc demo qua nhieu lan chay E2E.
const DEMO_ORG_NAME = process.env.SEED_ORG_NAME || DATASET.ORG_NAME || 'Demo SME (Seed Script)';
const DEMO_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || DATASET.ADMIN_EMAIL || 'admin@demo-sme.vn';
const DEMO_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Password123!';

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

// 27/10/2026: bo uploadFile() cung buildSampleDocuments() - seed.js khong con tu tai tep nao len (xem chu
// thich trong vong lap du an cua main()); tep mau do seed-project-docs.js/migrate-project-documents.js tai.

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Tao khach hang + deal CRM mau (CUSTOMERS/DEAL_TEMPLATES dau file) - xem chu thich 2 hang so do. */
async function seedCustomersAndDeals(authHeaders) {
  const customers = [];
  for (const c of CUSTOMERS) {
    const created = await apiCall('/customers', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(c),
    });
    customers.push(created);
  }

  let dealCount = 0;
  for (const tpl of DEAL_TEMPLATES) {
    const closeDate = new Date(Date.now() + tpl.closeOffsetDays * MS_PER_DAY).toISOString().slice(0, 10);
    const deal = await apiCall('/deals', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        customerId: customers[tpl.customer].id,
        title: tpl.title,
        value: tpl.value,
        expectedCloseDate: closeDate,
      }),
    });
    // Deal vua tao luon o giai doan NEW (CreateDealDto khong nhan `stage`) - chuyen sang giai
    // doan muc tieu qua endpoint rieng neu can (4 giai doan dang hoat dong deu chuyen tiep truc
    // tiep duoc toi nhau/WON/LOST trong 1 buoc - xem DEAL_STAGE_TRANSITIONS packages/common-dto).
    if (tpl.stage !== 'NEW') {
      await apiCall(`/deals/${deal.id}/stage`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ stage: tpl.stage }),
      });
    }
    dealCount += 1;
  }
  console.log(`Da tao ${customers.length} khach hang va ${dealCount} deal CRM`);
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
        // 29/10/2026: ten quan tri vien co dau (truoc day 'Quan Tri Vien Demo', lo ra o to chuc Noi that An Gia).
        adminFullName: 'Quản Trị Viên Demo',
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

  // 23/09/2026: idempotent theo TEN (giong pattern adminEmail/DEMO_ORG_NAME o main()) - truoc day
  // moi lan chay lai script deu POST 4 phong ban MOI (khong kiem tra da ton tai chua), khien to chuc
  // demo tich luy phong ban trung ten qua nhieu lan chay (vd 2x "Kinh doanh"). Dieu nay khong chi xau
  // ve du lieu ma con PHA VO tin hieu bat thuong da chu dich cai vao du lieu seed (xem STRUGGLE_DEPT_NAME
  // dau file) - tin hieu bi chia deu ra 2 phong-ban-id thay vi tap trung vao 1.
  const existingDepartments = await apiCall('/departments', { headers: authHeaders });
  const departments = [];
  let newDeptCount = 0;
  for (const name of DEPARTMENTS) {
    const existing = existingDepartments.find((d) => d.name === name);
    if (existing) {
      departments.push(existing);
      continue;
    }
    const dept = await apiCall('/departments', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name }),
    });
    departments.push(dept);
    newDeptCount += 1;
  }
  console.log(`Phong ban: ${newDeptCount} moi tao, ${departments.length - newDeptCount} da co san (tai su dung).`);

  const roles = await apiCall('/roles', { headers: authHeaders });
  const employeeRole = roles.find((r) => r.name === 'Employee');

  // Luu lai user duoc tra ve (co id) - CAN THIET de sau nay giao (assign) task cho nhan vien
  // that su qua API, thay vi chi "moi cho co" roi bo qua ket qua nhu ban truoc.
  // 22/09/2026: doi tu randomFrom(departments) sang RAI DEU theo vong tron (round-robin) - dam bao
  // moi phong ban (ke ca STRUGGLE_DEPT_NAME/THRIVE_DEPT_NAME) co it nhat 2 nhan vien co dinh, thay vi
  // co the ngau nhien nhan 0-1 nguoi khien tin hieu bat thuong da danh dau qua yeu de nhan ra khi demo.
  const employees = [];
  const employeeDepartmentById = {};
  for (let i = 0; i < EMPLOYEES.length; i += 1) {
    const emp = EMPLOYEES[i];
    const dept = departments[i % departments.length];
    // Email phai duy nhat TOAN CUC (UsersService.invite() kiem tra trung email khong loc theo
    // organizationId - shared-schema multi-tenant), khong chi trong pham vi 1 to chuc. Them
    // suffix ${suffix} cua lan chay nay (giong adminEmail o tren) de script THAT SU re-runnable
    // nhieu lan tren cung 1 DB, thay vi chi org/admin duy nhat con nhan vien thi bi trung email
    // voi lan chay truoc va lam hong ca script (409 Conflict).
    // 28/10/2026: chen hau to truoc '@' cho moi ten mien (bo du lieu nganh khac dung ten mien rieng).
    const email = emp.email.replace('@', `+${suffix}@`);
    const created = await apiCall('/users/invite', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        email,
        fullName: emp.fullName,
        initialPassword: adminPassword,
        departmentId: dept.id,
        roleIds: employeeRole ? [employeeRole.id] : [],
      }),
    });
    employees.push(created);
    employeeDepartmentById[created.id] = dept.id;
  }
  console.log(`Da moi ${employees.length} nhan vien (mat khau: ${adminPassword})`);

  const struggleDept = departments.find((d) => d.name === STRUGGLE_DEPT_NAME);
  const thriveDept = departments.find((d) => d.name === THRIVE_DEPT_NAME);

  await seedCustomersAndDeals(authHeaders);

  // Nguon nguoi dung co the giao viec / lam actor: nhan vien + chinh Org Admin (thuc te Org
  // Admin cung thuong tu nhan task nho trong doanh nghiep SME).
  const assignablePool = [...employees, registerRes.user];
  // 23/09/2026: pool DA NHAN BAN cho phong ban STRUGGLE/THRIVE - dung khi CHON NGUOI DUOC GIAO task
  // (xem weightedByDept() dau file) - CHI dung cho buoc chon assignee, KHONG dung cho cac muc dich
  // khac (vd taskId ngau nhien, TASK_TITLES...).
  const weightedAssignablePool = weightedByDept(assignablePool, (u) => employeeDepartmentById[u.id], {
    struggleDeptId: struggleDept?.id,
    thriveDeptId: thriveDept?.id,
  });

  // 23/09/2026: idempotent theo TEN du an - cung ly do nhu phong ban o tren (xem chu thich phia
  // tren). Du an da co san thi TAI SU DUNG id, KHONG tao lai (bo qua thu muc/tai lieu/task moi cho
  // no) - tranh tich luy trung ten qua nhieu lan chay VA giu AT_RISK_PROJECT_INDEX luon tro dung 1
  // du an duy nhat thay vi bi chia thanh nhieu ban sao.
  const existingProjectsRes = await apiCall('/projects?limit=100', { headers: authHeaders });
  const existingProjectsList = existingProjectsRes.data || existingProjectsRes;

  const projectIds = [];
  const folderIds = [];
  let totalTasks = 0;

  for (let projectIndex = 0; projectIndex < PROJECTS.length; projectIndex += 1) {
    const proj = PROJECTS[projectIndex];
    const existingProject = existingProjectsList.find((p) => p.name === proj.name);
    if (existingProject) {
      projectIds.push(existingProject.id);
      console.log(`Du an "${proj.name}": da co san - bo qua (khong tao lai thu muc/tai lieu/task).`);
      continue;
    }

    const project = await apiCall('/projects', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(proj),
    });
    projectIds.push(project.id);

    // --- Thu muc + tai lieu mau cho du an (Document Activity analytics + MinIO khong con trong) ---
    // 26/10/2026: tao truoc nhu thu muc toan cong ty (Org Admin) roi migrate-project-documents.js o
    // cuoi main() moi gan vao du an - du an vua tao chua kip toi read-model cua Document Service
    // (outbox + Kafka mat vai giay), gan ngay luc nay se bi 404 PROJECT_NOT_FOUND_IN_ORG.
    const folder = await apiCall('/folders', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: `${project.name} - Tai lieu` }),
    });
    folderIds.push(folder.id);
    // 27/10/2026: bo 2-4 tep gia bao-cao-tien-do-N.txt / du-lieu-cong-viec-N.csv sinh trong bo nho cho
    // moi du an (vai dong chu khong dau, lam "nhieu" ket qua tim kiem RAG cua chat bot). 20 tai lieu
    // Word/PDF/Excel/PowerPoint that trong scripts/seed-assets/project-docs (seed-project-docs.js o cuoi
    // main()) thay the - thu muc du an van tao o day de duoc gan du an va nhan cac tai lieu do.

    // --- Cong viec cua du an ---
    // 23/09/2026: du an AT_RISK duoc tao NHIEU task hon han (thay vi cung random 6-10 nhu moi du
    // an khac) - AiInsightsService chi xet 3 du an co KHOI LUONG TASK cao nhat lam candidate
    // (MAX_PROJECT_CANDIDATES=3 - xem ai-insights.service.ts), du an nay neu chi co khoi luong
    // trung binh se bi loai khoi danh sach xet duyet hoan toan (da xay ra khi kiem thu) - can dam
    // bao no LUON lot vao top 3 de tin hieu "du an nguy co" that su duoc AI quet toi.
    const taskCount = projectIndex === AT_RISK_PROJECT_INDEX ? randomInt(11, 15) : randomInt(6, 10);
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
      // 23/09/2026: dung weightedAssignablePool (khong phai assignablePool tho) - xem chu thich
      // weightedByDept() dau file.
      const assignee = randomFrom(weightedAssignablePool);
      await apiCall(`/tasks/${task.id}/assignees`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ userId: assignee.id }),
      });

      // Mo phong hoat dong: mot vai task duoc chuyen sang DOING/DONE de sinh su kien
      // task.status_changed thuc su qua Kafka -> Analytics Service (khong chi task.created).
      // 22/09/2026: thay "roll" phang bang biasedProbability() - giu nguyen ty le trung lap ~70%
      // DOING / ~57% DONE-cho-truong-hop-da-DOING cho phan lon task, nhung thien lech thap cho du an
      // AT_RISK/phong ban STRUGGLE va thien lech cao cho phong ban THRIVE (xem hang so dau file).
      const bias = {
        isAtRiskProject: projectIndex === AT_RISK_PROJECT_INDEX,
        deptId: employeeDepartmentById[assignee.id],
        struggleDeptId: struggleDept?.id,
        thriveDeptId: thriveDept?.id,
      };
      if (Math.random() < biasedProbability(0.7, bias)) {
        await apiCall(`/tasks/${task.id}/status`, {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({ status: 'DOING' }),
        });
        if (Math.random() < biasedProbability(4 / 7, bias)) {
          await apiCall(`/tasks/${task.id}/status`, {
            method: 'PATCH',
            headers: authHeaders,
            body: JSON.stringify({ status: 'DONE' }),
          });
        }
      }
    }
    console.log(
      `Du an "${project.name}": da tao ${taskCount} task (co giao nguoi), 1 thu muc tai lieu`,
    );
  }

  // 26/10/2026: tai lieu theo pham vi du an - nguoi duoc giao viec thanh thanh vien du an, them 2
  // thu muc chinh sach toan cong ty (dung chung script migrate cho DB da co, idempotent).
  // Document Service can vai giay de read-model du an nhan su kien project.created qua Kafka.
  await sleep(5000);
  await require('./migrate-project-documents').migrate({ token: accessToken });
  // 26/10/2026: 20 tai lieu mau (Word/PDF/Excel/PowerPoint) vao thu muc cua 5 du an (idempotent).
  await require('./seed-project-docs').seedProjectDocs({ token: accessToken });
  // 26/10/2026: giao 8 khach hang cho phong Kinh doanh - CRM cua Manager/nhan vien demo khong con trong.
  await require('./migrate-demo-ownership').migrateDemoOwnership({ token: accessToken });

  console.log('\n=== Seed hoan tat (qua API cong khai) ===');
  console.log(`Dang nhap Org Admin: ${adminEmail} / ${adminPassword}`);
  console.log('Nhan vien demo dung chung mat khau tren.');
  // 27/10/2026: bo dem tai lieu da upload - tai lieu mau do 2 script tren tai va tu in so luong.
  console.log(`Tong: ${projectIds.length} du an, ${totalTasks} task.`);
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
    employeeDepartmentById,
    struggleDeptId: struggleDept?.id,
    thriveDeptId: thriveDept?.id,
    atRiskProjectId: projectIds[AT_RISK_PROJECT_INDEX],
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
async function seedHistoricalAnalyticsData({
  organizationId,
  projectIds,
  folderIds,
  userIds,
  employeeDepartmentById,
  struggleDeptId,
  thriveDeptId,
  atRiskProjectId,
}) {
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

    // 23/09/2026: pool DA NHAN BAN cho phong ban STRUGGLE/THRIVE - dung khi chon NGUOI DUOC GIAO
    // (assigneeId) cua task lich su gia lap, cung ky thuat/ly do nhu weightedAssignablePool o main()
    // (xem chu thich weightedByDept() dau file). creatorId (nguoi tao/thuc hien hanh dong giao viec)
    // KHONG can trong so nay - chi assignee moi anh huong toi KPI theo-phong-ban.
    const weightedUserIds = weightedByDept(userIds, (id) => employeeDepartmentById?.[id], {
      struggleDeptId,
      thriveDeptId,
    });
    // 23/09/2026: du an AT_RISK duoc nhan ban them (cung ly do nhu taskCount o main()) - dam bao
    // khoi luong task LICH SU cua no cung cao hon han, khong chi task "that" cua tuan hien tai.
    const weightedProjectIds = atRiskProjectId ? [...projectIds, ...Array(2).fill(atRiskProjectId)] : projectIds;

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
        const projectId = randomFrom(weightedProjectIds);
        const creatorId = randomFrom(userIds);
        // 23/09/2026: chon assigneeId NGAY TU DAU (thay vi chi trong nhanh task.assigned ben duoi)
        // - can dung LAM CAN CU cho bias theo phong ban (xem "bias" ben duoi), vi truy van phong-ban
        // that su cua Analytics Service loc theo NGUOI DUOC GIAO (assignee_id qua event task.assigned),
        // KHONG phai nguoi tao task - xem AnalyticsService.computeSummary() departmentFilter.
        const assigneeId = randomFrom(weightedUserIds);
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
          const assignTime = new Date(createdAt.getTime() + Math.random() * MS_PER_DAY);
          const assignEventId = crypto.randomUUID();
          // 23/09/2026: sua actor_id/assignee_id dung ngu nghia (BUG that su, khong lien quan bias) -
          // truoc day gan nham assigneeId vao actor_id va KHONG bao gio ghi cot assignee_id (mac dinh
          // NULL), khien fact_task_events.assignee_id luon rong cho TOAN BO du lieu lich su gia lap.
          // Analytics Service loc "task cua 1 phong ban" bang JOIN dim_user qua CHINH cot assignee_id
          // (xem computeSummary() departmentFilter) - assignee_id rong nghia la 7 tuan du lieu lich
          // su chua tung duoc tinh vao bat ky KPI theo-phong-ban nao, chi con du lieu THAT cua tuan
          // hien tai (vua seed qua API) la co dong gop - xem chu thich fact-writer.service.ts cho
          // ngu nghia dung: actor_id = nguoi THUC HIEN hanh dong giao viec (o day la creatorId, dong
          // vai "nguoi giao"), assignee_id = nguoi DUOC giao (assigneeId).
          await insertTaskEvent(client, {
            time: assignTime,
            eventId: assignEventId,
            organizationId,
            eventType: 'task.assigned',
            projectId,
            taskId,
            fromStatus: null,
            toStatus: null,
            actorId: creatorId,
            assigneeId,
          });
          await insertUserActivity(client, {
            time: assignTime,
            eventId: assignEventId,
            organizationId,
            eventType: 'task.assigned',
            producer: 'project-task-service',
            actorId: creatorId,
            payload: { taskId, projectId, assigneeId },
          });
          taskEventCount += 1;
          activityEventCount += 1;
        }

        // 22/09/2026: bias theo dung boi canh cua task nay (du an AT_RISK/phong ban STRUGGLE hay
        // THRIVE cua NGUOI DUOC GIAO - 23/09/2026: doi tu creatorId sang assigneeId, vi truy van
        // phong-ban that su cua Analytics Service nhom theo assignee_id, khong phai actor_id/nguoi
        // tao - xem chu thich assigneeId o dau vong lap). completionRate (xu huong "cai thien dan
        // theo thoi gian" theo recency) van duoc dung lam baseline cho ty le DONE-cho-truong-hop-da-
        // DOING, chi khac muc do theo phong ban/du an trong CUNG 1 tuan.
        const bias = {
          isAtRiskProject: projectId === atRiskProjectId,
          deptId: employeeDepartmentById[assigneeId],
          struggleDeptId,
          thriveDeptId,
        };

        if (Math.random() < biasedProbability(0.85, bias)) {
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

          if (Math.random() < biasedProbability(completionRate, bias)) {
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
  // 23/09/2026: them cot assignee_id (row.assigneeId - undefined o hau het loi goi ham nay ngoai
  // task.assigned se tu thanh NULL qua tham so $10, dung nhu FactWriterService that - xem
  // fact-writer.service.ts) - truoc day BO SOT cot nay hoan toan, xem chu thich noi goi ham cho
  // task.assigned (main() -> seedHistoricalAnalyticsData) de biet tac dong.
  await client.query(
    `
    INSERT INTO fact_task_events (time, event_id, organization_id, event_type, project_id, task_id, from_status, to_status, actor_id, assignee_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
      row.assigneeId ?? null,
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
