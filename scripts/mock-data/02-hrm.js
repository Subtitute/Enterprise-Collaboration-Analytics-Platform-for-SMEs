// 24/10/2026: kich ban 02 - HRM: cham cong (anh + GPS + diem khop khuon mat la co "mem", khong
// chan check-in), don nghi phep (Employee tao -> Manager duyet), dang ky tang ca (Manager tu choi),
// lich cong ty (Manager tao HOLIDAY, Employee bi chan). Ban ghi cham cong/don khong co API xoa
// (co chu dich, de lam bang chung) nen phan don dep xoa thang trong postgres-hrm + MinIO.
// Luu y: nhan vien dung de check-in phai CHUA cham cong hom nay (neu da co, check-in tra 400
// ALREADY_CHECKED_IN_TODAY va buoc nay bi bo qua, kich ban khong xoa ban ghi co san).
const { api, list, check, summary, sql, q, minioRm, purgeTraces, sleep } = require('./lib');
const TAG = `MOCK-${Date.now().toString(36)}`;
// JPEG 1x1 hop le (chu ky FF D8 FF duoc hrm-service kiem tra).
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64',
);
const DATE = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

function photoForm(extra) {
  const fd = new FormData();
  fd.append('photo', new Blob([JPEG], { type: 'image/jpeg' }), 'checkin.jpg');
  for (const [k, v] of Object.entries(extra)) fd.append(k, String(v));
  return fd;
}

