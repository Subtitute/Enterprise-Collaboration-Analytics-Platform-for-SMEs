// 04/11/2026: kich ban 11 - nghi phep theo loai, lich lam viec, ky cong, sua tay, ngoai le tren he thong that,
// qua Gateway. CHI chay tren to chuc kiem thu rieng (admin@e2e-test.local, `npm run seed:e2e`), khong bao gio
// tren to chuc demo; moi du lieu tao ra deu duoc xoa o cuoi, ke ca khi co kiem tra that bai. Cac dong cua thang
// da qua khong tao duoc qua API (cham cong, don nghi co ngay qua khu) thi chen thang vao postgres-hrm.
// Chay: node scripts/mock-data/11-timesheet.js
process.env.ECAP_ADMIN_EMAIL = process.env.ECAP_E2E_ADMIN_EMAIL || 'admin@e2e-test.local';
process.env.ECAP_MANAGER_EMAIL = process.env.ECAP_E2E_MANAGER_EMAIL || 'an.nguyen+081386@demo-sme.vn';
process.env.ECAP_EMPLOYEE_EMAIL = process.env.ECAP_E2E_EMPLOYEE_EMAIL || 'duc.hoang+081386@demo-sme.vn';
const { ACCOUNTS, api, decode, login, list, check, summary, sql, q, purgeTraces, sleep } = require('./lib');

const TAG = `MOCK-TS-${Date.now().toString(36)}`;
const DAY_MS = 86400000;
const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const weekdayOf = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();
const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const isWeekend = (date) => weekdayOf(date) === 0 || weekdayOf(date) === 6;

function monthDates(month) {
  const dates = [];
  for (let date = `${month}-01`; date.startsWith(month); date = addDays(date, 1)) dates.push(date);
  return dates;
}
function previousMonth(date) {
  return addDays(`${date.slice(0, 7)}-01`, -1).slice(0, 7);
}
/** Ngay Thu 2 thu `week` tinh tu tuan sau, cach xa hien tai de khong dung don that. */
function futureMonday(week) {
  let date = addDays(today, 7 * week);
  while (weekdayOf(date) !== 1) date = addDays(date, 1);
  return date;
}

const hasCode = (r, status, code) => r.status === status && r.data && r.data.errorCode === code;
const detail = (r) => `${r.status} ${JSON.stringify(r.data).slice(0, 160)}`;
const rowOf = (r, userId) => (r.data.rows || []).find((row) => row.userId === userId);
const dayOf = (r, date) => r.data.days.find((day) => day.date === date);
// jsonb khong giu thu tu khoa, so sanh snapshot voi so tinh truc tiep phai bo qua thu tu do.
const canonical = (value) => JSON.stringify(value, (_key, val) =>
  (val && typeof val === 'object' && !Array.isArray(val) ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => a.localeCompare(b))) : val));

