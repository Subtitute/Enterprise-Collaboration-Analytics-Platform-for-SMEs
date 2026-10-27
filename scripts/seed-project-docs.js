// 26/10/2026: tai 20 tai lieu mau (Word/PDF/Excel/PowerPoint, 4 tai lieu moi du an) trong
// scripts/seed-assets/project-docs/<slug>/ vao THU MUC DU AN cua tung du an demo (thu muc cap goc da gan
// projectId - xem migrate-project-documents.js). Chay nhieu lan van an toan (idempotent): tep cung ten
// trong thu muc dich da co thi bo qua. Chi qua API cong khai cua Gateway bang tai khoan Org Admin, nen
// di dung quy tac quyen, phat dung su kien Kafka va duoc job RAG lap chi muc nhu tep tai len that
// (RAG chi doc PDF/DOCX/van ban - Excel/PowerPoint chi luu tru, khong co doan nao de tim kiem).
//
// Cach chay: node scripts/seed-project-docs.js   (seed.js goi lai o cuoi, sau migrate-project-documents.js)
// Bien moi truong: SEED_API_BASE_URL (mac dinh http://127.0.0.1:3000/api/v1), SEED_ADMIN_EMAIL,
// SEED_ADMIN_PASSWORD (mac dinh tai khoan demo cua seed.js).

const fs = require('fs');
const path = require('path');

const API_BASE_URL = process.env.SEED_API_BASE_URL || 'http://127.0.0.1:3000/api/v1';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@demo-sme.vn';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Password123!';
const ASSET_DIR = path.join(__dirname, 'seed-assets', 'project-docs');
// Ten thu muc du an do seed.js tao (migrate-project-documents.js gan projectId cho thu muc nay).
const FOLDER_SUFFIX = ' - Tai lieu';

const PROJECTS = {
  'website-ban-hang': 'Website bán hàng SME',
  'crm-noi-bo': 'Triển khai CRM nội bộ',
  'ha-tang-docker': 'Nâng cấp hạ tầng Docker',
  'app-di-dong': 'Ứng dụng di động bán hàng',
  'bao-cao-kpi': 'Hệ thống báo cáo KPI',
};

