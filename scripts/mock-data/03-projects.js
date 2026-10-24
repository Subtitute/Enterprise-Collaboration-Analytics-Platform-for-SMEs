// 24/10/2026: kich ban 03 - Du an & Cong viec: Manager tao du an, them Employee lam thanh vien,
// giao viec; Employee keo trang thai TODO -> DOING -> DONE, binh luan; kiem tra phan quyen va
// chuyen trang thai khong hop le. Du an (kem cong viec) bi xoa o cuoi, dau vet su kien bi don.
const { api, decode, login, list, check, summary, purgeTraces, sleep } = require('./lib');
const TAG = `MOCK-${Date.now().toString(36)}`;
const DATE = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

(async () => {
  const since = Date.now();
  const ids = [];
  let projectId = null;
  try {
    const empId = decode(await login('employee')).sub;
    check('Employee tao du an -> 403', (await api('employee', 'POST', '/projects', { name: TAG })).status === 403);
    const p = await api('manager', 'POST', '/projects', { name: `Dự án ${TAG}`, description: 'Dự án kiểm thử', dueDate: DATE(30), priority: 'HIGH' });
    projectId = p.data && p.data.id;
    ids.push(projectId);
    check('Manager tao du an', p.status === 201, `${p.status} ${JSON.stringify(p.data).slice(0, 120)}`);
    check('them Employee vao du an', (await api('manager', 'POST', `/projects/${projectId}/members`, { userId: empId })).status === 201);
    const members = list((await api('manager', 'GET', `/projects/${projectId}/members`)).data);
    check('danh sach thanh vien co Employee', JSON.stringify(members).includes(empId), `n=${members.length}`);

    const t = await api('manager', 'POST', '/tasks', { projectId, title: `Soạn báo cáo ${TAG}`, description: 'Báo cáo tuần', dueDate: DATE(7) });
    const taskId = t.data && t.data.id;
    ids.push(taskId);
    check('Manager tao cong viec', t.status === 201 && t.data.status === 'TODO', t.status);
    check('giao viec cho Employee', (await api('manager', 'POST', `/tasks/${taskId}/assignees`, { userId: empId })).status === 201);
    const mine = list((await api('employee', 'GET', `/tasks?projectId=${projectId}`)).data);
    check('Employee thay cong viec trong du an', mine.some((x) => x.id === taskId), `n=${mine.length}`);
    const s1 = await api('employee', 'PATCH', `/tasks/${taskId}/status`, { status: 'DOING' });
    check('Employee chuyen TODO -> DOING', s1.status === 200 && s1.data.status === 'DOING', s1.status);
    const s2 = await api('employee', 'PATCH', `/tasks/${taskId}/status`, { status: 'DONE' });
    check('Employee chuyen DOING -> DONE', s2.status === 200 && s2.data.status === 'DONE', s2.status);
    check('trang thai khong ton tai -> 400', (await api('employee', 'PATCH', `/tasks/${taskId}/status`, { status: 'XYZ' })).status === 400);
    const c = await api('employee', 'POST', `/tasks/${taskId}/comments`, { content: `Đã xong ${TAG}` });
    check('Employee binh luan', c.status === 201, c.status);
    const hist = list((await api('manager', 'GET', `/tasks/${taskId}/status-history`)).data);
    check('lich su trang thai co 2 lan chuyen', hist.length >= 2, `n=${hist.length}`);
    check('Employee xoa cong viec -> 403', (await api('employee', 'DELETE', `/tasks/${taskId}`)).status === 403);
    check('Employee xoa du an -> 403', (await api('employee', 'DELETE', `/projects/${projectId}`)).status === 403);
    const done = await api('manager', 'POST', `/projects/${projectId}/complete`, {});
    check('Manager hoan thanh du an', done.status < 300, done.status);
    const det = await api('admin', 'GET', `/projects/${projectId}`);
    check('Org Admin xem chi tiet du an', det.status === 200, `${det.status} status=${det.data && det.data.status}`);
  } catch (e) {
    check('ngoai le', false, e.stack);
  } finally {
    if (projectId) {
      const d = await api('admin', 'DELETE', `/projects/${projectId}`);
      check('don dep: xoa du an', d.status < 300, d.status);
      await sleep(500);
      check('du an da bi xoa (404)', (await api('admin', 'GET', `/projects/${projectId}`)).status === 404);
    }
    console.log(`don dep su kien: ${JSON.stringify(await purgeTraces(ids, since))}`);
    summary();
  }
})();
