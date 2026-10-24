// 24/10/2026: helper dung chung cho bo kich ban kiem thu live (scripts/mock-data) - goi thang
// Gateway bang fetch cua Node (>= 18). Base URL va tai khoan doc tu bien moi truong, mac dinh la
// tai khoan demo (xem Doc/Mock_data.md muc 2). Dung 127.0.0.1 thay vi localhost de tranh Node uu
// tien IPv6 (::1) tren Windows.
const BASE = process.env.ECAP_API_BASE || 'http://127.0.0.1:3000/api/v1';
const PASSWORD = process.env.ECAP_PASSWORD || 'Password123!';
const ACCOUNTS = {
  admin: [process.env.ECAP_ADMIN_EMAIL || 'admin@demo-sme.vn', PASSWORD],
  manager: [process.env.ECAP_MANAGER_EMAIL || 'an.nguyen+227860@demo-sme.vn', PASSWORD],
  employee: [process.env.ECAP_EMPLOYEE_EMAIL || 'duc.hoang+227860@demo-sme.vn', PASSWORD],
  superadmin: [
    process.env.ECAP_SUPERADMIN_EMAIL || 'superadmin@ecap-platform.local',
    process.env.ECAP_SUPERADMIN_PASSWORD || 'SuperAdmin123!',
  ],
};
const tokens = {};

async function call(method, path, token, body, headers = {}) {
  const isForm = body instanceof FormData;
  const t0 = Date.now();
  const doFetch = () => fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(isForm || body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: isForm ? body : body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  let res;
  try {
    res = await doFetch();
  } catch (e) {
    // Cong Docker Desktop doi khi reset ket noi khi may dang build/khoi dong lai container - thu lai
    // 1 lan cho GET va dang nhap (an toan khi lap lai), cac lenh ghi khac van nem loi de khong tao trung.
    if (!(method === 'GET' || path === '/auth/login')) throw e;
    await sleep(1000);
    res = await doFetch();
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const ctype = res.headers.get('content-type') || '';
  let data = buf;
  if (!ctype.includes('octet-stream') && !ctype.startsWith('application/pdf') && !ctype.includes('officedocument')) {
    const text = buf.toString('utf8');
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  }
  return { status: res.status, data, ms: Date.now() - t0, headers: res.headers };
}

async function loginRaw(email, password) {
  return call('POST', '/auth/login', null, { email, password });
}

/** Dang nhap theo vai tro ('admin' | 'manager' | 'employee' | 'superadmin'), cache token. */
async function login(who) {
  if (tokens[who]) return tokens[who];
  const [email, password] = ACCOUNTS[who];
  const r = await loginRaw(email, password);
  const tok = r.data && (r.data.accessToken || (r.data.tokens && r.data.tokens.accessToken));
  if (!tok) throw new Error(`login ${who} -> ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
  tokens[who] = tok;
  return tok;
}

/** Goi API voi vai tro `who` (tu dang nhap). */
async function api(who, method, path, body, headers) {
  return call(method, path, await login(who), body, headers);
}

/** Tai tep len (POST /files/upload, hoac /files/:id/upload = phien ban moi). */
async function upload(who, name, content, mime, folderId, fileId) {
  const fd = new FormData();
  fd.append('file', new Blob([content], { type: mime }), name);
  if (folderId) fd.append('folderId', folderId);
  return api(who, 'POST', `/files/${fileId ? fileId + '/' : ''}upload`, fd);
}

const decode = (jwt) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const list = (d) => (Array.isArray(d) ? d : (d && (d.data || d.items || d.results)) || []);

// Bo dem ket qua PASS/FAIL dung chung cho moi kich ban.
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + String(detail).slice(0, 300) : ''}`);
  return !!ok;
}
function summary() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exitCode = 1;
}

// --- Don dep phu tro (chi dung khi API khong co endpoint xoa) ---------------------------------
// Mot so du lieu nghiep vu co chu dich KHONG co API xoa (ban ghi cham cong, don nghi phep/tang ca,
// so cai nhap/xuat kho, su kien phan tich, thong bao). De kich ban khong de lai rac trong to chuc
// demo, cac ham duoi day xoa thang qua `docker exec` vao dung container CSDL (ten container theo
// infra/docker-compose.yml). Chi xoa ban ghi chua id do chinh kich ban tao ra.
const { execFileSync } = require('child_process');

/** Chay 1 cau SQL trong container Postgres (dung bien moi truong POSTGRES_USER/DB cua container). */
function sql(container, query) {
  return execFileSync('docker', ['exec', '-i', container, 'sh', '-c', 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At'], { input: query })
    .toString()
    .trim();
}

/** Chay 1 doan JS trong mongosh cua MongoDB (CSDL notification). */
function mongo(js) {
  // JS truyen qua tham so vi tri $1 cua sh (khong qua stdin: mongosh doc stdin se in kem prompt).
  return execFileSync('docker', ['exec', 'mongodb', 'sh', '-c',
    'mongosh --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin "$MONGO_INITDB_DATABASE" --eval "$1"', 'sh', js])
    .toString()
    .trim();
}

/** Xoa 1 object trong MinIO (vd anh cham cong) bang mc ben trong container minio. */
function minioRm(bucket, key) {
  return execFileSync('docker', ['exec', 'minio', 'sh', '-c',
    `mc alias set local http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null && mc rm --quiet "local/${bucket}/${key}"`]).toString().trim();
}

const q = (id) => `'${String(id).replace(/'/g, "''")}'`;

/**
 * Xoa dau vet su kien (bang fact_* cua analytics, thong bao trong MongoDB) phat sinh tu cac id da
 * tao ke tu thoi diem `since`. Doi vai giay de consumer Kafka xu ly xong truoc khi xoa.
 */
async function purgeTraces(ids, since, waitMs = 4000) {
  ids = ids.filter(Boolean);
  if (!ids.length) return { facts: 0, notifications: 0 };
  await sleep(waitMs);
  const iso = new Date(since).toISOString();
  let facts = 0;
  for (const t of ['fact_task_events', 'fact_document_events', 'fact_user_activity', 'fact_product_sales']) {
    const cond = ids.map((id) => `row_to_json(t)::text like ${q('%' + id + '%')}`).join(' or ');
    const out = sql('timescaledb', `with d as (delete from ${t} t where time >= ${q(iso)} and (${cond}) returning 1) select count(*) from d;`);
    facts += Number(out) || 0;
  }
  const notifications = Number(mongo(
    `const ids=${JSON.stringify(ids)};let n=0;db.notifications.find({createdAt:{$gte:new Date(${JSON.stringify(iso)})}}).forEach(d=>{const s=JSON.stringify(d);if(ids.some(i=>s.includes(i))){db.notifications.deleteOne({_id:d._id});n++;}});print(n);`,
  )) || 0;
  return { facts, notifications };
}

module.exports = { BASE, ACCOUNTS, call, loginRaw, login, api, upload, decode, sleep, list, check, summary, sql, mongo, minioRm, q, purgeTraces };
