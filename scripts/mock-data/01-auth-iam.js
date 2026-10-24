// 24/10/2026: kich ban 01 - Xac thuc (dang nhap 4 vai tro, refresh qua cookie, logout + token bi
// thu hoi, quen mat khau -> email trong MailHog) va IAM/quan tri (phong ban, moi thanh vien, doi
// vai tro, phan quyen). Moi du lieu tao ra (phong ban, thanh vien, email MailHog) deu bi xoa o cuoi.
// Chay: node scripts/mock-data/01-auth-iam.js
const { ACCOUNTS, call, loginRaw, api, decode, list, check, summary, purgeTraces } = require('./lib');
const MAILHOG = process.env.ECAP_MAILHOG_URL || 'http://127.0.0.1:8025';
const TAG = `MOCK-${Date.now().toString(36)}`;

(async () => {
  const since = Date.now();
  const created = { dept: null, user: null, email: null };
  try {
    // 1. Dang nhap + JWT dung vai tro
    for (const who of ['admin', 'manager', 'employee', 'superadmin']) {
      const r = await loginRaw(...ACCOUNTS[who]);
      const tok = r.data && r.data.accessToken;
      const p = tok ? decode(tok) : {};
      check(`login ${who}`, r.status === 200 || r.status === 201, `${r.status} roles=${JSON.stringify(p.roles)} perms=${(p.permissions || []).length}`);
    }
    check('login sai mat khau -> 401', (await loginRaw(ACCOUNTS.employee[0], 'SaiMatKhau!1')).status === 401);
    check('khong token -> 401', (await call('GET', '/users', null)).status === 401);

    // 2. Refresh token qua cookie HttpOnly, logout thu hoi access token
    const r = await loginRaw(...ACCOUNTS.employee);
    const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
    check('login tra cookie refresh', cookie.startsWith('ecap_refresh_token='), cookie.slice(0, 30));
    const rf = await call('POST', '/auth/refresh', null, {}, { Cookie: cookie });
    check('refresh -> access token moi', (rf.status === 200 || rf.status === 201) && !!rf.data.accessToken, rf.status);
    const me = await call('GET', '/auth/me', rf.data.accessToken);
    check('GET /auth/me', me.status === 200 && me.data.email === ACCOUNTS.employee[0], me.status);
    const lo = await call('POST', '/auth/logout', rf.data.accessToken, {}, { Cookie: (rf.headers.get('set-cookie') || cookie).split(';')[0] });
    check('logout', lo.status < 300, lo.status);
    // Access token la JWT stateless (TTL ngan) nen van dung den khi het han; logout thu hoi refresh token.
    const cookie2 = (rf.headers.get('set-cookie') || cookie).split(';')[0];
    check('refresh token da logout bi tu choi', (await call('POST', '/auth/refresh', null, {}, { Cookie: cookie2 })).status === 401);

    // 3. Quen mat khau -> email dat lai trong MailHog (khong dat lai that de giu mat khau demo)
    const fp = await call('POST', '/auth/forgot-password', null, { email: ACCOUNTS.employee[0] });
    check('forgot-password', fp.status < 300, `${fp.status} ${JSON.stringify(fp.data).slice(0, 120)}`);
    let mail = null;
    for (let i = 0; i < 10 && !mail; i++) {
      await new Promise((s) => setTimeout(s, 1000));
      const box = await fetch(`${MAILHOG}/api/v2/search?kind=to&query=${encodeURIComponent(ACCOUNTS.employee[0])}`).then((x) => x.json()).catch(() => null);
      mail = box && box.items && box.items.find((m) => Date.now() - new Date(m.Created).getTime() < 60000);
    }
    check('email dat lai mat khau den MailHog', !!mail, mail ? mail.Content.Headers.Subject : 'khong thay');
    if (mail) await fetch(`${MAILHOG}/api/v1/messages/${mail.ID}`, { method: 'DELETE' });

    // 4. IAM - phan quyen theo vai tro
    // Danh ba thanh vien (GET /users) mo cho moi thanh vien (giao viec, nhan tin); ho so day du
    // cua nguoi khac (GET /users/:id) chi danh cho chinh minh hoac user:manage.
    const dir = list((await api('employee', 'GET', '/users?limit=100')).data);
    check('Employee xem danh ba thanh vien', dir.length > 0, `n=${dir.length}`);
    const other = dir.find((u) => u.email !== ACCOUNTS.employee[0]);
    check('Employee GET /users/:id nguoi khac -> 403', (await api('employee', 'GET', `/users/${other.id}`)).status === 403);
    check('Manager GET /roles -> 403', (await api('manager', 'GET', '/roles')).status === 403);
    const users = await api('admin', 'GET', '/users?limit=100');
    check('Admin GET /users', users.status === 200 && list(users.data).length > 0, `n=${list(users.data).length}`);
    const roles = list((await api('admin', 'GET', '/roles')).data);
    const empRole = roles.find((x) => x.name === 'Employee');
    const mgrRole = roles.find((x) => x.name === 'Manager');
    const perms = list((await api('admin', 'GET', '/roles/permissions')).data);
    check('GET /roles/permissions co chatbot:use, ml:view, warehouse:manage', ['chatbot:use', 'ml:view', 'warehouse:manage'].every((k) => perms.some((p) => p.key === k)), `n=${perms.length}`);

    // 5. Phong ban + moi thanh vien + doi vai tro + vo hieu hoa
    const d = await api('admin', 'POST', '/departments', { name: `Phòng ${TAG}` });
    created.dept = d.data && d.data.id;
    check('tao phong ban', d.status === 201, d.status);
    check('Manager tao phong ban -> 403', (await api('manager', 'POST', '/departments', { name: `X ${TAG}` })).status === 403);
    const email = (created.email = `${TAG.toLowerCase()}@mock.demo-sme.vn`);
    const inv = await api('admin', 'POST', '/users/invite', { email, fullName: `Thành viên ${TAG}`, initialPassword: 'Password123!', departmentId: created.dept, roleIds: [empRole.id] });
    created.user = inv.data && (inv.data.id || (inv.data.user && inv.data.user.id));
    check('moi thanh vien', inv.status === 201 && !!created.user, `${inv.status} ${JSON.stringify(inv.data).slice(0, 150)}`);
    const nl = await loginRaw(email, 'Password123!');
    check('thanh vien moi dang nhap duoc', nl.status === 200 || nl.status === 201, nl.status);
    const up = await api('admin', 'PATCH', `/users/${created.user}`, { roleIds: [mgrRole.id] });
    check('doi vai tro -> Manager', up.status === 200, up.status);
    const de = await api('admin', 'PATCH', `/users/${created.user}/deactivate`, {});
    check('vo hieu hoa thanh vien', de.status === 200, de.status);
    check('thanh vien bi vo hieu hoa khong dang nhap duoc', (await loginRaw(email, 'Password123!')).status >= 400);
    const audit = await api('admin', 'GET', '/roles/audit-log');
    check('nhat ky phan quyen (audit-log)', audit.status === 200, audit.status);

    // 6. Super Admin (nen tang)
    const orgs = await api('superadmin', 'GET', '/platform-admin/organizations');
    check('Super Admin xem danh sach to chuc', orgs.status === 200 && list(orgs.data).length > 0, `n=${list(orgs.data).length}`);
    check('Super Admin xem stats', (await api('superadmin', 'GET', '/platform-admin/stats')).status === 200);
    check('Org Admin goi platform-admin -> 403', (await api('admin', 'GET', '/platform-admin/stats')).status === 403);
  } catch (e) {
    check('ngoai le', false, e.stack);
  } finally {
    if (created.user) check('don dep: xoa thanh vien', (await api('admin', 'DELETE', `/users/${created.user}`)).status < 300);
    if (created.dept) check('don dep: xoa phong ban', (await api('admin', 'DELETE', `/departments/${created.dept}`)).status < 300);
    if (created.email) {
      const box = await fetch(`${MAILHOG}/api/v2/search?kind=to&query=${encodeURIComponent(created.email)}`).then((x) => x.json()).catch(() => null);
      for (const m of (box && box.items) || []) await fetch(`${MAILHOG}/api/v1/messages/${m.ID}`, { method: 'DELETE' });
    }
    console.log(`don dep su kien: ${JSON.stringify(await purgeTraces([created.user, created.dept], since))}`);
    summary();
  }
})();
