// 04/11/2026: du lieu cham cong demo cho Bang cong/Ngoai le cua 2 to chuc demo, tu 01/10/2026 toi hom qua
// (GMT+7). Ghi thang vao postgres-hrm vi API check-in chi nhan gio hien tai, khong nhan ngay da qua; khong
// phat outbox de khong sinh thong bao cho nhung viec "da xay ra tu thang truoc". Tat dinh theo bam user + ngay;
// id cung sinh tu bam nen chay lai khong tao trung va khong dung toi dong co san. Anh chi la 1 JPEG xam,
// khong dung anh khuon mat that. Chay: npm run seed:attendance
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { sql, q } = require('./mock-data/lib');

const ORGS = ['Demo SME (Seed Script)', 'Nội thất An Gia (Demo)'];
const FROM = '2026-10-01';
const PHOTO_KEY = 'seed/placeholder.jpg';
const BUCKET = process.env.MINIO_HRM_BUCKET || 'hrm-attendance';
// Toa do van phong trong infra/.env, nam trong vung geofence nen nhan "dung vi tri" hien dung.
const OFFICE = { lat: 21.0034, lng: 105.8438 };
const REASONS = { ANNUAL: 'Nghỉ phép năm', SICK: 'Khám và điều trị theo chỉ định bác sĩ', UNPAID: 'Giải quyết việc gia đình' };
// Phep nam moi nguoi toi da chung nay ngay do seed tao, nhuong cho kiem thu va demo tao don that.
const MAX_SEED_ANNUAL_DAYS = 3;

const DAY_MS = 86400000;
const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const weekdayOf = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();
const todayGmt7 = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const hashOf = (text) => crypto.createHash('sha256').update(text).digest();
const seedId = (kind, userId, date) => {
  const hex = hashOf(`seed-attendance|${kind}|${userId}|${date}`).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};
const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const at = (date, minutes, seconds = 0) =>
  `${date}T${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:${String(seconds).padStart(2, '0')}+07:00`;

const rows = (out) => (out ? out.split('\n').map((line) => line.split('|')) : []);
const sqlValue = (value) => (value === null ? 'null' : typeof value === 'number' ? String(value) : q(value));

/** JPEG xam 320x240: bang Huffman chi co 1 ma 1 bit nen moi khoi anh chi la 2 bit 0. */
function grayJpeg(width = 320, height = 240) {
  const blocks = Math.ceil(width / 8) * Math.ceil(height / 8);
  const huffman = (tableId) => [0xff, 0xc4, 0x00, 0x14, tableId, 0x01, ...Array(15).fill(0), 0x00];
  return Buffer.from([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xff, 0xdb, 0x00, 0x43, 0x00, ...Array(64).fill(8),
    0xff, 0xc0, 0x00, 0x0b, 0x08, height >> 8, height & 255, width >> 8, width & 255, 0x01, 0x01, 0x11, 0x00,
    ...huffman(0x00),
    ...huffman(0x10),
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
    ...Array(Math.ceil((blocks * 2) / 8)).fill(0),
    0xff, 0xd9,
  ]);
}

function uploadPlaceholder() {
  execFileSync('docker', ['exec', '-i', 'minio', 'sh', '-c',
    `mc alias set local http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null && mc pipe --quiet --attr "Content-Type=image/jpeg" "local/${BUCKET}/${PHOTO_KEY}" >/dev/null`,
  ], { input: grayJpeg() });
}

function loadOrg(name) {
  const [org] = rows(sql('postgres-iam', `select id from organizations where name = ${q(name)};`));
  if (!org) return null;
  const organizationId = org[0];
  const [approver] = rows(sql('postgres-iam',
    `select u.id from users u join user_roles ur on ur.user_id = u.id join roles r on r.id = ur.role_id
     where u.organization_id = ${q(organizationId)} and r.name = 'Org Admin' and u.is_active order by u.created_at limit 1;`));
  const users = rows(sql('postgres-hrm',
    `select user_id, coalesce(joined_at::text, '') from dim_user where organization_id = ${q(organizationId)} and is_active order by user_id;`))
    .map(([userId, joinedAt]) => ({ userId, joinedAt: joinedAt || null }));
  const [schedule] = rows(sql('postgres-hrm',
    `select array_to_string(working_weekdays, ','), work_start, work_end from work_schedules where organization_id = ${q(organizationId)};`));
  const events = rows(sql('postgres-hrm',
    `select type, start_date, end_date from calendar_events where organization_id = ${q(organizationId)} and type in ('HOLIDAY', 'MAKEUP_WORKDAY');`));
  const attendances = rows(sql('postgres-hrm',
    `select user_id, work_date, check_in_photo_object_key from attendances where organization_id = ${q(organizationId)} and work_date >= ${q(FROM)};`));
  const leaves = rows(sql('postgres-hrm',
    `select id, user_id, start_date, end_date, leave_type from leave_requests where organization_id = ${q(organizationId)} and status in ('PENDING', 'APPROVED') and end_date >= '2026-01-01';`));
  const lockedMonths = rows(sql('postgres-hrm',
    `select year || '-' || lpad(month::text, 2, '0') from timesheet_periods where organization_id = ${q(organizationId)} and status = 'LOCKED';`)).map(([month]) => month);
  return {
    organizationId,
    approverId: approver ? approver[0] : null,
    users,
    weekdays: new Set(schedule ? schedule[0].split(',').map(Number) : [1, 2, 3, 4, 5]),
    workStart: schedule ? schedule[1] : '08:30',
    workEnd: schedule ? schedule[2] : '17:30',
    events,
    attendances,
    leaves,
    lockedMonths: new Set(lockedMonths),
  };
}

