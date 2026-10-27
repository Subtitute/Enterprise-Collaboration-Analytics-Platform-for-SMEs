import { zipSync, strToU8 } from 'fflate';
import { formatPhone, normalizeVietnamesePhone } from '@/lib/phone';
import {
  COLUMNS,
  LIMITS,
  ZipLimitError,
  buildReportRows,
  classifyRows,
  hasReportableRows,
  photoDisplayState,
  matchPhoto,
  parseRows,
  readPhotoZip,
  rowIsWritable,
  unmatchedPhotos,
} from './import-employees.utils';

// 26/10/2026: trinh nhap Excel + ZIP anh nhan dien (Technical_Spec.md muc 27.9/27.13) - .zip sinh trong test.

const record = (overrides: Record<string, string>) => ({
  [COLUMNS.fullName]: 'Nguyen Van An',
  [COLUMNS.email]: 'an@congty.vn',
  [COLUMNS.phone]: '',
  [COLUMNS.employeeCode]: '',
  [COLUMNS.department]: '',
  [COLUMNS.role]: '',
  [COLUMNS.password]: '',
  [COLUMNS.photo]: '',
  ...overrides,
});

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

describe('so dien thoai Viet Nam', () => {
  it('chuan hoa va hien thi', () => {
    expect(normalizeVietnamesePhone('+84 912.345.678')).toBe('0912345678');
    expect(normalizeVietnamesePhone('0283 812 3456')).toBe('02838123456');
    expect(normalizeVietnamesePhone('0112345678')).toBeNull();
    expect(formatPhone('0912345678')).toBe('0912 345 678');
    expect(formatPhone('02838123456')).toBe('028 3812 3456');
    expect(formatPhone(null)).toBe('—');
  });
});

describe('parseRows', () => {
  it('kiem tra email/SDT/ma NV/mat khau va trung trong tep; mat khau khong vao bao cao', () => {
    const rows = parseRows([
      record({ [COLUMNS.email]: 'A@CongTy.vn', [COLUMNS.phone]: '0912 345 678', [COLUMNS.password]: 'Secret123!' }),
      record({ [COLUMNS.email]: 'a@congty.vn', [COLUMNS.employeeCode]: 'NV 1' }),
      record({ [COLUMNS.email]: 'sai-email', [COLUMNS.phone]: '123', [COLUMNS.password]: 'ngan' }),
    ]);
    // 26/10/2026: chi dong THU 2 bi danh trung, dong dau van hop le.
    expect(rows[0]).toMatchObject({ rowNumber: 2, email: 'a@congty.vn', phoneNumber: '0912345678', errors: [] });
    expect(rows[0].raw[COLUMNS.password]).toBe('');
    expect(rows[1].errors).toEqual(['invalidEmployeeCode', 'duplicateEmailInFile']);
    expect(rows[2].errors).toEqual(['invalidEmail', 'invalidPhone', 'passwordTooShort']);
  });

  it('ma nhan vien trung trong tep khong phan biet hoa thuong - chi tu dong thu 2', () => {
    const rows = parseRows([
      record({ [COLUMNS.email]: 'a@x.vn', [COLUMNS.employeeCode]: 'nv001' }),
      record({ [COLUMNS.email]: 'b@x.vn', [COLUMNS.employeeCode]: 'NV001' }),
      record({ [COLUMNS.email]: 'c@x.vn', [COLUMNS.employeeCode]: 'Nv001' }),
    ]);
    expect(rows.map((r) => r.errors.includes('duplicateEmployeeCodeInFile'))).toEqual([false, true, true]);
  });
});