(async () => {
  const since = Date.now();
  const month = previousMonth(today);
  const currentMonth = today.slice(0, 7);
  const [year, monthNumber] = month.split('-').map(Number);
  const weekdays = monthDates(month).filter((date) => !isWeekend(date));
  const weekend = monthDates(month).find(isWeekend);
  const eventIds = [];
  const traceIds = [];
  const roleRestore = {};
  const permissionRestore = {};
  let org = null;
  let originalSchedule = null;
  let inactiveUser = null;
  let scheduleTouched = false;

  try {
    const adminToken = await login('admin');
    org = decode(adminToken).organizationId || decode(adminToken).orgId;
    check('dang nhap dung to chuc kiem thu', ACCOUNTS.admin[0] === 'admin@e2e-test.local' && !!org, ACCOUNTS.admin[0]);
    const orgName = sql('postgres-iam', `select name from organizations where id = ${q(org)};`);
    if (!orgName.startsWith('E2E Test Org') && !process.env.ECAP_E2E_ADMIN_EMAIL) throw new Error(`Khong phai to chuc kiem thu: ${orgName}`);

    const roles = list((await api('admin', 'GET', '/roles')).data);
    const managerRole = roles.find((role) => role.name === 'Manager');
    const users = list((await api('admin', 'GET', '/users?limit=100')).data);
    const byEmail = (email) => users.find((user) => user.email === email);
    const manager = byEmail(ACCOUNTS.manager[0]);
    const employee = byEmail(ACCOUNTS.employee[0]);
    const outsider = users.find((user) => user.departmentId && user.departmentId !== manager.departmentId && user.isActive);
    const newcomer = users.filter((user) => !user.departmentId && user.isActive && user.email.startsWith('e2e-member-'))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
    const admin = byEmail(ACCOUNTS.admin[0]);
    check('du tai khoan kiem thu', manager && employee && outsider && newcomer && admin && managerRole,
      `manager=${!!manager} employee=${!!employee} outsider=${!!outsider} newcomer=${!!newcomer}`);

    // Vai tro Manager tam thoi cho 1 nhan vien phong Kinh doanh, tra lai o cuoi. Vai tro Manager cua to chuc nay
    // tao truoc khi CALENDAR_MANAGE mo cho Manager (03/10/2026) nen phai them tam quyen do de kiem tra lich.
    roleRestore.id = manager.id;
    roleRestore.roleIds = (manager.roles || []).map((role) => role.id);
    if (!managerRole.permissionKeys.includes('calendar:manage')) {
      permissionRestore.id = managerRole.id;
      permissionRestore.keys = [...managerRole.permissionKeys];
      const widened = await api('admin', 'PATCH', `/roles/${managerRole.id}/permissions`, { permissionKeys: [...managerRole.permissionKeys, 'calendar:manage'] });
      check('them tam calendar:manage cho vai tro Manager', widened.status === 200, detail(widened));
    }
    const grant = await api('admin', 'PATCH', `/users/${manager.id}`, { roleIds: [managerRole.id] });
    check('cap vai tro Manager tam thoi', grant.status === 200, detail(grant));

    const insertLeave = (userId, start, end, leaveType, status) => sql('postgres-hrm',
      `insert into leave_requests (organization_id, user_id, start_date, end_date, reason, leave_type, status)
       values (${q(org)}, ${q(userId)}, ${q(start)}, ${q(end)}, ${q(`${TAG} ${leaveType}`)}, ${q(leaveType)}, ${q(status)}) returning id;`).split('\n')[0];
    const insertAttendance = (userId, date, checkIn, checkOut) => sql('postgres-hrm',
      `insert into attendances (organization_id, user_id, work_date, check_in_at, check_in_photo_object_key, check_out_at, check_out_photo_object_key)
       values (${q(org)}, ${q(userId)}, ${q(date)}, ${q(`${date}T${checkIn}:00+07:00`)}, ${q(`${TAG}/in.jpg`)},
       ${checkOut ? q(`${date}T${checkOut}:00+07:00`) : 'null'}, ${checkOut ? q(`${TAG}/out.jpg`) : 'null'}) returning id;`).split('\n')[0];
    const insertOvertime = (userId, date, otStart, otEnd, hours, status) => sql('postgres-hrm',
      `insert into overtime_requests (organization_id, user_id, work_date, ot_start, ot_end, multiplier_type, multiplier, estimated_hours, reason, status)
       values (${q(org)}, ${q(userId)}, ${q(date)}, ${q(otStart)}, ${q(otEnd)}, 'WEEKDAY', 1.5, ${hours}, ${q(TAG)}, ${q(status)}) returning id;`).split('\n')[0];
    const postLeave = async (body, who = 'employee') => {
      const r = await api(who, 'POST', '/leave-requests', { reason: `${TAG} ${who}`, ...body });
      if (r.data && r.data.id) traceIds.push(r.data.id);
      return r;
    };

    // 1. Don nghi: ngay lam viec, trung don, so du, tuong thich tien to cu
    // Ngay gan de cung nam voi so du (GET /me/balance chi tra nam hien tai); cuoi nam thi bo qua vai so sanh so du.
    const mon = futureMonday(3);
    const fri = addDays(mon, 4);
    const sameYear = mon.slice(0, 4) === today.slice(0, 4);
    const leaveYear = Number(mon.slice(0, 4));
    const r1 = await postLeave({ startDate: addDays(mon, 5), endDate: addDays(mon, 6), leaveType: 'ANNUAL' });
    check('don chi co cuoi tuan -> 400 LEAVE_NO_WORKING_DAYS', hasCode(r1, 400, 'LEAVE_NO_WORKING_DAYS'), detail(r1));

    const balance0 = (await api('employee', 'GET', '/leave-requests/me/balance')).data;
    check('so du tra du truong moi', ['usedDays', 'pendingDays', 'adjustmentDays', 'seniorityBonusDays', 'entitledDays', 'remainingDays', 'baseDaysPerYear', 'seniorityYearsPerBonusDay'].every((key) => typeof balance0[key] === 'number'), JSON.stringify(balance0));
    check('thuc huong = co ban + tham nien + dieu chinh', balance0.entitledDays === balance0.baseDaysPerYear + balance0.seniorityBonusDays + balance0.adjustmentDays);
    check('con lai = thuc huong - da dung - dang cho', balance0.remainingDays === balance0.entitledDays - balance0.usedDays - balance0.pendingDays);

    const annual = await postLeave({ startDate: mon, endDate: fri, leaveType: 'ANNUAL' });
    check('tao don phep nam 5 ngay', annual.status === 201 && annual.data.leaveType === 'ANNUAL' && annual.data.status === 'PENDING', detail(annual));
    const mineList = list((await api('employee', 'GET', '/leave-requests/me?limit=100')).data);
    check('danh sach cua toi co workingDays theo lich', mineList.find((row) => row.id === annual.data.id)?.workingDays === 5);
    const overlap = await postLeave({ startDate: fri, endDate: addDays(fri, 7), leaveType: 'SICK' });
    check('trung don dang cho -> 409 LEAVE_OVERLAP, ca khi khac loai', hasCode(overlap, 409, 'LEAVE_OVERLAP'), detail(overlap));
    const cancel = await api('employee', 'PATCH', `/leave-requests/${annual.data.id}/cancel`, {});
    check('huy don dang cho', cancel.status === 200 && cancel.data.status === 'REJECTED', detail(cancel));
    const afterCancel = (await api('employee', 'GET', '/leave-requests/me/balance')).data;
    check('huy don tra lai phep', afterCancel.pendingDays === balance0.pendingDays && afterCancel.remainingDays === balance0.remainingDays, JSON.stringify(afterCancel));
    const refile = await postLeave({ startDate: mon, endDate: mon, leaveType: 'ANNUAL' });
    check('don da huy khong con chan trung ngay', refile.status === 201, detail(refile));
    const balance1 = (await api('employee', 'GET', '/leave-requests/me/balance')).data;
    if (sameYear) check('don dang cho tru vao con lai ngay', balance1.pendingDays === balance0.pendingDays + 1 && balance1.remainingDays === balance0.remainingDays - 1, JSON.stringify(balance1));

    const farMon = futureMonday(5);
    const tooLong = addDays(farMon, 7 * (Math.ceil(balance1.entitledDays / 5) + 1));
    const exceeded = await postLeave({ startDate: farMon, endDate: tooLong, leaveType: 'ANNUAL' });
    check('vuot so du -> 400 LEAVE_BALANCE_EXCEEDED kem errorParams', hasCode(exceeded, 400, 'LEAVE_BALANCE_EXCEEDED') && exceeded.data.errorParams?.requestedDays > exceeded.data.errorParams?.remainingDays, detail(exceeded));
    const sick = await postLeave({ startDate: farMon, endDate: tooLong, leaveType: 'SICK' });
    check('nghi om khong bi gioi han so du', sick.status === 201 && sick.data.leaveType === 'SICK', detail(sick));
    const balance2 = (await api('employee', 'GET', '/leave-requests/me/balance')).data;
    check('nghi om khong tru phep', balance2.remainingDays === balance1.remainingDays, JSON.stringify(balance2));
    await api('employee', 'PATCH', `/leave-requests/${sick.data.id}/cancel`, {});

    const legacyMon = futureMonday(8);
    const legacy = await postLeave({ startDate: legacyMon, endDate: legacyMon, reason: `[UNPAID] ${TAG} tien to cu` });
    check('thieu leaveType: suy tu tien to cu (ung dung di dong)', legacy.status === 201 && legacy.data.leaveType === 'UNPAID', detail(legacy));
    await api('employee', 'PATCH', `/leave-requests/${legacy.data.id}/cancel`, {});
    const plain = await postLeave({ startDate: legacyMon, endDate: legacyMon, reason: `${TAG} khong tien to` });
    check('thieu leaveType va khong tien to -> ANNUAL', plain.status === 201 && plain.data.leaveType === 'ANNUAL', detail(plain));
    await api('employee', 'PATCH', `/leave-requests/${plain.data.id}/cancel`, {});

    // 2. Dieu chinh so du; duyet phai kiem tra lai so du
    const noNote = await api('admin', 'POST', '/leave-requests/balance-adjustments', { userId: employee.id, year: leaveYear, days: 2, note: '  ' });
    check('dieu chinh thieu ghi chu -> LEAVE_ADJUSTMENT_INVALID', hasCode(noNote, 400, 'LEAVE_ADJUSTMENT_INVALID'), detail(noNote));
    const zero = await api('admin', 'POST', '/leave-requests/balance-adjustments', { userId: employee.id, year: leaveYear, days: 0, note: TAG });
    check('dieu chinh 0 ngay -> LEAVE_ADJUSTMENT_INVALID', hasCode(zero, 400, 'LEAVE_ADJUSTMENT_INVALID'), detail(zero));
    const stranger = await api('admin', 'POST', '/leave-requests/balance-adjustments', { userId: '00000000-0000-4000-8000-000000000000', year: 2026, days: 1, note: TAG });
    check('dieu chinh nguoi ngoai to chuc -> LEAVE_ADJUSTMENT_INVALID', hasCode(stranger, 400, 'LEAVE_ADJUSTMENT_INVALID'), detail(stranger));
    const empAdjust = await api('employee', 'POST', '/leave-requests/balance-adjustments', { userId: employee.id, year: 2026, days: 5, note: TAG });
    check('Nhan vien dieu chinh so du -> 403', empAdjust.status === 403, detail(empAdjust));
    const plus = await api('admin', 'POST', '/leave-requests/balance-adjustments', { userId: employee.id, year: leaveYear, days: 2, note: `${TAG} cong` });
    check('Org Admin cong 2 ngay', plus.status === 201, detail(plus));
    const balance3 = (await api('employee', 'GET', '/leave-requests/me/balance')).data;
    if (sameYear) check('so du tang dung 2 ngay', balance3.entitledDays === balance1.entitledDays + 2 && balance3.adjustmentDays === balance1.adjustmentDays + 2, JSON.stringify(balance3));
    const adjustments = list((await api('admin', 'GET', `/leave-requests/balance-adjustments?userId=${employee.id}&year=${leaveYear}`)).data);
    check('danh sach dieu chinh co dong moi', adjustments.some((row) => row.id === plus.data.id), `n=${adjustments.length}`);
    const minus = await api('admin', 'POST', '/leave-requests/balance-adjustments', { userId: employee.id, year: leaveYear, days: -366, note: `${TAG} tru` });
    check('dieu chinh am duoc', minus.status === 201, detail(minus));
    const reapprove = await api('admin', 'PATCH', `/leave-requests/${refile.data.id}/approve`, {});
    check('duyet luc het so du -> 400 LEAVE_BALANCE_EXCEEDED', hasCode(reapprove, 400, 'LEAVE_BALANCE_EXCEEDED'), detail(reapprove));
    sql('postgres-hrm', `delete from leave_balance_adjustments where id = ${q(minus.data.id)};`);
    const approved = await api('manager', 'PATCH', `/leave-requests/${refile.data.id}/approve`, { decisionNote: TAG });
    check('Manager duyet lai duoc khi co so du', approved.status === 200 && approved.data.status === 'APPROVED', detail(approved));
    const balance4 = (await api('employee', 'GET', '/leave-requests/me/balance')).data;
    if (sameYear) check('duyet chuyen tu dang cho sang da dung, khong tru 2 lan', balance4.usedDays === balance3.usedDays + 1 && balance4.pendingDays === balance3.pendingDays - 1 && balance4.remainingDays === balance3.remainingDays, JSON.stringify(balance4));

    // 3. Lich lam viec
    const schedule = await api('employee', 'GET', '/work-calendar/schedule');
    originalSchedule = schedule.data;
    check('moi thanh vien doc duoc lich', schedule.status === 200 && Array.isArray(schedule.data.workingWeekdays), detail(schedule));
    const { workingWeekdays, workStart, workEnd, lateGraceMinutes, earlyLeaveGraceMinutes, breakMinutes } = originalSchedule;
    originalSchedule = { workingWeekdays, workStart, workEnd, lateGraceMinutes, earlyLeaveGraceMinutes, breakMinutes };
    for (const [name, body] of [
      ['gio ra truoc gio vao', { workStart: '17:00', workEnd: '08:00' }],
      ['gio sai dinh dang', { workStart: '8:30' }],
      ['ngay trong tuan trung', { workingWeekdays: [1, 1, 2] }],
      ['ngay trong tuan rong', { workingWeekdays: [] }],
      ['ngay ngoai 0-6', { workingWeekdays: [7] }],
      ['so phut qua 240', { lateGraceMinutes: 241 }],
      ['gio nghi dai hon ca', { workStart: '08:00', workEnd: '09:00', breakMinutes: 60 }],
    ]) {
      const r = await api('admin', 'PUT', '/work-calendar/schedule', body);
      check(`lich sai (${name}) -> 400 WORK_SCHEDULE_INVALID`, hasCode(r, 400, 'WORK_SCHEDULE_INVALID'), detail(r));
    }
    check('Nhan vien sua lich -> 403', (await api('employee', 'PUT', '/work-calendar/schedule', { lateGraceMinutes: 5 })).status === 403);
    check('Manager sua lich -> 403', (await api('manager', 'PUT', '/work-calendar/schedule', { lateGraceMinutes: 5 })).status === 403);
    const sat = addDays(farMon, 5);
    const countDays = async (start, end) => (await api('employee', 'GET', `/work-calendar/working-days?startDate=${start}&endDate=${end}`));
    const week = await countDays(farMon, addDays(farMon, 6));
    check('tuan thuong 5 ngay lam viec', week.status === 200 && week.data.workingDays === 5, detail(week));
    check('khoang qua 366 ngay -> 400', (await countDays('2026-01-01', '2027-06-01')).status === 400);
    scheduleTouched = true;
    const sixDays = await api('admin', 'PUT', '/work-calendar/schedule', { workingWeekdays: [1, 2, 3, 4, 5, 6] });
    check('Org Admin them Thu 7', sixDays.status === 200 && sixDays.data.workingWeekdays.includes(6), detail(sixDays));
    check('so ngay lam viec tang theo lich', (await countDays(farMon, addDays(farMon, 6))).data.workingDays === 6);
    const satLeave = await postLeave({ startDate: sat, endDate: sat, leaveType: 'UNPAID' });
    check('Thu 7 thanh ngay lam thi tao don duoc', satLeave.status === 201, detail(satLeave));
    await api('employee', 'PATCH', `/leave-requests/${satLeave.data.id}/cancel`, {});
    const restored = await api('admin', 'PUT', '/work-calendar/schedule', originalSchedule);
    check('tra lich ve gia tri cu', restored.status === 200 && restored.data.workingWeekdays.join() === workingWeekdays.join(), detail(restored));
    scheduleTouched = false;

    // 4. Ngay lam bu va ngay le
    const empMakeup = await api('employee', 'POST', '/calendar-events', { title: TAG, type: 'MAKEUP_WORKDAY', startDate: sat });
    check('Nhan vien tao ngay lam bu -> 403', empMakeup.status === 403, detail(empMakeup));
    const makeup = await api('manager', 'POST', '/calendar-events', { title: `Làm bù ${TAG}`, type: 'MAKEUP_WORKDAY', startDate: sat });
    if (makeup.data && makeup.data.id) eventIds.push(makeup.data.id);
    check('Manager tao ngay lam bu', makeup.status === 201 && makeup.data.type === 'MAKEUP_WORKDAY', detail(makeup));
    check('ngay lam bu tinh la ngay lam viec', (await countDays(sat, sat)).data.workingDays === 1);
    const holidayMon = addDays(farMon, 7);
    const holidayEvent = await api('manager', 'POST', '/calendar-events', { title: `Lễ ${TAG}`, type: 'HOLIDAY', startDate: holidayMon });
    if (holidayEvent.data && holidayEvent.data.id) eventIds.push(holidayEvent.data.id);
    const holidayRange = await countDays(holidayMon, holidayMon);
    check('ngay le khong phai ngay lam viec, tra ten le', holidayRange.data.workingDays === 0 && holidayRange.data.holidays[0]?.title === `Lễ ${TAG}`, detail(holidayRange));
    const onHoliday = await postLeave({ startDate: holidayMon, endDate: holidayMon, leaveType: 'ANNUAL' });
    check('don chi trung ngay le -> LEAVE_NO_WORKING_DAYS', hasCode(onHoliday, 400, 'LEAVE_NO_WORKING_DAYS'), detail(onHoliday));
    const overMakeup = await api('manager', 'POST', '/calendar-events', { title: `Lễ đè ${TAG}`, type: 'HOLIDAY', startDate: sat });
    if (overMakeup.data && overMakeup.data.id) eventIds.push(overMakeup.data.id);
    check('le thang lam bu', (await countDays(sat, sat)).data.workingDays === 0);
    while (eventIds.length) check('xoa su kien lich', (await api('manager', 'DELETE', `/calendar-events/${eventIds.pop()}`)).status < 300);
    check('xoa xong tro lai nhu cu', (await countDays(sat, sat)).data.workingDays === 0 && (await countDays(holidayMon, holidayMon)).data.workingDays === 1);

    // 5. Quy tac tinh cong tren du lieu that
    const [d1, d2, d3, d4, d5, d6, d7, d8, d9, d10, d11, d12] = weekdays;
    const hasHistory = sql('postgres-hrm', `select count(*) from attendances where organization_id = ${q(org)} and user_id = ${q(employee.id)} and work_date between ${q(`${month}-01`)} and ${q(`${month}-31`)};`);
    check('nhan vien kiem thu chua co cham cong that trong thang', hasHistory === '0', hasHistory);
    insertAttendance(employee.id, d1, '08:30', '17:30');
    insertAttendance(employee.id, d2, '08:45', '17:30');
    insertAttendance(employee.id, d3, '08:30', '17:00');
    insertAttendance(employee.id, d4, '08:30', null);
    // d5: khong co gi -> V
    insertAttendance(employee.id, weekend, '09:00', '12:00');
    insertAttendance(employee.id, d6, '08:30', '20:15');
    insertOvertime(employee.id, d6, '18:00', '20:00', 2, 'APPROVED');
    insertOvertime(employee.id, d7, '18:00', '19:00', 1, 'APPROVED');
    insertLeave(employee.id, d8, d8, 'ANNUAL', 'APPROVED');
    insertLeave(employee.id, d9, d9, 'SICK', 'APPROVED');
    insertLeave(employee.id, d10, d10, 'UNPAID', 'APPROVED');
    insertLeave(employee.id, d11, d11, 'ANNUAL', 'APPROVED');
    insertAttendance(employee.id, d11, '08:30', '17:30');
    // API lich khong nhan ngay qua khu nen ngay le trong thang truoc chen thang vao bang.
    sql('postgres-hrm', `insert into calendar_events (organization_id, title, type, start_date, end_date, created_by_user_id, created_by_rank)
      values (${q(org)}, ${q(`Lễ ${TAG}`)}, 'HOLIDAY', ${q(d12)}, ${q(d12)}, ${q(admin.id)}, 1);`);
    const detailResp = await api('admin', 'GET', `/timesheets/users/${employee.id}?month=${month}`);
    check('chi tiet cong tra du ngay', detailResp.status === 200 && detailResp.data.days.length === monthDates(month).length, detail(detailResp));
    const expectSymbol = (name, date, symbol, extra = () => true) => {
      const day = dayOf(detailResp, date);
      check(name, day && day.symbol === symbol && extra(day), JSON.stringify(day));
    };
    expectSymbol('du vao ra dung gio -> X, 8 gio', d1, 'X', (day) => day.workValue === 1 && day.workedHours === 8 && day.lateMinutes === 0 && day.earlyLeaveMinutes === 0);
    expectSymbol('vao muon 15 phut -> X, muon 15', d2, 'X', (day) => day.lateMinutes === 15);
    expectSymbol('ra som 30 phut -> X, som 30', d3, 'X', (day) => day.earlyLeaveMinutes === 30);
    expectSymbol('thieu gio ra ngay da qua -> Q', d4, 'Q', (day) => day.workValue === 1);
    expectSymbol('khong co gi ngay da qua -> V', d5, 'V', (day) => day.workValue === 0);
    expectSymbol('cham cong ngay nghi tuan -> LN, gia tri 0, khong muon', weekend, 'LN', (day) => day.workValue === 0 && day.workedHours === 3 && day.lateMinutes === 0);
    expectSymbol('lam them giao vao-ra -> 2 gio', d6, 'X', (day) => day.otHours === 2);
    expectSymbol('phep nam -> P', d8, 'P', (day) => day.workValue === 1);
    expectSymbol('nghi om -> OM', d9, 'OM', (day) => day.workValue === 1);
    expectSymbol('nghi khong luong -> KL', d10, 'KL', (day) => day.workValue === 0);
    expectSymbol('cham cong thang don nghi', d11, 'X');
    expectSymbol('le vao ngay lam -> L', d12, 'L', (day) => day.workValue === 1 && day.holidayName === `Lễ ${TAG}`);
    const remaining = weekdays.length - 12;
    const summaryRow = detailResp.data.summary;
    check('tong: actualDays', summaryRow.actualDays === 6, summaryRow.actualDays); // d1 d2 d3 d4 d6 d11
    check('tong: LN', summaryRow.offDayWorkDays === 1);
    check('tong: nghi co luong', summaryRow.paidLeaveDays === 2);
    check('tong: nghi khong luong', summaryRow.unpaidLeaveDays === 1);
    check('tong: le', summaryRow.paidHolidayDays === 1);
    check('tong: vang = d5, d7 va cac ngay con lai', summaryRow.absentDays === 2 + remaining, summaryRow.absentDays);
    check('tong: cong huong luong', summaryRow.paidDays === 6 + 2 + 1, summaryRow.paidDays);
    check('tong: muon/som/thieu ra', summaryRow.lateCount === 1 && summaryRow.earlyLeaveCount === 1 && summaryRow.missingCheckOutCount === 1, JSON.stringify(summaryRow));
    check('tong: lam them', summaryRow.otHours === 2 && summaryRow.approvedOtHours === 3, JSON.stringify(summaryRow));
    check('thieu cong -> insufficient', summaryRow.status === 'insufficient');
    check('so cong chuan = so ngay Thu 2-6 trong thang, ke ca le', summaryRow.expectedDays === weekdays.length, summaryRow.expectedDays);

    // 6. Ngay vao lam
    const newcomerRow = rowOf(await api('admin', 'GET', `/timesheets?month=${month}`), newcomer.id);
    const joinedAt = sql('postgres-hrm', `select joined_at from dim_user where user_id = ${q(newcomer.id)};`);
    const expectedFromJoin = monthDates(month).filter((date) => !isWeekend(date) && date >= joinedAt).length;
    check('nguoi moi: cong chuan tinh tu ngay vao lam', newcomerRow && newcomerRow.expectedDays === expectedFromJoin && newcomerRow.joinedAt === joinedAt, `joined=${joinedAt} ${JSON.stringify(newcomerRow)}`);
    if (joinedAt > `${month}-01`) check('nguoi moi: isNewMember', newcomerRow.isNewMember === true);
    const beforeJoin = await api('admin', 'PUT', '/timesheets/entries', { userId: newcomer.id, workDate: addDays(joinedAt, -1), symbol: 'X', note: TAG });
    check('sua tay truoc ngay vao lam -> TIMESHEET_ENTRY_INVALID', hasCode(beforeJoin, 400, 'TIMESHEET_ENTRY_INVALID'), detail(beforeJoin));

    // 7. Sua tay
    for (const [name, body] of [
      ['thieu ghi chu', { userId: employee.id, workDate: d5, symbol: 'X', note: ' ' }],
      ['sai ky hieu', { userId: employee.id, workDate: d5, symbol: 'ZZ', note: TAG }],
      ['ngay tuong lai', { userId: employee.id, workDate: addDays(today, 3), symbol: 'X', note: TAG }],
      ['ngay hong', { userId: employee.id, workDate: `${month}-99`, symbol: 'X', note: TAG }],
    ]) {
      const r = await api('admin', 'PUT', '/timesheets/entries', body);
      check(`sua tay ${name} -> TIMESHEET_ENTRY_INVALID`, hasCode(r, 400, 'TIMESHEET_ENTRY_INVALID'), detail(r));
    }
    const manual = await api('manager', 'PUT', '/timesheets/entries', { userId: employee.id, workDate: d5, symbol: 'P', note: `${TAG} sua` });
    check('Manager sua tay nhan vien phong minh', manual.status === 200 && manual.data.symbol === 'P' && manual.data.isManual === true && manual.data.note === `${TAG} sua`, detail(manual));
    const afterManual = await api('admin', 'GET', `/timesheets/users/${employee.id}?month=${month}`);
    check('sua tay doi tong', afterManual.data.summary.paidDays === summaryRow.paidDays + 1 && afterManual.data.summary.absentDays === summaryRow.absentDays - 1 && afterManual.data.summary.hasManual === true, JSON.stringify(afterManual.data.summary));
    const manualLate = await api('admin', 'PUT', '/timesheets/entries', { userId: employee.id, workDate: d2, symbol: 'P', note: `${TAG} doi` });
    check('sua sang ky hieu nghi: muon = 0, giu gio cham', manualLate.data.lateMinutes === 0 && !!manualLate.data.checkInAt, detail(manualLate));
    const removed = await api('admin', 'DELETE', `/timesheets/entries/${employee.id}/${d2}`);
    check('bo sua tay', removed.status < 300, detail(removed));
    check('bo sua tay tra ve ky hieu tu dong', dayOf(await api('admin', 'GET', `/timesheets/users/${employee.id}?month=${month}`), d2).symbol === 'X');

    // 8. Pham vi
    const managerList = await api('manager', 'GET', `/timesheets?month=${month}`);
    const sameDept = users.filter((user) => user.departmentId === manager.departmentId).map((user) => user.id);
    check('Manager chi thay phong minh', managerList.status === 200 && managerList.data.rows.every((row) => sameDept.includes(row.userId)) && managerList.data.rows.some((row) => row.userId === employee.id), `n=${managerList.data.rows && managerList.data.rows.length}`);
    const out404 = await api('manager', 'GET', `/timesheets/users/${outsider.id}?month=${month}`);
    check('Manager xem chi tiet ngoai pham vi -> 404', out404.status === 404, detail(out404));
    const outEntry = await api('manager', 'PUT', '/timesheets/entries', { userId: outsider.id, workDate: d5, symbol: 'X', note: TAG });
    check('Manager sua tay ngoai phong -> 403', hasCode(outEntry, 403, 'DEPARTMENT_SCOPE_FORBIDDEN'), detail(outEntry));
    const selfEntry = await api('manager', 'PUT', '/timesheets/entries', { userId: manager.id, workDate: d5, symbol: 'X', note: TAG });
    check('Manager tu sua minh -> 403', hasCode(selfEntry, 403, 'SELF_APPROVAL_FORBIDDEN'), detail(selfEntry));
    const managerExceptions = await api('manager', 'GET', `/timesheets/exceptions?month=${month}&limit=200`);
    check('Manager: ngoai le trong pham vi', managerExceptions.status === 200 && managerExceptions.data.data.every((row) => sameDept.includes(row.userId)), detail(managerExceptions));
    check('Nhan vien xem bang cong -> 403', (await api('employee', 'GET', `/timesheets?month=${month}`)).status === 403);
    check('Nhan vien xem chi tiet -> 403', (await api('employee', 'GET', `/timesheets/users/${employee.id}?month=${month}`)).status === 403);
    check('Nhan vien xem ngoai le -> 403', (await api('employee', 'GET', `/timesheets/exceptions?month=${month}`)).status === 403);
    check('Nhan vien sua tay -> 403', (await api('employee', 'PUT', '/timesheets/entries', { userId: employee.id, workDate: d5, symbol: 'X', note: TAG })).status === 403);
    check('Nhan vien khoa ky -> 403', (await api('employee', 'POST', `/timesheets/${month}/lock`, {})).status === 403);
    check('Manager khoa ky -> 403', (await api('manager', 'POST', `/timesheets/${month}/lock`, {})).status === 403);
    check('Manager mo khoa -> 403', (await api('manager', 'POST', `/timesheets/${month}/unlock`, { reason: TAG })).status === 403);
    check('thang sai -> TIMESHEET_MONTH_INVALID', hasCode(await api('admin', 'GET', '/timesheets?month=2026-13'), 400, 'TIMESHEET_MONTH_INVALID'));

    // 9. Ngoai le: o dem khop so dong, loc va phan trang
    const exAll = await api('admin', 'GET', `/timesheets/exceptions?month=${month}&limit=100`);
    const countTotal = Object.values(exAll.data.counts).reduce((sum, value) => sum + value, 0);
    check('tong o dem = meta.total', exAll.data.meta.total === countTotal, `${exAll.data.meta.total} vs ${countTotal}`);
    check('co du loai ngoai le mong doi', exAll.data.counts.LATE >= 1 && exAll.data.counts.EARLY_LEAVE >= 1 && exAll.data.counts.ABSENT >= 1 && exAll.data.counts.MISSING_CHECKOUT >= 1 && exAll.data.counts.OT_NO_ATTENDANCE >= 1, JSON.stringify(exAll.data.counts));
    const exLate = await api('admin', 'GET', `/timesheets/exceptions?month=${month}&type=LATE&limit=100`);
    check('loc LATE chi con muon, phut dung', exLate.data.data.every((row) => row.type === 'LATE') && exLate.data.data.find((row) => row.userId === employee.id)?.minutes === 15, JSON.stringify(exLate.data.data.slice(0, 2)));
    check('counts khong doi khi loc', exLate.data.counts.ABSENT === exAll.data.counts.ABSENT);
    check('OT khong cham cong co dong rieng', exAll.data.data.some((row) => row.type === 'OT_NO_ATTENDANCE' && row.userId === employee.id && row.workDate === d7) || exAll.data.meta.total > 100);
    const page1 = await api('admin', 'GET', `/timesheets/exceptions?month=${month}&limit=5&page=1`);
    const page2 = await api('admin', 'GET', `/timesheets/exceptions?month=${month}&limit=5&page=2`);
    check('phan trang khong trung dong', page1.data.data.length === 5 && page2.data.data.length > 0 && JSON.stringify(page1.data.data[0]) !== JSON.stringify(page2.data.data[0]) && page1.data.meta.page === 1 && page2.data.meta.page === 2, JSON.stringify(page2.data.meta));
    const sorted = exAll.data.data.map((row) => row.workDate);
    check('sap ngay giam dan', sorted.every((date, i) => i === 0 || sorted[i - 1] >= date));
    check('loai sai -> 400', (await api('admin', 'GET', `/timesheets/exceptions?month=${month}&type=KHAC`)).status === 400);

    // 10. Khoa ky
    check('khoa thang hien tai -> TIMESHEET_PERIOD_NOT_ENDED', hasCode(await api('admin', 'POST', `/timesheets/${currentMonth}/lock`, {}), 400, 'TIMESHEET_PERIOD_NOT_ENDED'));
    check('mo khoa ky chua khoa -> TIMESHEET_PERIOD_NOT_LOCKED', hasCode(await api('admin', 'POST', `/timesheets/${month}/unlock`, { reason: TAG }), 409, 'TIMESHEET_PERIOD_NOT_LOCKED'));
    const pendingCancel = insertLeave(employee.id, d7, d7, 'UNPAID', 'PENDING');
    const pendingApprove = insertLeave(employee.id, d5, d5, 'UNPAID', 'PENDING');
    const pendingOvertime = insertOvertime(employee.id, d1, '18:00', '19:00', 1, 'PENDING');
    const attendanceForAdj = insertAttendance(outsider.id, weekdays[weekdays.length - 1], '08:30', '17:30');
    const pendingAdjustment = sql('postgres-hrm',
      `insert into attendance_adjustments (organization_id, attendance_id, user_id, work_date, original_check_in_at, original_check_out_at, proposed_check_in_at, proposed_check_out_at, reason, status)
       values (${q(org)}, ${q(attendanceForAdj)}, ${q(outsider.id)}, ${q(weekdays[weekdays.length - 1])}, now(), now(), now(), now(), ${q(TAG)}, 'PENDING') returning id;`).split('\n')[0];
    const blocked = await api('admin', 'POST', `/timesheets/${month}/lock`, {});
    check('con don cho -> 409 TIMESHEET_PERIOD_HAS_PENDING', hasCode(blocked, 409, 'TIMESHEET_PERIOD_HAS_PENDING'), detail(blocked));
    check('409 qua Gateway con errorParams', blocked.data.errorParams && blocked.data.errorParams.leave === 2 && blocked.data.errorParams.overtime === 1 && blocked.data.errorParams.adjustment === 1, JSON.stringify(blocked.data.errorParams));
    check('chua khoa khi bi tu choi', (await api('admin', 'GET', `/timesheets?month=${month}`)).data.period.status === 'OPEN');
    const liveBefore = await api('admin', 'GET', `/timesheets?month=${month}`);
    const forced = await api('admin', 'POST', `/timesheets/${month}/lock`, { force: true });
    check('force -> khoa duoc', forced.status === 201 && forced.data.period.status === 'LOCKED' && !('snapshot' in forced.data.period), detail(forced));
    check('khoa lan 2 -> TIMESHEET_PERIOD_ALREADY_LOCKED', hasCode(await api('admin', 'POST', `/timesheets/${month}/lock`, { force: true }), 409, 'TIMESHEET_PERIOD_ALREADY_LOCKED'));
    const frozen = await api('admin', 'GET', `/timesheets?month=${month}`);
    check('khoa xong so khop luc khoa', canonical(frozen.data.rows) === canonical(liveBefore.data.rows));
    insertAttendance(employee.id, d7, '08:30', '17:30');
    const stillFrozen = await api('admin', 'GET', `/timesheets?month=${month}`);
    check('du lieu goc doi nhung so khoa khong doi', JSON.stringify(stillFrozen.data.rows) === JSON.stringify(frozen.data.rows));
    const frozenDetail = await api('admin', 'GET', `/timesheets/users/${employee.id}?month=${month}`);
    check('chi tiet ky khoa doc snapshot', dayOf(frozenDetail, d7).symbol === 'V' && frozenDetail.data.period.status === 'LOCKED', JSON.stringify(dayOf(frozenDetail, d7)));
    const frozenExceptions = await api('admin', 'GET', `/timesheets/exceptions?month=${month}&limit=100`);
    check('ngoai le ky khoa doc snapshot', frozenExceptions.data.counts.OT_NO_ATTENDANCE === exAll.data.counts.OT_NO_ATTENDANCE, JSON.stringify(frozenExceptions.data.counts));
    const scopedFrozen = await api('manager', 'GET', `/timesheets?month=${month}`);
    check('Manager xem ky khoa van theo pham vi', scopedFrozen.data.rows.every((row) => sameDept.includes(row.userId)));

    const lockedCode = (r) => hasCode(r, 409, 'TIMESHEET_PERIOD_LOCKED');
    const blockedEntry = await api('admin', 'PUT', '/timesheets/entries', { userId: employee.id, workDate: d3, symbol: 'X', note: TAG });
    check('ky khoa: sua tay -> TIMESHEET_PERIOD_LOCKED', lockedCode(blockedEntry), detail(blockedEntry));
    check('ky khoa: bo sua tay -> TIMESHEET_PERIOD_LOCKED', lockedCode(await api('admin', 'DELETE', `/timesheets/entries/${employee.id}/${d5}`)));
    check('ky khoa: duyet don nghi -> TIMESHEET_PERIOD_LOCKED', lockedCode(await api('admin', 'PATCH', `/leave-requests/${pendingApprove}/approve`, {})));
    check('ky khoa: tu choi don nghi -> TIMESHEET_PERIOD_LOCKED', lockedCode(await api('admin', 'PATCH', `/leave-requests/${pendingApprove}/reject`, { decisionNote: TAG })));
    const newOt = await api('employee', 'POST', '/overtime-requests', { workDate: d3, otStart: '18:00', otEnd: '19:00', multiplierType: 'WEEKDAY', reason: TAG });
    check('ky khoa: tao lam them -> TIMESHEET_PERIOD_LOCKED', lockedCode(newOt), detail(newOt));
    check('ky khoa: duyet lam them -> TIMESHEET_PERIOD_LOCKED', lockedCode(await api('admin', 'PATCH', `/overtime-requests/${pendingOvertime}/approve`, {})));
    check('ky khoa: tu choi lam them -> TIMESHEET_PERIOD_LOCKED', lockedCode(await api('admin', 'PATCH', `/overtime-requests/${pendingOvertime}/reject`, { decisionNote: TAG })));
    check('ky khoa: duyet giai trinh -> TIMESHEET_PERIOD_LOCKED', lockedCode(await api('admin', 'PATCH', `/attendance-adjustments/${pendingAdjustment}/approve`, {})));
    check('ky khoa: tu choi giai trinh -> TIMESHEET_PERIOD_LOCKED', lockedCode(await api('admin', 'PATCH', `/attendance-adjustments/${pendingAdjustment}/reject`, { decisionNote: TAG })));
    // Giai trinh chi nhan ngay trong 7 ngay gan day: chi kiem tra duoc khi ngay cuoi thang truoc con trong han.
    const lastWeekday = weekdays[weekdays.length - 1];
    if ((Date.now() - new Date(lastWeekday).getTime()) / DAY_MS <= 7) {
      const empAttendance = insertAttendance(employee.id, lastWeekday, '08:30', '17:30');
      const newAdj = await api('employee', 'POST', '/attendance-adjustments', { attendanceId: empAttendance, proposedCheckInAt: `${lastWeekday}T08:00:00+07:00`, proposedCheckOutAt: `${lastWeekday}T17:00:00+07:00`, reason: TAG });
      check('ky khoa: tao giai trinh -> TIMESHEET_PERIOD_LOCKED', lockedCode(newAdj), detail(newAdj));
    } else {
      console.log('bo qua: tao giai trinh trong ky khoa (ngay cuoi thang truoc qua han 7 ngay)');
    }
    const cancelLocked = await api('employee', 'PATCH', `/leave-requests/${pendingCancel}/cancel`, {});
    check('ky khoa: huy don dang cho van duoc', cancelLocked.status === 200, detail(cancelLocked));

    check('mo khoa thieu ly do -> 400', (await api('admin', 'POST', `/timesheets/${month}/unlock`, {})).status === 400);
    check('mo khoa ly do trang -> 400', (await api('admin', 'POST', `/timesheets/${month}/unlock`, { reason: '   ' })).status === 400);
    const unlocked = await api('admin', 'POST', `/timesheets/${month}/unlock`, { reason: `${TAG} sua so` });
    check('mo khoa co ly do', unlocked.status === 201 && unlocked.data.period.status === 'OPEN' && unlocked.data.period.unlockReason === `${TAG} sua so`, detail(unlocked));
    check('mo khoa xoa snapshot', sql('postgres-hrm', `select snapshot is null from timesheet_periods where organization_id = ${q(org)} and year = ${year} and month = ${monthNumber};`) === 't');
    const reopened = await api('admin', 'GET', `/timesheets/users/${employee.id}?month=${month}`);
    check('mo khoa giu dong sua tay', dayOf(reopened, d5).symbol === 'P' && dayOf(reopened, d5).isManual === true, JSON.stringify(dayOf(reopened, d5)));
    check('mo khoa tinh lai du lieu moi', dayOf(reopened, d7).symbol === 'X', JSON.stringify(dayOf(reopened, d7)));

    // 11. Hai yeu cau khoa dong thoi
    const race = await Promise.all([1, 2].map(() => api('admin', 'POST', `/timesheets/${month}/lock`, { force: true })));
    const statuses = race.map((r) => r.status).sort();
    check('2 yeu cau khoa cung luc: dung 1 thanh cong', statuses[0] === 201 && statuses[1] === 409 && race.some((r) => hasCode(r, 409, 'TIMESHEET_PERIOD_ALREADY_LOCKED')), statuses.join());
    check('chi co 1 dong ky cong', sql('postgres-hrm', `select count(*) from timesheet_periods where organization_id = ${q(org)} and year = ${year} and month = ${monthNumber};`) === '1');
    await api('admin', 'POST', `/timesheets/${month}/unlock`, { reason: TAG });

    // 12. Nguoi da vo hieu hoa
    const noAttendance = sql('postgres-hrm', `select count(*) from attendances where organization_id = ${q(org)} and user_id = ${q(newcomer.id)} and work_date between ${q(`${month}-01`)} and ${q(`${month}-31`)};`);
    check('nguoi test vo hieu hoa chua co cham cong', noAttendance === '0', noAttendance);
    inactiveUser = newcomer.id;
    check('vo hieu hoa tai khoan', (await api('admin', 'PATCH', `/users/${newcomer.id}/deactivate`, {})).status === 200);
    let hidden = false;
    for (let i = 0; i < 20 && !hidden; i++) {
      await sleep(1000);
      hidden = !rowOf(await api('admin', 'GET', `/timesheets?month=${month}`), newcomer.id);
    }
    check('nguoi da vo hieu hoa, khong cham cong: khong co dong', hidden);
    const noExceptions = await api('admin', 'GET', `/timesheets/exceptions?month=${month}&limit=100`);
    check('khong con bi tinh vang trong ngoai le', !noExceptions.data.data.some((row) => row.userId === newcomer.id));
    insertAttendance(newcomer.id, weekdays[weekdays.length - 2], '08:30', '17:30');
    const stillCounted = rowOf(await api('admin', 'GET', `/timesheets?month=${month}`), newcomer.id);
    check('da vo hieu hoa nhung co cham cong: van tinh cong', stillCounted && stillCounted.actualDays === 1, JSON.stringify(stillCounted));
    const reactivated = await api('admin', 'PATCH', `/users/${newcomer.id}/reactivate`, {});
    check('kich hoat lai tai khoan', reactivated.status === 200, detail(reactivated));
    inactiveUser = null;
    let isBack = false;
    for (let i = 0; i < 20 && !isBack; i++) {
      await sleep(1000);
      isBack = sql('postgres-hrm', `select is_active from dim_user where user_id = ${q(newcomer.id)};`) === 't';
    }
    check('kich hoat lai: dim_user tro lai hoat dong', isBack);
  } catch (e) {
    check('ngoai le', false, e.stack);
  } finally {
    try {
      if (inactiveUser) await api('admin', 'PATCH', `/users/${inactiveUser}/reactivate`, {});
      if (roleRestore.id) {
        const r = await api('admin', 'PATCH', `/users/${roleRestore.id}`, { roleIds: roleRestore.roleIds });
        check('don dep: tra vai tro cu', r.status === 200, detail(r));
      }
      if (permissionRestore.id) {
        const r = await api('admin', 'PATCH', `/roles/${permissionRestore.id}/permissions`, { permissionKeys: permissionRestore.keys });
        check('don dep: tra quyen vai tro Manager', r.status === 200, detail(r));
      }
      if (scheduleTouched && originalSchedule) await api('admin', 'PUT', '/work-calendar/schedule', originalSchedule);
      while (eventIds.length) await api('admin', 'DELETE', `/calendar-events/${eventIds.pop()}`);
      await sleep(1500);
      if (org) {
        const ids = sql('postgres-hrm', `select id from leave_requests where organization_id = ${q(org)} and reason like ${q(`%${TAG}%`)}
          union all select id from overtime_requests where organization_id = ${q(org)} and reason like ${q(`%${TAG}%`)};`).split('\n').filter(Boolean);
        for (const id of ids) sql('postgres-hrm', `delete from outbox_events where payload::text like ${q(`%${id}%`)};`);
        // Su kien lich mang tieu de co TAG, ngay le con phat thong bao toi moi thanh vien - xoa theo TAG.
        sql('postgres-hrm', `delete from outbox_events where payload::text like ${q(`%${TAG}%`)};`);
        sql('postgres-hrm', `
          delete from attendance_adjustments where organization_id = ${q(org)} and reason like ${q(`%${TAG}%`)};
          delete from overtime_requests where organization_id = ${q(org)} and reason like ${q(`%${TAG}%`)};
          delete from leave_requests where organization_id = ${q(org)} and reason like ${q(`%${TAG}%`)};
          delete from attendances where organization_id = ${q(org)} and check_in_photo_object_key like ${q(`${TAG}/%`)};
          delete from calendar_events where organization_id = ${q(org)} and title like ${q(`%${TAG}%`)};
          delete from timesheet_entries where organization_id = ${q(org)} and note like ${q(`%${TAG}%`)};
          delete from leave_balance_adjustments where organization_id = ${q(org)} and note like ${q(`%${TAG}%`)};
          delete from timesheet_periods where organization_id = ${q(org)} and year = ${year} and month = ${monthNumber};
        `);
        const left = sql('postgres-hrm', `
          select (select count(*) from leave_requests where reason like ${q(`%${TAG}%`)})
            + (select count(*) from overtime_requests where reason like ${q(`%${TAG}%`)})
            + (select count(*) from attendances where check_in_photo_object_key like ${q(`${TAG}/%`)})
            + (select count(*) from timesheet_entries where note like ${q(`%${TAG}%`)})
            + (select count(*) from leave_balance_adjustments where note like ${q(`%${TAG}%`)})
            + (select count(*) from calendar_events where title like ${q(`%${TAG}%`)})
            + (select count(*) from outbox_events where payload::text like ${q(`%${TAG}%`)})
            + (select count(*) from timesheet_periods where organization_id = ${q(org)} and year = ${year} and month = ${monthNumber});`);
        check('don dep: khong con du lieu kiem thu', left === '0', left);
        const p = await purgeTraces([...ids, ...traceIds, TAG], since);
        console.log(`don dep su kien: ${JSON.stringify(p)}`);
      }
    } catch (e) {
      check('don dep', false, e.stack);
    }
    summary();
  }
})();