/** Ke hoach thuan tu so lieu nguon - khong phu thuoc nhung dong do chinh seed tao ra o lan chay truoc. */
function buildPlan(org, lastDate) {
  const holidays = new Set();
  const makeups = new Set();
  for (const [type, start, end] of org.events) {
    for (let date = start; date <= end; date = addDays(date, 1)) (type === 'HOLIDAY' ? holidays : makeups).add(date);
  }
  const isWorkingDay = (date) => !holidays.has(date) && (makeups.has(date) || org.weekdays.has(weekdayOf(date)));

  const realAttendance = new Set(org.attendances.filter(([, , key]) => key !== PHOTO_KEY).map(([userId, date]) => `${userId}|${date}`));
  const realLeaves = org.leaves.filter(([id, userId, start]) => id !== seedId('leave', userId, start));
  const isBusy = (userId, date) =>
    realAttendance.has(`${userId}|${date}`) || realLeaves.some(([, owner, start, end]) => owner === userId && start <= date && date <= end);

  const annualUsed = new Map();
  for (const [, owner, start, end, leaveType] of realLeaves) {
    if (leaveType !== 'ANNUAL' || !start.startsWith('2026')) continue;
    let days = 0;
    for (let date = start; date <= end; date = addDays(date, 1)) if (isWorkingDay(date)) days += 1;
    annualUsed.set(owner, (annualUsed.get(owner) || 0) + days);
  }

  const plan = { attendances: [], leaves: [], overtimes: [] };
  const usableDays = (user) => {
    const days = [];
    const first = user.joinedAt && user.joinedAt > FROM ? user.joinedAt : FROM;
    for (let date = first; date <= lastDate; date = addDays(date, 1)) {
      if (isWorkingDay(date) && !isBusy(user.userId, date) && !org.lockedMonths.has(date.slice(0, 7))) days.push(date);
    }
    return days;
  };
  const shuffled = [...org.users].sort((a, b) => hashOf(a.userId).compare(hashOf(b.userId)));

  // Vai don chac chan du 3 loai, ke ca to chuc it nguoi it ngay; phep nam 2 ngay lien nhau trong lich lam.
  const forcedLeave = new Map();
  ['ANNUAL', 'SICK', 'UNPAID'].forEach((leaveType, index) => {
    const user = shuffled[index];
    if (!user) return;
    const days = usableDays(user);
    if (days.length === 0) return;
    const start = days[(index * 3 + 1) % days.length];
    const next = days[days.indexOf(start) + 1];
    const end = leaveType === 'ANNUAL' && next ? next : start;
    forcedLeave.set(`${user.userId}|${start}`, { leaveType, start, end });
    if (end !== start) forcedLeave.set(`${user.userId}|${end}`, { leaveType, start, end, covered: true });
    if (leaveType === 'ANNUAL') annualUsed.set(user.userId, (annualUsed.get(user.userId) || 0) + (end !== start ? 2 : 1));
  });

  // Vai dong lam them khop gio cham; 1 dong khong co cham cong de lam ngoai le OT_NO_ATTENDANCE that.
  const overtimeDays = new Map();
  shuffled.slice(3, 6).forEach((user, index) => {
    const days = usableDays(user).filter((date) => hashOf(`${user.userId}|${date}`).readUInt32BE(0) % 100 < 80);
    if (days.length > 0) overtimeDays.set(`${user.userId}|${days[index % days.length]}`, true);
  });
  const orphanOvertime = shuffled[6]
    ? usableDays(shuffled[6]).find((date) => { const b = hashOf(`${shuffled[6].userId}|${date}`).readUInt32BE(0) % 100; return b >= 93 && b < 97; })
    : undefined;
  if (orphanOvertime) {
    plan.overtimes.push({ userId: shuffled[6].userId, date: orphanOvertime, otStart: '18:00', otEnd: '20:00', hours: 2 });
  }

  const workStart = toMinutes(org.workStart);
  const workEnd = toMinutes(org.workEnd);
  for (const user of org.users) {
    for (const date of usableDays(user)) {
      const key = `${user.userId}|${date}`;
      const hash = hashOf(key);
      const bucket = hash.readUInt32BE(0) % 100;
      const forced = forcedLeave.get(key);
      if (forced) {
        if (!forced.covered) plan.leaves.push({ userId: user.userId, ...forced });
        continue;
      }
      if (bucket >= 93 && bucket < 97) continue; // vang
      if (bucket >= 97) {
        let leaveType = ['ANNUAL', 'SICK', 'UNPAID'][hash[5] % 3];
        const used = annualUsed.get(user.userId) || 0;
        if (leaveType === 'ANNUAL' && used >= MAX_SEED_ANNUAL_DAYS) leaveType = 'SICK';
        if (leaveType === 'ANNUAL') annualUsed.set(user.userId, used + 1);
        plan.leaves.push({ userId: user.userId, leaveType, start: date, end: date });
        continue;
      }
      const isLate = bucket >= 80 && bucket < 90;
      const noCheckOut = bucket >= 90;
      const checkIn = isLate ? workStart + 1 + (hash[6] % 45) : workStart - 1 - (hash[6] % 25);
      let checkOut = workEnd + 1 + (hash[7] % 25);
      if (overtimeDays.has(key)) {
        checkOut = 20 * 60 + 1 + (hash[7] % 10);
        plan.overtimes.push({ userId: user.userId, date, otStart: '18:00', otEnd: '20:00', hours: 2 });
      }
      plan.attendances.push({
        userId: user.userId,
        date,
        checkInAt: at(date, checkIn, hash[8] % 60),
        checkOutAt: noCheckOut ? null : at(date, checkOut, hash[9] % 60),
        lat: OFFICE.lat + (hash[10] - 128) / 200000,
        lng: OFFICE.lng + (hash[11] - 128) / 200000,
      });
    }
  }
  return plan;
}