describe('classifyRows', () => {
  const ctx = {
    orgEmails: new Map([
      ['old@x.vn', 'u-old'],
      ['other@x.vn', 'u-other'],
    ]),
    scopeIds: new Set(['u-old']),
    departments: [{ id: 'd1', name: 'Kinh doanh' }],
    roles: [{ id: 'r1', name: 'Employee', permissionKeys: [] }],
  };

  it('Org Admin: email moi -> moi, email da co -> cap nhat (bo qua ho ten/phong ban), ngoai pham vi -> loi', () => {
    const rows = parseRows([
      record({ [COLUMNS.email]: 'new@x.vn', [COLUMNS.department]: 'kinh doanh', [COLUMNS.role]: 'employee' }),
      record({ [COLUMNS.email]: 'old@x.vn', [COLUMNS.department]: 'Kinh doanh' }),
      record({ [COLUMNS.email]: 'other@x.vn' }),
      record({ [COLUMNS.email]: 'nodept@x.vn', [COLUMNS.department]: 'Khong co' }),
      record({ [COLUMNS.email]: 'noname@x.vn', [COLUMNS.fullName]: '' }),
    ]);
    classifyRows(rows, { ...ctx, canManageUsers: true });
    expect(rows[0]).toMatchObject({ action: 'invite', departmentId: 'd1', roleId: 'r1', errors: [] });
    expect(rows[1]).toMatchObject({ action: 'update', userId: 'u-old', notes: ['updateIgnoresFields'] });
    expect(rows[2]).toMatchObject({ action: 'outOfScope', errors: ['outOfScope'] });
    expect(rows[3].errors).toEqual(['departmentNotFound']);
    expect(rows[4].errors).toEqual(['missingFullName']);
    expect(rows.filter(rowIsWritable)).toHaveLength(2);
  });

  it('Manager: SDT/ma NV/vai tro/phong ban bi bo qua; anh chi cho nguoi da co; NV da tu choi -> bo qua anh', () => {
    const rows = parseRows([
      record({ [COLUMNS.email]: 'new@x.vn', [COLUMNS.phone]: '0912345678', [COLUMNS.role]: 'Employee' }),
      record({ [COLUMNS.email]: 'old@x.vn' }),
    ]);
    rows[0].photo = { blob: new Blob([JPEG]) };
    rows[1].photo = { blob: new Blob([JPEG]) };
    classifyRows(rows, { ...ctx, canManageUsers: false, faceStatusById: { 'u-old': 'WITHDRAWN' } });
    expect(rows[0].notes).toEqual(['managerContactIgnored', 'managerRoleDepartmentIgnored']);
    expect(rows[0].roleId).toBeUndefined();
    expect(rows[0].photo?.skipReason).toBe('managerPhotoExistingOnly');
    expect(rows[1].photo?.skipReason).toBe('photoWithdrawn');
  });
});

describe('ZIP anh: ghep theo cot/email, gioi han, bo thu muc', () => {
  const zip = zipSync({
    'an.nguyen.JPG': JPEG,
    'phong-ky-thuat/chi.le.jpg': JPEG,
    'binh@x.vn.png': JPEG,
    'a/trung.jpg': JPEG,
    'b/trung.jpg': JPEG,
    'ghi-chu.txt': strToU8('khong phai anh'),
    '__MACOSX/._an.nguyen.JPG': JPEG,
    '.hidden.jpg': JPEG,
    'thua.jpg': JPEG,
  });

  it('khop khong phan biet hoa thuong, bo thu muc, de trong -> theo email, ten trung -> loi', () => {
    const index = readPhotoZip(zip);
    expect(matchPhoto({ photoColumn: 'An.Nguyen.jpg', email: 'x@x.vn' }, index)).toMatchObject({ fileName: 'an.nguyen.jpg' });
    expect(matchPhoto({ photoColumn: 'chi.le.jpg', email: 'x@x.vn' }, index)).toMatchObject({ fileName: 'chi.le.jpg' });
    expect(matchPhoto({ photoColumn: '', email: 'binh@x.vn' }, index)).toMatchObject({ fileName: 'binh@x.vn.png' });
    expect(matchPhoto({ photoColumn: 'trung.jpg', email: 'x@x.vn' }, index)).toEqual({ fileName: 'trung.jpg', error: 'photoDuplicateName' });
    expect(matchPhoto({ photoColumn: 'khong-co.jpg', email: 'x@x.vn' }, index)).toEqual({ fileName: 'khong-co.jpg', error: 'photoNotFound' });
    expect(matchPhoto({ photoColumn: 'anh.heic', email: 'x@x.vn' }, index)).toEqual({ fileName: 'anh.heic', error: 'photoUnsupported' });
    expect(matchPhoto({ photoColumn: '', email: 'khong@x.vn' }, index)).toBeNull();
    expect(index.files.has('._an.nguyen.jpg')).toBe(false);
    expect(index.files.has('.hidden.jpg')).toBe(false);
    expect(matchPhoto({ photoColumn: 'a.jpg', email: 'x@x.vn' }, null)).toEqual({ fileName: 'a.jpg', error: 'photoNoZip' });
  });

  it('anh khong khop dong nao duoc liet ke', () => {
    const index = readPhotoZip(zip);
    const rows = parseRows([record({ [COLUMNS.photo]: 'an.nguyen.jpg' })]);
    rows[0].photo = { fileName: 'an.nguyen.jpg' };
    expect(unmatchedPhotos(rows, index)).toEqual(expect.arrayContaining(['thua.jpg', 'chi.le.jpg']));
  });

  it('chong zip bomb: vuot tong kich thuoc khai bao / so tep -> dung TRUOC khi giai nen', () => {
    const saved = { ...LIMITS };
    try {
      LIMITS.zipTotalUncompressed = 3000;
      const bomb = zipSync({ 'a.jpg': new Uint8Array(4000) });
      expect(() => readPhotoZip(bomb)).toThrow(ZipLimitError);
      LIMITS.zipTotalUncompressed = saved.zipTotalUncompressed;
      LIMITS.zipEntries = 2;
      expect(() => readPhotoZip(zipSync({ '1.jpg': JPEG, '2.jpg': JPEG, '3.jpg': JPEG }))).toThrow('zipTooManyFiles');
      LIMITS.zipEntries = saved.zipEntries;
      LIMITS.photoBytes = 2;
      expect(matchPhoto({ photoColumn: 'big.jpg', email: '' }, readPhotoZip(zipSync({ 'big.jpg': JPEG })))).toEqual({ fileName: 'big.jpg', error: 'photoTooLarge' });
    } finally {
      Object.assign(LIMITS, saved);
    }
  });
});

