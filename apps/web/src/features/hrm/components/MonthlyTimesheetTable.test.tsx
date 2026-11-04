// 04/11/2026: viet lai theo du lieu may chu - bang cong khong con tu tinh o trinh duyet (cac ca cu kiem tra
// phep tinh T2-T6/ngay le/nghi phep da chuyen sang spec cua timesheet-calculator o hrm-service), nen test
// o day kiem tra: ghep ten/phong ban, thang 'all', trang thai loading/loi, CSV chong injection, khoa/mo khoa ky
// (gom xac nhan force khi con don dang cho) va mo chi tiet khi bam dong.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { MonthlyTimesheetTable } from './MonthlyTimesheetTable';
import type { Department, TimesheetMonth, TimesheetRow, User } from '@/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Tra ve khoa kem tham so de test doi chieu duoc so lieu noi suy.
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key),
  }),
}));

let mockPermissions: string[] = [];
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: (selector?: (s: unknown) => unknown) => {
    const state = { user: { id: 'admin-1', fullName: 'Admin User' } };
    return selector ? selector(state) : state;
  },
  usePermissions: () => mockPermissions,
}));

const mockTimesheet = vi.fn();
const mockLockMutate = vi.fn();
const mockUnlockMutate = vi.fn();
vi.mock('../hooks', () => ({
  useTimesheetQuery: (month: string) => mockTimesheet(month),
  useLockTimesheetPeriod: () => ({ mutate: mockLockMutate, isPending: false }),
  useUnlockTimesheetPeriod: () => ({ mutate: mockUnlockMutate, isPending: false }),
}));

vi.mock('./TimesheetDetailModal', () => ({
  TimesheetDetailModal: ({ userId, month, canAdjust }: { userId: string; month: string; canAdjust: boolean }) => (
    <div data-testid="detail">{`${userId}|${month}|${canAdjust}`}</div>
  ),
}));
vi.mock('./WorkScheduleModal', () => ({
  WorkScheduleModal: ({ open }: { open: boolean }) => (open ? <div data-testid="schedule-modal" /> : null),
}));

const ORG_MANAGE = 'organization:manage';
const ADJUST = 'attendance_adjustment:approve';

const user: User = {
  id: 'user-001',
  email: 'employee@company.com',
  fullName: 'Nguyễn Văn A',
  departmentId: 'dept-1',
  roles: [],
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
};
const department: Department = { id: 'dept-1', name: 'Kỹ thuật', organizationId: 'org-1' };

function row(overrides: Partial<TimesheetRow> = {}): TimesheetRow {
  return {
    userId: user.id,
    departmentId: 'dept-1',
    joinedAt: '2026-01-01',
    actualDays: 20,
    offDayWorkDays: 0,
    paidLeaveDays: 2,
    unpaidLeaveDays: 0,
    paidHolidayDays: 0,
    absentDays: 0,
    paidDays: 22,
    expectedDays: 22,
    totalActualHours: 160,
    totalExpectedHours: 176,
    lateCount: 1,
    earlyLeaveCount: 0,
    missingCheckOutCount: 0,
    otHours: 3,
    approvedOtHours: 3,
    hasManual: false,
    isNewMember: false,
    status: 'sufficient',
    ...overrides,
  };
}

function month(rows: TimesheetRow[], status: 'OPEN' | 'LOCKED' = 'OPEN'): TimesheetMonth {
  return {
    month: '2026-10',
    period: { status, lockedAt: status === 'LOCKED' ? '2026-11-02T00:00:00Z' : null },
    schedule: { workingWeekdays: [1, 2, 3, 4, 5], workStart: '08:30', workEnd: '17:30', lateGraceMinutes: 0, earlyLeaveGraceMinutes: 0, breakMinutes: 60 },
    standardDays: 22,
    rows,
  };
}

function setQuery(data: TimesheetMonth | undefined, extra: Record<string, unknown> = {}) {
  mockTimesheet.mockReturnValue({ data, isLoading: false, isError: false, refetch: vi.fn(), ...extra });
}

