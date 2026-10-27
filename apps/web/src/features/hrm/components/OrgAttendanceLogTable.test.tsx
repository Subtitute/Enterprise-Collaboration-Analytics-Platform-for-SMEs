// 27/10/2026 - Bổ sung unit test cho Việc 5.1 & 5.2
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrgAttendanceLogTable } from './OrgAttendanceLogTable';
import type { Attendance } from '@/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      if (key === 'hrm:attendancePage.allAttendance.columns.employee') return 'Nhân viên';
      if (key === 'hrm:attendancePage.allAttendance.columns.date') return 'Ngày';
      if (key === 'hrm:attendancePage.allAttendance.columns.checkIn') return 'Giờ vào';
      if (key === 'hrm:attendancePage.allAttendance.columns.checkOut') return 'Giờ ra';
      if (key === 'hrm:attendancePage.allAttendance.columns.totalHours') return 'Tổng giờ';
      if (key === 'hrm:attendancePage.allAttendance.columns.status') return 'Trạng thái';
      if (key === 'hrm:attendancePage.statusBadge.onTime') return 'Đúng giờ';
      if (key === 'hrm:attendancePage.statusBadge.late') return 'Đi muộn';
      if (key === 'hrm:attendancePage.onSiteBadge.onSite') return 'Tại văn phòng';
      if (key === 'hrm:attendancePage.faceMatchBadge.matched') return 'Khớp khuôn mặt';
      return key;
    },
  }),
}));

describe('OrgAttendanceLogTable - Danh sách chấm công toàn công ty', () => {
  const userNameMap: Record<string, string> = {
    'user-1': 'Trần Văn An',
    'user-2': 'Lê Thị Bình',
  };

  const records: Attendance[] = [
    {
      id: 'att-1',
      userId: 'user-1',
      workDate: '2026-10-26',
      checkInAt: '2026-10-26T08:25:00+07:00',
      checkOutAt: '2026-10-26T17:35:00+07:00',
      checkInIsOnSite: true,
      checkInFaceMatched: true,
      checkInFaceMatchScore: 0.98,
      createdAt: '2026-10-26T08:25:00Z',
      updatedAt: '2026-10-26T17:35:00Z',
    },
    {
      id: 'att-2',
      userId: 'user-2',
      workDate: '2026-10-26',
      checkInAt: '2026-10-26T09:10:00+07:00',
      checkOutAt: '2026-10-26T17:30:00+07:00',
      checkInIsOnSite: false,
      checkInFaceMatched: false,
      createdAt: '2026-10-26T09:10:00Z',
      updatedAt: '2026-10-26T17:30:00Z',
    },
  ];

  it('1. Render đầy đủ danh sách nhân viên và cột thông tin', () => {
    render(
      <OrgAttendanceLogTable
        records={records}
        userNameMap={userNameMap}
        today="2026-10-27"
        approvedAdjustmentAttendanceIds={new Set()}
        onNavigateUser={vi.fn()}
        onViewPhoto={vi.fn()}
      />,
    );

    expect(screen.getByText('Trần Văn An')).toBeInTheDocument();
    expect(screen.getByText('Lê Thị Bình')).toBeInTheDocument();
    expect(screen.getByText('Nhân viên')).toBeInTheDocument();
    expect(screen.getByText('Giờ vào')).toBeInTheDocument();
    expect(screen.getByText('Giờ ra')).toBeInTheDocument();
  });

  it('2. Hiển thị đúng trạng thái chấm công Đúng giờ và Đi muộn cho từng nhân viên', () => {
    render(
      <OrgAttendanceLogTable
        records={records}
        userNameMap={userNameMap}
        today="2026-10-27"
        approvedAdjustmentAttendanceIds={new Set()}
        onNavigateUser={vi.fn()}
        onViewPhoto={vi.fn()}
      />,
    );

    expect(screen.getByText('Đúng giờ')).toBeInTheDocument();
    expect(screen.getByText('Đi muộn')).toBeInTheDocument();
  });

  it('3. Kích hoạt onNavigateUser khi click vào hàng nhân viên', () => {
    const handleNavigate = vi.fn();
    render(
      <OrgAttendanceLogTable
        records={records}
        userNameMap={userNameMap}
        today="2026-10-27"
        approvedAdjustmentAttendanceIds={new Set()}
        onNavigateUser={handleNavigate}
        onViewPhoto={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Trần Văn An'));
    expect(handleNavigate).toHaveBeenCalledWith('user-1');
  });
});