describe('buildReportRows', () => {
  it('chi dong loi/mot phan, cot goc + 3 cot ket qua, khong mat khau', () => {
    const rows = parseRows([
      record({ [COLUMNS.email]: 'ok@x.vn', [COLUMNS.password]: 'Secret123!' }),
      record({ [COLUMNS.email]: 'bad', [COLUMNS.password]: 'Secret123!' }),
    ]);
    rows[0].account = { status: 'ok' };
    rows[0].photoStep = { status: 'skipped' };
    const report = buildReportRows(rows, (code) => `t:${code}`);
    expect(report).toHaveLength(2);
    expect(report[0].slice(-3)).toEqual(['Kết quả tài khoản', 'Kết quả ảnh', 'Lý do']);
    expect(report[1]).not.toContain('Secret123!');
    expect(report[1].slice(-1)[0]).toContain('t:invalidEmail');
  });
});

// 26/10/2026: sua UX trinh nhap (phat hien qua kiem thu A4).
describe('UX trinh nhap', () => {
  it('bao cao: ly do anh khong bi lap; nut tai bao cao chi khi co dong loi', () => {
    const rows = parseRows([record({ [COLUMNS.email]: 'ok@x.vn' }), record({ [COLUMNS.email]: 'p@x.vn' })]);
    rows[0].account = { status: 'ok' };
    rows[0].photoStep = { status: 'skipped' };
    rows[1].account = { status: 'ok' };
    expect(hasReportableRows(rows)).toBe(false);
    rows[1].photo = { fileName: 'p.jpg', error: 'photoNotFound' };
    rows[1].photoStep = { status: 'error', message: 't:photoNotFound' };
    expect(hasReportableRows(rows)).toBe(true);
    const report = buildReportRows(rows, (code) => `t:${code}`);
    expect(report).toHaveLength(2);
    expect(report[1].slice(-1)[0]).toBe('t:photoNotFound');
  });

  it('o anh: dong loi khong kiem tra -> notChecked (khong phai "dang kiem tra" mai mai)', () => {
    const [bad, good] = parseRows([record({ [COLUMNS.email]: 'sai' }), record({ [COLUMNS.email]: 'dung@x.vn' })]);
    bad.photo = { fileName: 'a.jpg', blob: new Blob([JPEG]) };
    good.action = 'invite';
    good.photo = { fileName: 'b.jpg', blob: new Blob([JPEG]) };
    expect(photoDisplayState(bad)).toBe('notChecked');
    expect(photoDisplayState(good)).toBe('checking');
    good.photo.inspect = { ok: true, errorCode: null, warnings: [], faceCount: 1, faceHeight: 200, sharpness: 500, duplicateUserId: null };
    expect(photoDisplayState(good)).toBe('ok');
    good.photo.skipReason = 'photoWithdrawn';
    expect(photoDisplayState(good)).toBe('skipped');
    expect(photoDisplayState({ ...good, photo: undefined })).toBe('none');
  });
});
