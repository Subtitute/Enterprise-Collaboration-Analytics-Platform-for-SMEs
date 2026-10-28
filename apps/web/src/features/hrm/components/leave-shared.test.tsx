// 27/10/2026 - Bổ sung unit test cho Việc 5.1 & 5.2
import { describe, it, expect, vi } from 'vitest';
import { parseLeaveReason, LeaveStatusBadge, LeaveTypeBadge } from './leave-shared';
import { render, screen } from '@testing-library/react';

describe('leave-shared - Utility và Component nghỉ phép', () => {
  const mockT = (key: string, options?: any) => {
    if (key === 'hrm:newLeaveRequestModal.types.ANNUAL') return 'Nghỉ phép năm';
    if (key === 'hrm:newLeaveRequestModal.types.SICK') return 'Nghỉ ốm';
    if (key === 'hrm:newLeaveRequestModal.types.UNPAID') return 'Nghỉ không lương';
    return key;
  };

  it('1. parseLeaveReason: tách đúng [ANNUAL] và lý do thực tế', () => {
    const res = parseLeaveReason('[ANNUAL] Nghỉ phép đi du lịch cùng gia đình', mockT);
    expect(res.rawType).toBe('ANNUAL');
    expect(res.leaveType).toBe('Nghỉ phép năm');
    expect(res.cleanReason).toBe('Nghỉ phép đi du lịch cùng gia đình');
  });

  it('2. parseLeaveReason: tách đúng [SICK] và lý do thực tế', () => {
    const res = parseLeaveReason('[SICK] Sốt xuất huyết nằm viện', mockT);
    expect(res.rawType).toBe('SICK');
    expect(res.leaveType).toBe('Nghỉ ốm');
    expect(res.cleanReason).toBe('Sốt xuất huyết nằm viện');
  });

  it('3. parseLeaveReason: tách đúng [UNPAID] và lý do thực tế', () => {
    const res = parseLeaveReason('[UNPAID] Giải quyết việc cá nhân', mockT);
    expect(res.rawType).toBe('UNPAID');
    expect(res.leaveType).toBe('Nghỉ không lương');
    expect(res.cleanReason).toBe('Giải quyết việc cá nhân');
  });

  it('4. parseLeaveReason: xử lý chuỗi không có mã loại [TYPE] ở đầu', () => {
    const res = parseLeaveReason('Đi công tác đột xuất', mockT);
    expect(res.rawType).toBeNull();
    expect(res.leaveType).toBeNull();
    expect(res.cleanReason).toBe('Đi công tác đột xuất');
  });

  it('5. parseLeaveReason: xử lý an toàn khi giá trị null hoặc undefined', () => {
    expect(parseLeaveReason(null, mockT)).toEqual({ rawType: null, leaveType: null, cleanReason: '' });
    expect(parseLeaveReason(undefined, mockT)).toEqual({ rawType: null, leaveType: null, cleanReason: '' });
  });

  it('6. LeaveStatusBadge: render đúng label trạng thái APPROVED, REJECTED, PENDING', () => {
    const { rerender } = render(<LeaveStatusBadge status="APPROVED" label="Đã duyệt" />);
    expect(screen.getByText('Đã duyệt')).toBeInTheDocument();

    rerender(<LeaveStatusBadge status="REJECTED" label="Từ chối" />);
    expect(screen.getByText('Từ chối')).toBeInTheDocument();

    rerender(<LeaveStatusBadge status="PENDING" label="Chờ duyệt" />);
    expect(screen.getByText('Chờ duyệt')).toBeInTheDocument();
  });

  it('7. LeaveTypeBadge: render đúng badge loại nghỉ phép ANNUAL, SICK, UNPAID', () => {
    const { rerender } = render(<LeaveTypeBadge rawType="ANNUAL" label="Nghỉ phép năm" />);
    expect(screen.getByText('Nghỉ phép năm')).toBeInTheDocument();

    rerender(<LeaveTypeBadge rawType="SICK" label="Nghỉ ốm" />);
    expect(screen.getByText('Nghỉ ốm')).toBeInTheDocument();

    rerender(<LeaveTypeBadge rawType="UNPAID" label="Nghỉ không lương" />);
    expect(screen.getByText('Nghỉ không lương')).toBeInTheDocument();

    rerender(<LeaveTypeBadge rawType={null} label={null} />);
    expect(screen.queryByText('Nghỉ không lương')).not.toBeInTheDocument();
  });
});

