// 26/10/2026: chuyen du lieu cu sang "tai lieu theo pham vi du an" (Technical_Spec.md muc 3.4) - chay
// nhieu lan van an toan (idempotent), CHI qua API cong khai cua Gateway bang tai khoan Org Admin
// (khong ghi thang DB nao), nen di dung quy tac quyen va phat dung su kien Kafka nhu thao tac that:
//   1. Gan thu muc cap goc "<ten du an> - Tai lieu" (thu muc seed.js tao cho tung du an) vao dung du
//      an cua no (PATCH /folders/:id { projectId }).
//   2. Thanh vien du an = nguoi dang duoc giao viec trong du an (POST /projects/:id/members, them lai
//      la no-op). Truoc ngay nay "thanh vien" chi duoc suy tu TaskAssignee; quy tac moi xet thanh
//      vien/lead, nen buoc nay giu nguyen quyen xem tai lieu cua nguoi dang lam du an thay vi am
//      tham thu hoi. Bo qua bang --skip-members.
//   3. Dam bao 2 thu muc chinh sach TOAN CONG TY (khong gan du an) - moi nguoi deu xem duoc - moi
//      thu muc 1 tai lieu mau neu dang trong.
//
// Cach chay: node scripts/migrate-project-documents.js [--skip-members]
// Bien moi truong: SEED_API_BASE_URL (mac dinh http://127.0.0.1:3000/api/v1), SEED_ADMIN_EMAIL,
// SEED_ADMIN_PASSWORD (mac dinh tai khoan demo cua seed.js).

const API_BASE_URL = process.env.SEED_API_BASE_URL || 'http://127.0.0.1:3000/api/v1';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@demo-sme.vn';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Password123!';
const FOLDER_SUFFIX = ' - Tai lieu';

const POLICY_FOLDERS = [
  {
    name: 'Chính sách công ty',
    file: 'noi-quy-lam-viec.txt',
    content:
      'NỘI QUY LÀM VIỆC\n' +
      '1. Giờ làm việc: 08:30 - 17:30, thứ Hai đến thứ Sáu; nghỉ trưa 12:00 - 13:00.\n' +
      '2. Chấm công bằng ảnh khi bắt đầu và kết thúc ca; quên chấm công thì gửi giải trình trong 3 ngày.\n' +
      '3. Nghỉ phép năm: 12 ngày, cộng 1 ngày cho mỗi 5 năm thâm niên; xin nghỉ trước ít nhất 2 ngày làm việc.\n' +
      '4. Tài liệu dự án chỉ chia sẻ trong phạm vi dự án; tài liệu toàn công ty do Quản trị viên phát hành.\n',
  },
  {
    name: 'Sổ tay nhân viên',
    file: 'so-tay-nhan-vien.txt',
    content:
      'SỔ TAY NHÂN VIÊN\n' +
      'Chào mừng bạn gia nhập công ty. Sổ tay này tóm tắt quy trình làm việc chung:\n' +
      '- Mỗi dự án có thư mục tài liệu riêng; bạn thấy tài liệu của các dự án mình tham gia.\n' +
      '- Công việc được giao và theo dõi trên bảng Kanban của từng dự án.\n' +
      '- Mọi thắc mắc về chế độ, liên hệ phòng Nhân sự; về hệ thống, liên hệ Quản trị viên.\n',
  },
];

