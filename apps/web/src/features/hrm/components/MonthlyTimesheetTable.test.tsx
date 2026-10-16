import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MonthlyTimesheetTable } from './MonthlyTimesheetTable';
import type { Attendance, CalendarEvent, Department, LeaveRequest, OvertimeRequest, User } from '@/types';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      if (key === 'hrm:attendancePage.allAttendance.timesheet.status.sufficient') return 'Đủ công';
      if (key === 'hrm:attendancePage.allAttendance.timesheet.status.insufficient') return 'Thiếu công';
      if (key === 'hrm:attendancePage.allAttendance.timesheet.status.newMember') return 'Nhân viên mới';
      if (key === 'hrm:attendancePage.allAttendance.timesheet.status.notJoined') return 'Chưa gia nhập';
      if (options?.month) return `Tháng ${options.month}`;
      return key;
    },
  }),
}));

// Mock auth store
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    user: { id: 'admin-1', fullName: 'Admin User' },
  }),
}));

describe('MonthlyTimesheetTable - Liên thông Chấm công, Nghỉ phép và Lịch công ty', () => {
  const mockUser: User = {
    id: 'user-001',
    email: 'employee@company.com',
    fullName: 'Nguyễn Văn A',
    departmentId: 'dept-1',
    roles: [],
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  };

  const mockDepartment: Department = {
    id: 'dept-1',
    name: 'Kỹ thuật',
    organizationId: 'org-1',
  };

  // Tháng 10/2026: Có 31 ngày, 22 ngày làm việc chuẩn (T2-T6)
  const selectedMonth = '2026-10';
  const today = '2026-10-31';

  // Helper tạo danh sách log chấm công
  function createAttendanceRecords(userId: string, count: number): Attendance[] {
    const records: Attendance[] = [];
    let added = 0;
    // Bắt đầu từ ngày 1/10/2026
    const cur = new Date(2026, 9, 1);
    while (added < count && cur.getMonth() === 9) {
      const day = cur.getDay();
      if (day >= 1 && day <= 5) {
        const d = String(cur.getDate()).padStart(2, '0');
        const workDate = `2026-10-${d}`;
        records.push({
          id: `att-${added + 1}`,
          userId,
          workDate,
          checkInAt: `${workDate}T08:30:00+07:00`,
          checkOutAt: `${workDate}T17:30:00+07:00`,
          createdAt: `${workDate}T08:30:00Z`,
          updatedAt: `${workDate}T17:30:00Z`,
        });
        added++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return records;
  }

  it('Case 1: Nhân viên làm đủ 22/22 ngày chuẩn -> paidDays = 22, status = "Đủ công"', () => {
    const records = createAttendanceRecords(mockUser.id, 22);

    render(
      <MonthlyTimesheetTable
        records={records}
        users={[mockUser]}
        departments={[mockDepartment]}
        selectedMonth={selectedMonth}
        today={today}
        approvedOvertime={[]}
        approvedLeaveRequests={[]}
        calendarEvents={[]}
      />,
    );

    expect(screen.getAllByText('Đủ công').length).toBeGreaterThan(0);
    // Kiểm tra hiển thị ngày công
    expect(screen.getAllByText(/22 \/ 22/).length).toBeGreaterThan(0);
  });

  it('Case 2: 20 ngày đi làm thực tế + 2 ngày nghỉ phép năm có lương (ANNUAL) -> paidDays = 22, status = "Đủ công"', () => {
    // 20 ngày đi làm thực tế
    const records = createAttendanceRecords(mockUser.id, 20);

    // 2 ngày nghỉ phép năm: Thứ Năm 29/10/2026 & Thứ Sáu 30/10/2026 (ngày làm thứ 21 & 22 trong tháng)
    const approvedLeave: LeaveRequest = {
      id: 'leave-1',
      userId: mockUser.id,
      startDate: '2026-10-29',
      endDate: '2026-10-30',
      reason: '[ANNUAL] Nghỉ phép du lịch gia đình',
      status: 'APPROVED',
      createdAt: '2026-10-20T00:00:00Z',
      updatedAt: '2026-10-21T00:00:00Z',
    };

    render(
      <MonthlyTimesheetTable
        records={records}
        users={[mockUser]}
        departments={[mockDepartment]}
        selectedMonth={selectedMonth}
        today={today}
        approvedOvertime={[]}
        approvedLeaveRequests={[approvedLeave]}
        calendarEvents={[]}
      />,
    );

    expect(screen.getAllByText('Đủ công').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/22 \/ 22/).length).toBeGreaterThan(0);
    // Chú thích (20 làm + 2 phép)
    expect(screen.getAllByText('(20 làm + 2 phép)').length).toBeGreaterThan(0);
  });

  it('Case 3: 21 ngày đi làm thực tế + 1 ngày lễ công ty (HOLIDAY rơi vào T2-T6) -> paidDays = 22, status = "Đủ công"', () => {
    // 21 ngày đi làm thực tế
    const records = createAttendanceRecords(mockUser.id, 21);

    // 1 ngày lễ công ty rơi vào Thứ Sáu 30/10/2026
    const holiday: CalendarEvent = {
      id: 'holiday-1',
      title: 'Ngày thành lập công ty',
      type: 'HOLIDAY',
      startDate: '2026-10-30',
      endDate: '2026-10-30',
      createdByUserId: 'admin-1',
      createdByRank: 3,
      createdAt: '2026-10-01T00:00:00Z',
    };

    render(
      <MonthlyTimesheetTable
        records={records}
        users={[mockUser]}
        departments={[mockDepartment]}
        selectedMonth={selectedMonth}
        today={today}
        approvedOvertime={[]}
        approvedLeaveRequests={[]}
        calendarEvents={[holiday]}
      />,
    );

    expect(screen.getAllByText('Đủ công').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/22 \/ 22/).length).toBeGreaterThan(0);
  });

  it('Case 4: 19 ngày đi làm thực tế + 3 ngày nghỉ không lương (UNPAID) -> paidDays = 19, status = "Thiếu công"', () => {
    // 19 ngày đi làm thực tế
    const records = createAttendanceRecords(mockUser.id, 19);

    // 3 ngày nghỉ việc riêng không hưởng lương (UNPAID)
    const unpaidLeave: LeaveRequest = {
      id: 'leave-unpaid-1',
      userId: mockUser.id,
      startDate: '2026-10-28',
      endDate: '2026-10-30',
      reason: '[UNPAID] Việc riêng gia đình',
      status: 'APPROVED',
      createdAt: '2026-10-20T00:00:00Z',
      updatedAt: '2026-10-21T00:00:00Z',
    };

    render(
      <MonthlyTimesheetTable
        records={records}
        users={[mockUser]}
        departments={[mockDepartment]}
        selectedMonth={selectedMonth}
        today={today}
        approvedOvertime={[]}
        approvedLeaveRequests={[unpaidLeave]}
        calendarEvents={[]}
      />,
    );

    expect(screen.getAllByText('Thiếu công').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/19 \/ 22/).length).toBeGreaterThan(0);
  });

  it('Case 5: Nhân viên có đơn nghỉ phép APPROVED vào ngày X nhưng thực tế vẫn đi làm và check-in -> paidDays chỉ tính đúng 1 công (không bị cộng trùng thành 2 công)', () => {
    // 20 ngày đi làm thực tế (từ 01/10/2026 đến 28/10/2026)
    const records = createAttendanceRecords(mockUser.id, 20);

    // Đơn nghỉ phép năm APPROVED rơi vào đúng ngày Thứ Tư 28/10/2026 (ngày nhân viên vẫn đến làm và check-in)
    const approvedLeaveConflict: LeaveRequest = {
      id: 'leave-conflict-1',
      userId: mockUser.id,
      startDate: '2026-10-28',
      endDate: '2026-10-28',
      reason: '[ANNUAL] Nghỉ phép cá nhân nhưng vẫn đi làm',
      status: 'APPROVED',
      createdAt: '2026-10-20T00:00:00Z',
      updatedAt: '2026-10-21T00:00:00Z',
    };

    render(
      <MonthlyTimesheetTable
        records={records}
        users={[mockUser]}
        departments={[mockDepartment]}
        selectedMonth={selectedMonth}
        today={today}
        approvedOvertime={[]}
        approvedLeaveRequests={[approvedLeaveConflict]}
        calendarEvents={[]}
      />,
    );

    // Do ngày 28/10 đã tính vào actualDays = 20, paidLeaveDays bị loại trừ không cộng dồn (paidLeaveDays = 0)
    // paidDays phải bằng đúng 20 (nếu bị lỗi cộng trùng double-counting thì paidDays sẽ bị vọt lên 21)
    expect(screen.getAllByText(/20 \/ 22/).length).toBeGreaterThan(0);
    // Không hiển thị chú thích cộng ngày phép vì paidLeaveDays = 0
    expect(screen.queryByText('(20 làm + 1 phép)')).toBeNull();
  });
});
