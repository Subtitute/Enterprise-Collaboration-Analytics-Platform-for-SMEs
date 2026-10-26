// 26/10/2026: du lieu demo CRM - seed.js tao moi khach hang bang Org Admin nen ownerUserId deu la Org Admin,
// trong khi pham vi du lieu cua Manager (Technical_Spec.md muc 28) chi cho Manager/nhan vien thay khach hang do
// minh hoac thanh vien phong ban phu trach -> man hinh CRM cua Manager/nhan vien demo trong tron. Script nay
// giao 8 khach hang CU NHAT cho phong "Kinh doanh": 3 cho truong phong (Department.managerId), 3 cho nhan vien
// demo chinh, 2 cho 1 nhan vien khac cung phong. Deal di theo khach hang (pham vi deal gom "deal thuoc khach
// hang minh phu trach"), khong can doi ownerUserId cua deal. Chay nhieu lan van an toan (chi PATCH khi khac).
//
// Cach chay: node scripts/migrate-demo-ownership.js   (seed.js goi lai o cuoi)
// Bien moi truong: SEED_API_BASE_URL, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD (nhu seed.js),
// SEED_DEMO_EMPLOYEE_EMAIL (nhan vien demo chinh, mac dinh tai khoan cua scripts/mock-data).

const API_BASE_URL = process.env.SEED_API_BASE_URL || 'http://127.0.0.1:3000/api/v1';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@demo-sme.vn';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Password123!';
const DEMO_EMPLOYEE_EMAIL = process.env.SEED_DEMO_EMPLOYEE_EMAIL || 'duc.hoang+227860@demo-sme.vn';
const DEPARTMENT_NAME = 'Kinh doanh';
// So khach hang giao cho [truong phong, nhan vien demo, nhan vien thu 2].
const SHARES = [3, 3, 2];

async function api(path, { token, method = 'GET', body } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
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

async function migrateDemoOwnership({ token } = {}) {
  const accessToken =
    token ?? (await api('/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })).accessToken;
  const department = list(await api('/departments', { token: accessToken })).find((d) => d.name === DEPARTMENT_NAME);
  if (!department) {
    console.log(`CRM demo: khong co phong "${DEPARTMENT_NAME}" - bo qua.`);
    return;
  }
  const members = list(await api('/users?limit=500', { token: accessToken }))
    .filter((u) => u.departmentId === department.id && u.isActive)
    .sort((a, b) => a.email.localeCompare(b.email));
  const isEmployee = (u) => (u.roles ?? []).some((r) => r.name === 'Employee');
  const manager = members.find((u) => u.id === department.managerId) ?? members.find((u) => !isEmployee(u));
  const employees = members.filter(isEmployee);
  const mainEmployee = employees.find((u) => u.email === DEMO_EMPLOYEE_EMAIL) ?? employees[0];
  const secondEmployee = employees.find((u) => u !== mainEmployee);
  const owners = [manager, mainEmployee, secondEmployee];
  if (owners.some((u) => !u)) {
    console.log(`CRM demo: phong "${DEPARTMENT_NAME}" chua du 1 truong phong + 2 nhan vien - bo qua.`);
    return;
  }

  const customers = list(await api('/customers?limit=500', { token: accessToken })).sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  let changed = 0;
  let index = 0;
  for (let i = 0; i < owners.length; i += 1) {
    for (const customer of customers.slice(index, index + SHARES[i])) {
      if (customer.ownerUserId === owners[i].id) continue;
      await api(`/customers/${customer.id}`, { token: accessToken, method: 'PATCH', body: { ownerUserId: owners[i].id } });
      console.log(`  Khach hang "${customer.name}" -> ${owners[i].email}`);
      changed += 1;
    }
    index += SHARES[i];
  }
  console.log(`CRM demo: doi nguoi phu trach ${changed} khach hang (tong ${index} khach hang giao cho phong ${DEPARTMENT_NAME}).`);
}

module.exports = { migrateDemoOwnership };

if (require.main === module) {
  migrateDemoOwnership().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
