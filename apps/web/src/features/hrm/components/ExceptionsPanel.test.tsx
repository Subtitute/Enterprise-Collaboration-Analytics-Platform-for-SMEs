// 04/11/2026: tab Ngoai le - o dem theo loai (loc duoc), so don dang cho, ten nhan vien, phan trang, loi/rong.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExceptionsPanel } from './ExceptionsPanel';
import type { TimesheetExceptions, User } from '@/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key),
  }),
}));

const mockQuery = vi.fn();
vi.mock('../hooks', () => ({
  useTimesheetExceptionsQuery: (params: unknown) => mockQuery(params),
}));

const users: User[] = [{ id: 'u1', email: 'a@x.com', fullName: 'Nguyễn Văn A', roles: [], isActive: true }];

const sample: TimesheetExceptions = {
  data: [
    { type: 'LATE', userId: 'u1', workDate: '2026-10-05', minutes: 12, checkInAt: '2026-10-05T01:42:00Z' },
    { type: 'ABSENT', userId: 'ghost', workDate: '2026-10-04' },
  ],
  meta: { page: 1, limit: 20, total: 2 },
  counts: { LATE: 1, EARLY_LEAVE: 0, ABSENT: 1, MISSING_CHECKOUT: 0, NOT_CHECKED_IN: 0, OT_NO_ATTENDANCE: 0 },
  pending: { leave: 2, overtime: 1, adjustment: 0 },
};

function setQuery(data: TimesheetExceptions | undefined, extra: Record<string, unknown> = {}) {
  mockQuery.mockReturnValue({ data, isLoading: false, isError: false, refetch: vi.fn(), ...extra });
}

describe('ExceptionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setQuery(sample);
  });

  it('Case 1: hiện dòng ngoại lệ với tên nhân viên, tên thiếu thì dùng nhãn dự phòng; tháng "all" dùng tháng hiện tại', () => {
    render(<ExceptionsPanel selectedMonth="all" today="2026-11-04" users={users} />);
    expect(mockQuery).toHaveBeenCalledWith({ month: '2026-11', type: undefined, page: 1, limit: 20 });
    expect(screen.getAllByText('Nguyễn Văn A').length).toBeGreaterThan(0);
    expect(screen.getAllByText('hrm:timesheet.unknownEmployee').length).toBeGreaterThan(0);
    expect(screen.getAllByText('05/10/2026').length).toBeGreaterThan(0);
  });

  it('Case 2: ô đếm theo loại bấm được để lọc, bấm lại thì bỏ lọc; hiện số đơn đang chờ', () => {
    render(<ExceptionsPanel selectedMonth="2026-10" today="2026-11-04" users={users} />);
    expect(screen.getByText(/"leave":2,"overtime":1,"adjustment":0/)).toBeInTheDocument();

    const lateTile = screen.getAllByText('hrm:exceptions.types.LATE')[0].closest('button') as HTMLElement;
    fireEvent.click(lateTile);
    expect(mockQuery).toHaveBeenLastCalledWith({ month: '2026-10', type: 'LATE', page: 1, limit: 20 });
    fireEvent.click(lateTile);
    expect(mockQuery).toHaveBeenLastCalledWith({ month: '2026-10', type: undefined, page: 1, limit: 20 });
  });

  it('Case 3: không có ngoại lệ thì hiện EmptyState; lỗi thì hiện trạng thái lỗi (không trang trắng)', () => {
    setQuery({ ...sample, data: [], meta: { page: 1, limit: 20, total: 0 } });
    const { unmount } = render(<ExceptionsPanel selectedMonth="2026-10" today="2026-11-04" users={users} />);
    expect(screen.getByText('hrm:exceptions.emptyTitle')).toBeInTheDocument();
    unmount();

    setQuery(undefined, { isError: true });
    render(<ExceptionsPanel selectedMonth="2026-10" today="2026-11-04" users={users} />);
    expect(screen.getByText('hrm:exceptions.loadError')).toBeInTheDocument();
  });

  it('Case 4: nhiều trang thì chuyển trang gọi lại với page mới', () => {
    setQuery({ ...sample, meta: { page: 1, limit: 20, total: 45 } });
    render(<ExceptionsPanel selectedMonth="2026-10" today="2026-11-04" users={users} />);
    fireEvent.click(screen.getByText('common:pagination.next'));
    expect(mockQuery).toHaveBeenLastCalledWith({ month: '2026-10', type: undefined, page: 2, limit: 20 });
  });
});