const MIME_TYPES = {
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

// [slug du an, ten tep nguon, tieu de hien thi] - tieu de + duoi tep la ten tep tren web-app. Tieu de
// KHONG duoc chua dau gach cheo: multipart chi giu phan sau dau '/' cuoi cung (ten luu khac ten so khi chay lai).
const DOCUMENTS = [
  ['website-ban-hang', 'bang-thong-so-san-pham.xlsx', 'Bảng thông số kỹ thuật sản phẩm trong kho'],
  ['website-ban-hang', 'catalogue-san-pham.pdf', 'Catalogue sản phẩm 2026'],
  ['website-ban-hang', 'dac-ta-yeu-cau-website.docx', 'Đặc tả yêu cầu website bán hàng'],
  ['website-ban-hang', 'ke-hoach-ra-mat-website.pptx', 'Kế hoạch ra mắt website bán hàng'],
  ['crm-noi-bo', 'huong-dan-su-dung-crm.docx', 'Hướng dẫn sử dụng phân hệ CRM trên web-app ECAP'],
  ['crm-noi-bo', 'quy-trinh-ban-hang.pptx', 'Quy trình bán hàng và quản lý pipeline'],
  ['crm-noi-bo', 'bao-cao-khach-hang-quy.xlsx', 'Báo cáo khách hàng và cơ hội bán hàng quý'],
  ['crm-noi-bo', 'mau-bao-gia.pdf', 'Mẫu báo giá thiết bị cho khách hàng doanh nghiệp'],
  ['ha-tang-docker', 'huong-dan-trien-khai-docker.docx', 'Hướng dẫn triển khai và vận hành hệ thống ECAP bằng Docker'],
  ['ha-tang-docker', 'cau-hinh-may-chu-de-xuat.pdf', 'Đề xuất cấu hình máy chủ và máy trạm cho hệ thống ECAP'],
  ['ha-tang-docker', 'kiem-ke-thiet-bi-it.xlsx', 'Bảng kiểm kê thiết bị IT nội bộ'],
  ['ha-tang-docker', 'bao-cao-kien-truc-ha-tang.pptx', 'Báo cáo kiến trúc hạ tầng và kết quả tối ưu tài nguyên'],
  ['app-di-dong', 'huong-dan-su-dung-app-di-dong.pdf', 'Hướng dẫn sử dụng ứng dụng di động ECAP'],
  ['app-di-dong', 'cai-dat-cau-hinh-app-di-dong.docx', 'Hướng dẫn cài đặt và cấu hình ứng dụng di động ECAP'],
  ['app-di-dong', 'kich-ban-kiem-thu-app.xlsx', 'Danh sách kịch bản kiểm thử chức năng app di động'],
  ['app-di-dong', 'gioi-thieu-app-di-dong.pptx', 'Giới thiệu tính năng ứng dụng di động cho nhân viên kinh doanh'],
  ['bao-cao-kpi', 'huong-dan-su-dung-web-app.pdf', 'Hướng dẫn sử dụng web-app ECAP'],
  ['bao-cao-kpi', 'tu-dien-chi-so-kpi.docx', 'Từ điển chỉ số KPI và cách tính trên ECAP'],
  ['bao-cao-kpi', 'bang-kpi-phong-ban.xlsx', 'Bảng KPI mẫu theo phòng ban'],
  ['bao-cao-kpi', 'bao-cao-kpi-quy.pptx', 'Báo cáo KPI quý III năm 2026 cho ban giám đốc'],
];

async function api(urlPath, { token, method = 'GET', body, formData } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${API_BASE_URL}${urlPath}`, {
      method,
      headers,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
    // Gateway rate-limit: doi roi thu lai (giong seed.js).
    if (res.status === 429 && attempt < 8) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(2000 * (attempt + 1), 15000)));
      continue;
    }
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(`${method} ${urlPath} -> ${res.status}: ${text}`);
    return data;
  }
}

const list = (data) => (Array.isArray(data) ? data : data?.data ?? []);
const sameName = (a, b) => a.normalize('NFC') === b.normalize('NFC');

/** Thu muc du an: thu muc cap goc gan projectId, uu tien thu muc "<ten du an> - Tai lieu"; chua co thi tao. */
async function ensureProjectFolder(token, project, folders) {
  const linked = folders.filter((f) => !f.parentFolderId && f.projectId === project.id);
  const folder = linked.find((f) => f.name === `${project.name}${FOLDER_SUFFIX}`) ?? linked[0];
  if (folder) return folder;
  console.log(`  Tao thu muc du an "${project.name}${FOLDER_SUFFIX}"`);
  return api('/folders', { token, method: 'POST', body: { name: `${project.name}${FOLDER_SUFFIX}`, projectId: project.id } });
}

async function seedProjectDocs({ token } = {}) {
  const accessToken =
    token ?? (await api('/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })).accessToken;
  const projects = list(await api('/projects?limit=100', { token: accessToken }));
  const folders = list(await api('/folders', { token: accessToken }));
  let uploaded = 0;
  let skipped = 0;
  for (const [slug, projectName] of Object.entries(PROJECTS)) {
    const project = projects.find((p) => p.name === projectName);
    if (!project) {
      console.log(`  Bo qua "${projectName}": du an chua ton tai`);
      continue;
    }
    const folder = await ensureProjectFolder(accessToken, project, folders);
    const existing = list(await api(`/files?folderId=${folder.id}&limit=500`, { token: accessToken })).map((f) => f.fileName);
    for (const [docSlug, source, title] of DOCUMENTS.filter((doc) => doc.at(0) === slug)) {
      const ext = path.extname(source);
      const fileName = `${title}${ext}`;
      if (existing.some((name) => sameName(name, fileName))) {
        skipped += 1;
        continue;
      }
      const sourcePath = path.join(ASSET_DIR, docSlug, source);
      if (!fs.existsSync(sourcePath)) {
        console.log(`  Bo qua "${fileName}": thieu tep ${path.relative(process.cwd(), sourcePath)}`);
        continue;
      }
      const formData = new FormData();
      formData.append('file', new Blob([fs.readFileSync(sourcePath)], { type: MIME_TYPES[ext] }), fileName);
      formData.append('folderId', folder.id);
      await api('/files/upload', { token: accessToken, method: 'POST', formData });
      console.log(`  Tai len "${fileName}" vao "${folder.name}"`);
      uploaded += 1;
    }
  }
  console.log(`Tai lieu mau du an: tai len ${uploaded}, bo qua ${skipped} (da co).`);
}

module.exports = { seedProjectDocs };

if (require.main === module) {
  seedProjectDocs().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
