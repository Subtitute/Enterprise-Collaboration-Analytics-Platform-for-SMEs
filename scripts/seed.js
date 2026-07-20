// 2026-07-18: Script seed du lieu demo cho toan bo nen tang (General_idea.md muc 9 - giam thieu
// rui ro "du lieu demo khong du phong phu"). Chay sau khi `docker compose up` da khoi dong xong
// toan bo he thong (hoac cac service chay o local qua `npm run dev:*`).
//
// Cach chay:  npm run seed   (tu thu muc goc repo)
// Yeu cau bien moi truong SEED_API_BASE_URL (mac dinh http://localhost:3000/api/v1).

const API_BASE_URL = process.env.SEED_API_BASE_URL || 'http://localhost:3000/api/v1';

const DEPARTMENTS = ['Kinh doanh', 'Ky thuat', 'Nhan su'];

const EMPLOYEES = [
  { fullName: 'Nguyen Van An', email: 'an.nguyen@demo-sme.vn' },
  { fullName: 'Tran Thi Binh', email: 'binh.tran@demo-sme.vn' },
  { fullName: 'Le Van Chi', email: 'chi.le@demo-sme.vn' },
  { fullName: 'Pham Thi Dung', email: 'dung.pham@demo-sme.vn' },
];

const PROJECTS = [
  { name: 'Website ban hang SME', description: 'Xay dung website thuong mai dien tu cho SME' },
  { name: 'Trien khai CRM noi bo', description: 'Trien khai he thong CRM quan ly khach hang' },
  { name: 'Nang cap ha tang Docker', description: 'Container hoa toan bo he thong noi bo' },
];

const TASK_TITLES = [
  'Thiet ke giao dien trang chu',
  'Tich hop cong thanh toan',
  'Viet tai lieu API',
  'Kiem thu chuc nang dang nhap',
  'Toi uu hoa truy van co so du lieu',
  'Chuan bi bao cao tien do tuan',
];

async function apiCall(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`${options.method || 'GET'} ${path} -> ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log(`Seeding vao ${API_BASE_URL} ...`);

  const suffix = Date.now().toString().slice(-6);
  const adminEmail = `admin+${suffix}@demo-sme.vn`;
  const adminPassword = 'Password123!';

  const registerRes = await apiCall('/auth/register-organization', {
    method: 'POST',
    body: JSON.stringify({
      organizationName: `Demo SME ${suffix}`,
      adminFullName: 'Quan Tri Vien Demo',
      adminEmail,
      adminPassword,
    }),
  });
  const { accessToken } = registerRes;
  const authHeaders = { Authorization: `Bearer ${accessToken}` };
  console.log(`Da tao to chuc "${registerRes.organization.name}" - Org Admin: ${adminEmail}`);

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

  for (const emp of EMPLOYEES) {
    await apiCall('/users/invite', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        email: emp.email,
        fullName: emp.fullName,
        initialPassword: adminPassword,
        departmentId: randomFrom(departments).id,
        roleIds: employeeRole ? [employeeRole.id] : [],
      }),
    });
  }
  console.log(`Da moi ${EMPLOYEES.length} nhan vien (mat khau: ${adminPassword})`);

  for (const proj of PROJECTS) {
    const project = await apiCall('/projects', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(proj),
    });

    const taskCount = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < taskCount; i += 1) {
      const task = await apiCall('/tasks', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          projectId: project.id,
          title: `${randomFrom(TASK_TITLES)} #${i + 1}`,
        }),
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
    console.log(`Du an "${project.name}": da tao ${taskCount} task`);
  }

  console.log('\n=== Seed hoan tat ===');
  console.log(`Dang nhap Org Admin: ${adminEmail} / ${adminPassword}`);
  console.log('Nhan vien demo dung chung mat khau tren.');
  console.log('Mo dashboard va cho vai giay de Analytics Service xu ly xong hang doi Kafka.');
}

main().catch((err) => {
  console.error('Seed that bai:', err.message);
  process.exit(1);
});