function renderTable(selectedMonth = '2026-10', users: User[] = [user]) {
  return render(<MonthlyTimesheetTable users={users} departments={[department]} selectedMonth={selectedMonth} today="2026-11-04" />);
}

describe('MonthlyTimesheetTable - bảng công lấy dữ liệu máy chủ', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissions = [];
    setQuery(month([row()]));
  });

  it('Case 1: ghép tên + phòng ban từ users/departments vào dòng của máy chủ, hiện công hưởng lương / công chuẩn', () => {
    renderTable();
    expect(screen.getAllByText('Nguyễn Văn A').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Kỹ thuật').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/22 \/ 22/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('hrm:attendancePage.allAttendance.timesheet.status.sufficient').length).toBeGreaterThan(0);
    expect(mockTimesheet).toHaveBeenCalledWith('2026-10');
  });

  // 04/11/2026: máy chủ không đảm bảo thứ tự dòng; bảng phải sắp theo tên để không đổi chỗ giữa các lần xem.
  it('Case 1b: dòng được sắp theo tên, tên trùng thì theo mã người dùng', () => {
    const named = (id: string, fullName: string): User => ({ ...user, id, fullName });
    setQuery(month([row({ userId: 'u3' }), row({ userId: 'u1' }), row({ userId: 'u2' })]));
    const { container } = renderTable('2026-10', [named('u3', 'Đỗ Văn C'), named('u1', 'An Văn B'), named('u2', 'An Văn B')]);
    const names = [...container.querySelectorAll('table tbody tr')].map((tr) => tr.querySelector('td')?.textContent ?? '');
    expect(names.map((name) => name.replace(/^.*?(An Văn B|Đỗ Văn C).*$/, '$1'))).toEqual(['An Văn B', 'An Văn B', 'Đỗ Văn C']);
  });

  it('Case 2: dòng thiếu thông tin người dùng không làm vỡ bảng (hiện nhãn dự phòng, phòng ban "chưa gán")', () => {
    setQuery(month([row({ userId: 'ghost', departmentId: null })]));
    renderTable();
    expect(screen.getAllByText('hrm:timesheet.unknownEmployee').length).toBeGreaterThan(0);
    expect(screen.getAllByText('hrm:attendancePage.allAttendance.timesheet.noDepartment').length).toBeGreaterThan(0);
  });

  it('Case 3: tháng "all" dùng tháng hiện tại (từ today)', () => {
    renderTable('all');
    expect(mockTimesheet).toHaveBeenCalledWith('2026-11');
  });

  it('Case 4: đang tải thì không có bảng, lỗi thì hiện trạng thái lỗi (không trang trắng)', () => {
    setQuery(undefined, { isLoading: true });
    const { unmount } = renderTable();
    expect(screen.queryByText('Nguyễn Văn A')).toBeNull();
    unmount();

    setQuery(undefined, { isError: true });
    renderTable();
    expect(screen.getByText('hrm:timesheet.loadError')).toBeInTheDocument();
  });

  it('Case 5: bấm dòng mở chi tiết ngày của đúng nhân viên, kèm quyền sửa tay', () => {
    mockPermissions = [ADJUST];
    renderTable();
    fireEvent.click(screen.getAllByText('Nguyễn Văn A')[0]);
    expect(screen.getByTestId('detail')).toHaveTextContent('user-001|2026-10|true');
  });

  it('Case 6: xuất CSV giữ chống CSV injection (tên bắt đầu bằng "=" được bọc dấu nháy)', async () => {
    setQuery(month([row({ userId: 'evil' })]));
    const evilUser: User = { ...user, id: 'evil', fullName: '=HYPERLINK("http://x")' };
    let captured: Blob | null = null;
    const createUrl = vi.fn((b: Blob) => {
      captured = b;
      return 'blob:test';
    });
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: vi.fn() });

    renderTable('2026-10', [evilUser]);
    fireEvent.click(screen.getByText('hrm:attendancePage.allAttendance.exportCsv'));
    expect(createUrl).toHaveBeenCalled();

    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(captured as unknown as Blob);
    });
    expect(text).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(text).not.toMatch(/(^|,)=HYPERLINK/m);
  });
});