(async () => {
  const since = Date.now();
  const created = { attendance: null, attendanceKeys: [], leave: null, overtime: null, event: null };
  try {
    // 1. Cham cong - thieu anh -> 400; co anh + GPS + faceMatchScore thap -> van thanh cong (co mem)
    check('check-in thieu anh -> 400', (await api('employee', 'POST', '/attendance/check-in', new FormData())).status === 400);
    const bad = await api('employee', 'POST', '/attendance/check-in', photoForm({ latitude: 999, longitude: 105.8 }));
    check('check-in vi do ngoai mien gia tri -> 400', bad.status === 400, bad.status);
    const ci = await api('employee', 'POST', '/attendance/check-in', photoForm({ latitude: 21.0285, longitude: 105.8048, faceMatchScore: 0.2 }));
    if (ci.status === 400 && ci.data && ci.data.errorCode === 'ALREADY_CHECKED_IN_TODAY') {
      check('check-in (bo qua: nhan vien da cham cong hom nay)', true, JSON.stringify(ci.data).slice(0, 120));
    } else {
      created.attendance = ci.data && ci.data.id;
      if (ci.data && ci.data.checkInPhotoObjectKey) created.attendanceKeys.push(ci.data.checkInPhotoObjectKey);
      check('check-in co anh + GPS + face score thap van thanh cong (co mem)', ci.status === 201 && ci.data.checkInFaceMatched === false,
        `${ci.status} onSite=${ci.data && ci.data.checkInIsOnSite} faceMatched=${ci.data && ci.data.checkInFaceMatched}`);
      const again = await api('employee', 'POST', '/attendance/check-in', photoForm({}));
      check('check-in lan 2 trong ngay -> 400 ALREADY_CHECKED_IN_TODAY', again.status === 400 && again.data.errorCode === 'ALREADY_CHECKED_IN_TODAY', again.status);
      const co = await api('employee', 'POST', '/attendance/check-out', photoForm({ faceMatchScore: 0.9 }));
      if (co.data && co.data.checkOutPhotoObjectKey) created.attendanceKeys.push(co.data.checkOutPhotoObjectKey);
      check('check-out (face score cao -> khop)', co.status === 201 && co.data.checkOutFaceMatched === true,
        `${co.status} faceMatched=${co.data && co.data.checkOutFaceMatched}`);
      const me = list((await api('employee', 'GET', '/attendance/me?limit=5')).data);
      check('lich su cham cong cua toi co ban ghi moi', me.some((a) => a.id === created.attendance));
      const ph = await api('manager', 'GET', `/attendance/${created.attendance}/photo?kind=checkin`);
      check('Manager xem anh cham cong (URL tam)', ph.status === 200, `${ph.status} ${JSON.stringify(ph.data).slice(0, 100)}`);
      const phe = await api('employee', 'GET', `/attendance/${created.attendance}/photo?kind=checkin`);
      check('Employee xem anh cua chinh minh', phe.status === 200, phe.status);
    }
    check('Employee xem cham cong toan cong ty -> 403', (await api('employee', 'GET', '/attendance')).status === 403);
    check('Manager xem cham cong toan cong ty', (await api('manager', 'GET', '/attendance?limit=5')).status === 200);

    // 2. Nghi phep: Employee tao -> Manager duyet
    const bal0 = (await api('employee', 'GET', '/leave-requests/me/balance')).data;
    check('xem so ngay phep', bal0 && typeof bal0.usedDays === 'number', JSON.stringify(bal0));
    const inv = await api('employee', 'POST', '/leave-requests', { startDate: DATE(160), endDate: DATE(150), reason: TAG });
    check('don nghi phep endDate < startDate -> 400', inv.status === 400, inv.status);
    const lr = await api('employee', 'POST', '/leave-requests', { startDate: DATE(150), endDate: DATE(150), reason: `Việc gia đình ${TAG}` });
    created.leave = lr.data && lr.data.id;
    check('Employee tao don nghi phep', lr.status === 201 && lr.data.status === 'PENDING', `${lr.status} ${JSON.stringify(lr.data).slice(0, 120)}`);
    check('Employee tu duyet -> 403', (await api('employee', 'PATCH', `/leave-requests/${created.leave}/approve`, {})).status === 403);
    const pend = list((await api('manager', 'GET', '/leave-requests?status=PENDING&limit=100')).data);
    check('Manager thay don cho duyet', pend.some((x) => x.id === created.leave), `n=${pend.length}`);
    const ap = await api('manager', 'PATCH', `/leave-requests/${created.leave}/approve`, { decisionNote: 'Đồng ý' });
    check('Manager duyet don', ap.status === 200 && ap.data.status === 'APPROVED', `${ap.status} ${ap.data && ap.data.status}`);
    check('duyet lai don da duyet -> 4xx', (await api('manager', 'PATCH', `/leave-requests/${created.leave}/approve`, {})).status >= 400);
    // Thong bao real-time: outbox hrm -> Kafka -> notification-service -> Employee nhan thong bao
    let noti = null;
    for (let i = 0; i < 15 && !noti; i++) {
      await sleep(1000);
      noti = list((await api('employee', 'GET', '/notifications?limit=20')).data).find((n) => JSON.stringify(n).includes(created.leave));
    }
    check('Employee nhan thong bao don nghi phep da duyet', !!noti, noti ? `${noti.type} - ${noti.title}` : 'khong thay sau 15s');
    if (noti) check('danh dau thong bao da doc', (await api('employee', 'PATCH', `/notifications/${noti._id || noti.id}/read`, {})).status === 200);

    // 3. Tang ca: Employee dang ky -> Manager tu choi
    const ot = await api('employee', 'POST', '/overtime-requests', { workDate: DATE(151), otStart: '18:00', otEnd: '20:00', multiplierType: 'WEEKDAY', reason: `Chốt số liệu ${TAG}` });
    created.overtime = ot.data && ot.data.id;
    check('Employee dang ky tang ca', ot.status === 201, `${ot.status} ${JSON.stringify(ot.data).slice(0, 120)}`);
    const rj = await api('manager', 'PATCH', `/overtime-requests/${created.overtime}/reject`, { decisionNote: 'Không cần thiết' });
    check('Manager tu choi tang ca', rj.status === 200 && rj.data.status === 'REJECTED', `${rj.status} ${rj.data && rj.data.status}`);

    // 4. Lich cong ty
    const eh = await api('employee', 'POST', '/calendar-events', { title: TAG, type: 'HOLIDAY', startDate: DATE(152) });
    check('Employee tao HOLIDAY -> 403', eh.status === 403, eh.status);
    if (eh.status < 300) await api('admin', 'DELETE', `/calendar-events/${eh.data.id}`);
    const ev = await api('manager', 'POST', '/calendar-events', { title: `Nghỉ bù ${TAG}`, type: 'HOLIDAY', startDate: DATE(152) });
    created.event = ev.data && ev.data.id;
    check('Manager tao ngay nghi le', ev.status === 201, ev.status);
    const cal = await api('employee', 'GET', `/calendar-events?startDate=${DATE(140)}&endDate=${DATE(160)}`);
    check('Employee xem lich thay ngay le moi', JSON.stringify(cal.data).includes(TAG), cal.status);
  } catch (e) {
    check('ngoai le', false, e.stack);
  } finally {
    if (created.event) check('don dep: xoa ngay le', (await api('manager', 'DELETE', `/calendar-events/${created.event}`)).status < 300);
    await sleep(1500);
    for (const [table, id] of [['overtime_requests', created.overtime], ['leave_requests', created.leave], ['attendances', created.attendance]]) {
      if (!id) continue;
      sql('postgres-hrm', `delete from outbox_events where payload::text like ${q('%' + id + '%')}; delete from ${table} where id = ${q(id)};`);
      check(`don dep: xoa ${table}`, sql('postgres-hrm', `select count(*) from ${table} where id = ${q(id)};`) === '0');
    }
    for (const key of created.attendanceKeys) {
      try { minioRm('hrm-attendance', key); } catch (e) { check(`don dep anh ${key}`, false, e.message); }
    }
    const p = await purgeTraces([created.attendance, created.leave, created.overtime, created.event], since);
    console.log(`don dep su kien: ${JSON.stringify(p)}`);
    summary();
  }
})();