function insert(table, columns, values, conflict = 'on conflict do nothing') {
  if (values.length === 0) return 0;
  const body = values.map((row) => `(${row.map(sqlValue).join(', ')})`).join(',\n');
  return Number(sql('postgres-hrm', `with ins as (insert into ${table} (${columns.join(', ')}) values\n${body}\n${conflict} returning 1) select count(*) from ins;`));
}

function seedOrg(name, lastDate) {
  const org = loadOrg(name);
  if (!org) {
    console.log(`Bo qua "${name}": chua co to chuc nay`);
    return;
  }
  if (!org.approverId) throw new Error(`"${name}" khong co Org Admin de ghi nguoi duyet`);
  const plan = buildPlan(org, lastDate);
  const { organizationId, approverId } = org;

  const attendanceCount = insert('attendances',
    ['id', 'organization_id', 'user_id', 'work_date', 'check_in_at', 'check_in_photo_object_key', 'check_in_latitude', 'check_in_longitude', 'check_in_is_on_site',
      'check_out_at', 'check_out_photo_object_key', 'check_out_latitude', 'check_out_longitude', 'check_out_is_on_site', 'created_at', 'updated_at'],
    plan.attendances.map((row) => [
      seedId('attendance', row.userId, row.date), organizationId, row.userId, row.date, row.checkInAt, PHOTO_KEY, row.lat, row.lng, 'true',
      row.checkOutAt, row.checkOutAt ? PHOTO_KEY : null, row.checkOutAt ? row.lat : null, row.checkOutAt ? row.lng : null, row.checkOutAt ? 'true' : null,
      row.checkInAt, row.checkOutAt || row.checkInAt,
    ]));
  const leaveCount = insert('leave_requests',
    ['id', 'organization_id', 'user_id', 'start_date', 'end_date', 'reason', 'leave_type', 'status', 'approver_id', 'decision_note', 'decided_at', 'created_at', 'updated_at'],
    plan.leaves.map((row) => {
      const requestedAt = at(addDays(row.start, -3), 9 * 60);
      const decidedAt = at(addDays(row.start, -2), 10 * 60);
      return [seedId('leave', row.userId, row.start), organizationId, row.userId, row.start, row.end, REASONS[row.leaveType], row.leaveType, 'APPROVED', approverId, 'Đồng ý', decidedAt, requestedAt, decidedAt];
    }));
  const overtimeCount = insert('overtime_requests',
    ['id', 'organization_id', 'user_id', 'work_date', 'ot_start', 'ot_end', 'multiplier_type', 'multiplier', 'estimated_hours', 'reason', 'status', 'approver_id', 'decision_note', 'decided_at'],
    plan.overtimes.map((row) => [
      seedId('overtime', row.userId, row.date), organizationId, row.userId, row.date, row.otStart, row.otEnd, 'WEEKDAY', 1.5, row.hours, 'Hoàn thành công việc cuối ngày', 'APPROVED', approverId, 'Đồng ý', at(row.date, 12 * 60),
    ]));
  console.log(`${name}: ${org.users.length} người, thêm ${attendanceCount}/${plan.attendances.length} chấm công, ${leaveCount}/${plan.leaves.length} đơn nghỉ, ${overtimeCount}/${plan.overtimes.length} làm thêm`);
}

function main() {
  const lastDate = addDays(todayGmt7(), -1);
  uploadPlaceholder();
  for (const name of ORGS) seedOrg(name, lastDate);
}

main();