async function api(path, { token, method = 'GET', body, formData } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${API_BASE_URL}${path}`, {
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
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
    return data;
  }
}

const list = (data) => (Array.isArray(data) ? data : data?.data ?? []);

async function login() {
  const res = await api('/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  return res.accessToken;
}

// 26/10/2026: du an vua tao chua toi read-model cua Document Service (outbox + Kafka, vai giay) -> 404
// PROJECT_NOT_FOUND_IN_ORG; thu lai toi ~30s thay vi chi trong cho vao 1 lan sleep co dinh o seed.js.
async function patchFolderProject(token, folderId, projectId) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await api(`/folders/${folderId}`, { token, method: 'PATCH', body: { projectId } });
    } catch (err) {
      if (attempt >= 10 || !String(err.message).includes('PROJECT_NOT_FOUND_IN_ORG')) throw err;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

/** Buoc 1: gan thu muc "<du an> - Tai lieu" vao du an cung ten. */
async function linkProjectFolders(token, projects, folders) {
  const byName = new Map(projects.map((p) => [p.name, p.id]));
  let linked = 0;
  for (const folder of folders) {
    if (folder.parentFolderId || !folder.name.endsWith(FOLDER_SUFFIX)) continue;
    const projectId = byName.get(folder.name.slice(0, -FOLDER_SUFFIX.length));
    if (!projectId || folder.projectId === projectId) continue;
    await patchFolderProject(token, folder.id, projectId);
    console.log(`  Gan thu muc "${folder.name}" -> du an ${projectId}`);
    linked += 1;
  }
  return linked;
}

/**
 * Buoc 2: nguoi duoc giao viec trong du an tro thanh thanh vien du an (idempotent phia server).
 * 26/10/2026: "thuoc du an" = lead/thanh vien/nguoi tao o MOI service; giao Task moi da tu them thanh vien
 * (TasksService.assign()), buoc nay chuyen du lieu giao viec CU sang cung dinh nghia.
 */
async function addAssigneesAsMembers(token, projects) {
  let added = 0;
  for (const project of projects) {
    const [tasks, members] = await Promise.all([
      api(`/tasks?projectId=${project.id}&limit=500`, { token }),
      api(`/projects/${project.id}/members`, { token }),
    ]);
    const existing = new Set(list(members).map((m) => m.userId));
    const assignees = new Set(list(tasks).flatMap((task) => (task.assignees ?? []).map((a) => a.userId)));
    let addedHere = 0;
    for (const userId of assignees) {
      if (existing.has(userId)) continue;
      await api(`/projects/${project.id}/members`, { token, method: 'POST', body: { userId } });
      addedHere += 1;
    }
    added += addedHere;
    console.log(`  Du an "${project.name}": ${assignees.size} nguoi duoc giao viec, them moi ${addedHere} thanh vien`);
  }
  return added;
}

/** Buoc 3: thu muc chinh sach toan cong ty (khong gan du an), moi thu muc 1 tai lieu mau neu trong. */
async function ensurePolicyFolders(token, folders) {
  for (const policy of POLICY_FOLDERS) {
    let folder = folders.find((f) => !f.parentFolderId && f.name === policy.name);
    if (!folder) {
      folder = await api('/folders', { token, method: 'POST', body: { name: policy.name } });
      console.log(`  Tao thu muc toan cong ty "${policy.name}"`);
    } else if (folder.projectId) {
      await api(`/folders/${folder.id}`, { token, method: 'PATCH', body: { projectId: null } });
    }
    const files = await api(`/files?folderId=${folder.id}&limit=5`, { token });
    if (list(files).length > 0) continue;
    const formData = new FormData();
    formData.append('file', new Blob([policy.content], { type: 'text/plain' }), policy.file);
    formData.append('folderId', folder.id);
    await api('/files/upload', { token, method: 'POST', formData });
    console.log(`  Tai len "${policy.file}" vao "${policy.name}"`);
  }
}

async function migrate({ token, skipMembers = false } = {}) {
  const accessToken = token ?? (await login());
  const projects = list(await api('/projects?limit=100', { token: accessToken }));
  const folders = list(await api('/folders', { token: accessToken }));
  console.log(`Tai lieu theo du an: ${projects.length} du an, ${folders.length} thu muc cap goc`);
  const linked = await linkProjectFolders(accessToken, projects, folders);
  const added = skipMembers ? 0 : await addAssigneesAsMembers(accessToken, projects);
  await ensurePolicyFolders(accessToken, folders);
  console.log(`Xong: gan ${linked} thu muc vao du an, them ${added} thanh vien du an.`);
}

module.exports = { migrate };

if (require.main === module) {
  migrate({ skipMembers: process.argv.includes('--skip-members') }).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
