// 27/10/2026 - Bổ sung unit test cho Việc 5.1 & 5.2
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PersonalAttendanceTable, type PersonalAttendanceTableProps } from './PersonalAttendanceTable';
import type { Attendance, LeaveRequest } from '@/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      if (key === 'hrm:attendancePage.history.cardTitle') return 'Lịch sử chấm công';
      if (key === 'hrm:attendancePage.history.emptyState') return 'Chưa có lịch sử chấm công';
      if (key === 'hrm:attendancePage.statusBadge.onTime') return 'Đúng giờ';
      if (key === 'hrm:attendancePage.statusBadge.late') return 'Đi muộn';
      if (key === 'hrm:attendancePage.statusBadge.missingCheckOut') return 'Chưa check-out';
      if (key === 'hrm:attendancePage.onSiteBadge.onSite') return 'Tại văn phòng';
      if (key === 'hrm:attendancePage.faceMatchBadge.matched') return 'Khớp khuôn mặt';
      if (key === 'hrm:newLeaveRequestModal.types.ANNUAL') return 'Nghỉ phép năm';
      return key;
    },
  }),
}));

describe('PersonalAttendanceTable - Bảng chấm công cá nhân', () => {
  const records: Attendance[] = [
    {
      id: 'att-1',
      userId: 'user-1',
      workDate: '2026-10-26',
      checkInAt: '2026-10-26T08:30:00+07:00',
      checkOutAt: '2026-10-26T17:30:00+07:00',
      checkInIsOnSite: true,
      checkInFaceMatched: true,
      checkInFaceMatchScore: 0.95,
      checkOutIsOnSite: true,
      checkOutFaceMatched: true,
      checkOutFaceMatchScore: 0.92,
      createdAt: '2026-10-26T08:30:00Z',
      updatedAt: '2026-10-26T17:30:00Z',
    },
    {
      id: 'att-2',
      userId: 'user-1',
      workDate: '2026-10-23', // Thứ 6 trong tháng 10
      checkInAt: '2026-10-23T09:15:00+07:00', // Đi muộn sau 08:30
      checkOutAt: '2026-10-23T17:30:00+07:00',
      checkInIsOnSite: false,
      checkInFaceMatched: false,
      createdAt: '2026-10-23T09:15:00Z',
      updatedAt: '2026-10-23T17:30:00Z',
    },
  ];

  const monthOptions = [
    { value: 'all', label: 'Tất cả các tháng' },
    { value: '2026-10', label: 'Tháng 10/2026' },
  ];

  const defaultProps: Omit<PersonalAttendanceTableProps, 'records'> = {
    approvedLeaveRequests: [],
    today: '2026-10-27',
    selectedMonth: '2026-10',
    monthOptions,
    onMonthChange: vi.fn(),
    isLoading: false,
    isError: false,
    onRetry: vi.fn(),
    approvedAdjustmentAttendanceIds: new Set(),
    pendingAdjustmentAttendanceIds: new Set(),
    onOpenOtModal: vi.fn(),
    onViewPhoto: vi.fn(),
    onRequestAdjustment: vi.fn(),
  };

  it('1. Render đầy đủ danh sách ngày làm việc và giờ check-in/out', () => {
    render(
      <PersonalAttendanceTable
        {...defaultProps}
        records={records}
      />,
    );

    expect(screen.getByText('26/10/2026')).toBeInTheDocument();
    expect(screen.getByText('23/10/2026')).toBeInTheDocument();
    expect(screen.getByText('08:30')).toBeInTheDocument();
    expect(screen.getAllByText('17:30').length).toBeGreaterThan(0);
  });

  it('2. Hiển thị đúng badge GPS On-site và Face Match %', () => {
    render(
      <PersonalAttendanceTable
        {...defaultProps}
        records={records}
      />,
    );

    expect(screen.getAllByText('Tại văn phòng').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/95%/).length).toBeGreaterThan(0);
  });

  it('3. Hiển thị đúng trạng thái "Đúng giờ" và "Đi muộn"', () => {
    render(
      <PersonalAttendanceTable
        {...defaultProps}
        records={records}
      />,
    );

    expect(screen.getByText('Đúng giờ')).toBeInTheDocument();
    expect(screen.getByText('Đi muộn')).toBeInTheDocument();
  });

  it('4. Liên thông hiển thị LeaveAttendanceBadge cho ngày nghỉ phép đã duyệt APPROVED trong tuần (T2-T6)', () => {
    // 2026-10-22 là Thứ Năm
    const leaveRequests: LeaveRequest[] = [
      {
        id: 'leave-1',
        userId: 'user-1',
        startDate: '2026-10-22',
        endDate: '2026-10-22',
        reason: '[ANNUAL] Nghỉ phép năm',
        status: 'APPROVED',
        createdAt: '2026-10-20T00:00:00Z',
        updatedAt: '2026-10-21T00:00:00Z',
      },
    ];

    render(
      <PersonalAttendanceTable
        {...defaultProps}
        records={records}
        approvedLeaveRequests={leaveRequests}
      />,
    );

    expect(screen.getByText('22/10/2026')).toBeInTheDocument();
    expect(screen.getByText('Nghỉ phép năm')).toBeInTheDocument();
  });
});
