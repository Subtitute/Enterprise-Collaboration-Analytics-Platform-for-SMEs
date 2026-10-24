// 24/10/2026: kich ban 06 - Bao cao/phan tich (dashboard KPI, drill-down, phat hien bat thuong
// IsolationForest cua ml-service), thong bao, nhat ky su kien loi (DLQ) va nhan tin noi bo. Khong goi
// POST /analytics/ai-insights (luon goi Gemini); GET dung cache Redis 30 phut, cache trong thi goi
// Gemini 1 lan (that bai -> nhan xet du phong, van 200). Tin nhan kiem thu bi xoa qua API; cuoc tro
// chuyen chi bi xoa (thang trong postgres-messaging) neu chinh kich ban tao moi no.
const { api, decode, login, list, check, summary, sql, q } = require('./lib');
const TAG = `MOCK-${Date.now().toString(36)}`;

(async () => {
  let conv = null;
  let convIsNew = false;
  let msgId = null;
  try {
    // 1. Analytics - Manager/Org Admin xem duoc, Employee bi chan
    const endpoints = ['summary', 'task-trend', 'task-status-breakdown', 'document-activity', 'product-sales-trend', 'top-products', 'project-progress', 'recent-activity'];
    for (const who of ['admin', 'manager']) {
      const st = [];
      for (const e of endpoints) st.push(`${e}=${(await api(who, 'GET', `/analytics/${e}`)).status}`);
      check(`${who} xem 8 bieu do dashboard`, st.every((x) => x.endsWith('=200')), st.filter((x) => !x.endsWith('=200')).join(' '));
    }
    const sum = await api('admin', 'GET', '/analytics/summary');
    check('summary co so lieu', sum.status === 200 && Object.keys(sum.data || {}).length > 0, JSON.stringify(sum.data).slice(0, 160));
    check('Employee xem dashboard -> 403', (await api('employee', 'GET', '/analytics/summary')).status === 403);
    const projects = list((await api('admin', 'GET', '/projects?limit=5')).data);
    if (projects[0]) {
      const dd = await api('admin', 'GET', `/analytics/drill-down?scope=project&scopeId=${projects[0].id}&range=30d`);
      check('drill-down theo du an', dd.status === 200, dd.status);
    }
    check('drill-down scope sai -> 400', (await api('admin', 'GET', '/analytics/drill-down?scope=abc&scopeId=x')).status === 400);
    const ai = await api('manager', 'GET', '/analytics/ai-insights');
    check('doc nhan xet AI (GET, cache 30 phut)', ai.status === 200, `${ai.status} ${ai.ms}ms`);

    // 2. ML - phat hien bat thuong (ml:view; Manager chi thay phong ban minh)
    const ml = await api('manager', 'POST', '/ml/anomalies?range=30d', {});
    check('Manager chay phat hien bat thuong', ml.status === 200 && typeof ml.data.sampleSize === 'number', `${ml.status} sample=${ml.data && ml.data.sampleSize} n=${ml.data && (ml.data.anomalies || []).length}`);
    check('Employee chay phat hien bat thuong -> 403', (await api('employee', 'POST', '/ml/anomalies?range=30d', {})).status === 403);
    check('range sai -> 422/400', [400, 422].includes((await api('manager', 'POST', '/ml/anomalies?range=1y', {})).status));
    const fe = await api('employee', 'GET', '/ml/face/enrollment');
    check('Employee xem trang thai dang ky khuon mat', fe.status === 200, `${fe.status} ${JSON.stringify(fe.data).slice(0, 80)}`);

    // 3. Thong bao + DLQ
    const no = await api('employee', 'GET', '/notifications?limit=10');
    check('Employee xem thong bao', no.status === 200, `${no.status} n=${list(no.data).length}`);
    check('Org Admin xem su kien loi (DLQ)', (await api('admin', 'GET', '/failed-events')).status === 200);
    check('Manager xem DLQ -> 403', (await api('manager', 'GET', '/failed-events')).status === 403);

    // 4. Nhan tin 1:1 Manager <-> Employee
    const empId = decode(await login('employee')).sub;
    const before = list((await api('manager', 'GET', '/conversations?limit=100')).data).map((c) => c.id);
    const c = await api('manager', 'POST', '/conversations', { type: 'DIRECT', participantUserIds: [empId] });
    conv = c.data && c.data.id;
    convIsNew = !!conv && !before.includes(conv);
    check('Manager mo cuoc tro chuyen 1:1', c.status === 201 || c.status === 200, `${c.status} moi=${convIsNew}`);
    const again = await api('manager', 'POST', '/conversations', { type: 'DIRECT', participantUserIds: [empId] });
    check('mo lai 1:1 tra ve cung cuoc tro chuyen (khong trung)', again.data && again.data.id === conv, again.status);
    const m = await api('manager', 'POST', `/conversations/${conv}/messages`, { body: `Chào em, ${TAG}` });
    msgId = m.data && m.data.id;
    check('Manager gui tin nhan', m.status === 201, m.status);
    check('tin nhan rong -> 400', (await api('manager', 'POST', `/conversations/${conv}/messages`, { body: '' })).status === 400);
    const em = list((await api('employee', 'GET', `/conversations/${conv}/messages?limit=20`)).data);
    check('Employee doc duoc tin nhan', JSON.stringify(em).includes(TAG), `n=${em.length}`);
    check('Employee danh dau da doc', (await api('employee', 'PATCH', `/conversations/${conv}/read`, {})).status < 300);
    check('Admin (khong tham gia) doc tin nhan -> 403/404', [403, 404].includes((await api('admin', 'GET', `/conversations/${conv}/messages`)).status));
    check('Employee xoa tin cua Manager -> 403', (await api('employee', 'DELETE', `/conversations/${conv}/messages/${msgId}`)).status === 403);
  } catch (e) {
    check('ngoai le', false, e.stack);
  } finally {
    if (msgId) check('don dep: xoa tin nhan', (await api('manager', 'DELETE', `/conversations/${conv}/messages/${msgId}`)).status < 300);
    if (convIsNew) {
      sql('postgres-messaging', `delete from messages where conversation_id = ${q(conv)}; delete from conversation_participants where conversation_id = ${q(conv)}; delete from conversations where id = ${q(conv)};`);
      check('don dep: xoa cuoc tro chuyen kiem thu', sql('postgres-messaging', `select count(*) from conversations where id = ${q(conv)};`) === '0');
    } else if (msgId) {
      // Cuoc tro chuyen co san: xoa han tin nhan kiem thu (API chi xoa mem).
      sql('postgres-messaging', `delete from messages where id = ${q(msgId)};`);
    }
    summary();
  }
})();