describe('MonthlyTimesheetTable - khóa và mở khóa kỳ', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissions = [ORG_MANAGE];
    setQuery(month([row()]));
  });

  it('Case 7: chỉ người có organization:manage thấy nút Khóa kỳ; kỳ đã khóa thì hiện nhãn khóa và nút Mở khóa', () => {
    mockPermissions = [];
    const { unmount } = renderTable();
    expect(screen.queryByText('hrm:timesheet.period.lockButton')).toBeNull();
    unmount();

    mockPermissions = [ORG_MANAGE];
    const second = renderTable();
    expect(screen.getByText('hrm:timesheet.period.lockButton')).toBeInTheDocument();
    expect(screen.queryByText('hrm:timesheet.period.unlockButton')).toBeNull();
    second.unmount();

    setQuery(month([row()], 'LOCKED'));
    renderTable();
    expect(screen.getByText('hrm:timesheet.period.status.LOCKED')).toBeInTheDocument();
    expect(screen.getByText('hrm:timesheet.period.unlockButton')).toBeInTheDocument();
    expect(screen.queryByText('hrm:timesheet.period.lockButton')).toBeNull();
  });

  it('Case 8: khóa kỳ có xác nhận; 409 TIMESHEET_PERIOD_HAS_PENDING hiện số đơn và xác nhận lại với force: true', async () => {
    renderTable();
    fireEvent.click(screen.getByText('hrm:timesheet.period.lockButton'));

    // Hộp xác nhận khóa thường: nút xác nhận cũng mang nhãn "Khóa kỳ" (nút thứ hai trong DOM)
    const lockButtons = screen.getAllByText('hrm:timesheet.period.lockButton');
    fireEvent.click(lockButtons[lockButtons.length - 1]);
    expect(mockLockMutate).toHaveBeenCalledTimes(1);
    expect(mockLockMutate.mock.calls[0][0]).toEqual({ month: '2026-10', force: false });

    // Máy chủ trả 409: còn 2 đơn nghỉ, 1 làm thêm, 3 giải trình
    const conflict = new AxiosError('conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 409,
      data: { errorCode: 'TIMESHEET_PERIOD_HAS_PENDING', errorParams: { leave: 2, overtime: 1, adjustment: 3 } },
    } as never);
    act(() => mockLockMutate.mock.calls[0][1].onError(conflict));

    expect(await screen.findByText(/"leave":2,"overtime":1,"adjustment":3/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('hrm:timesheet.period.forceLockButton'));
    await waitFor(() => expect(mockLockMutate).toHaveBeenCalledTimes(2));
    expect(mockLockMutate.mock.calls[1][0]).toEqual({ month: '2026-10', force: true });
  });

  it('Case 9: mở khóa bắt buộc nhập lý do', () => {
    setQuery(month([row()], 'LOCKED'));
    renderTable();
    fireEvent.click(screen.getByText('hrm:timesheet.period.unlockButton'));

    const buttons = screen.getAllByText('hrm:timesheet.period.unlockButton');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(mockUnlockMutate).not.toHaveBeenCalled();
    expect(screen.getByText('hrm:timesheet.period.reasonRequired')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: /hrm:timesheet.period.reasonLabel/ }), { target: { value: 'Sửa lại công' } });
    const again = screen.getAllByText('hrm:timesheet.period.unlockButton');
    fireEvent.click(again[again.length - 1]);
    expect(mockUnlockMutate).toHaveBeenCalledTimes(1);
    expect(mockUnlockMutate.mock.calls[0][0]).toEqual({ month: '2026-10', reason: 'Sửa lại công' });
  });
});
