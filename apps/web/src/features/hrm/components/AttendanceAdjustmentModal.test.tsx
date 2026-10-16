import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AttendanceAdjustmentModal } from './AttendanceAdjustmentModal';
import type { Attendance } from '@/types';

// Mock hook useCreateAttendanceAdjustment
const mockMutate = vi.fn();
vi.mock('../hooks', () => ({
  useCreateAttendanceAdjustment: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

// Mock translations
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('AttendanceAdjustmentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const baseRecord: Attendance = {
    id: 'att-123',
    userId: 'user-1',
    workDate: '2026-10-10',
    checkInAt: '2026-10-10T08:30:00+07:00',
    checkOutAt: '2026-10-10T17:30:00+07:00',
    createdAt: '2026-10-10T08:30:00Z',
    updatedAt: '2026-10-10T17:30:00Z',
  };

  it('blocks submission when check-out time is before or equal to check-in time (invalidRange)', () => {
    render(
      <AttendanceAdjustmentModal
        record={baseRecord}
        open={true}
        onClose={vi.fn()}
      />,
    );

    const inInput = document.getElementById('adj-in-time') as HTMLInputElement;
    const outInput = document.getElementById('adj-out-time') as HTMLInputElement;
    const reasonInput = document.getElementById('adj-reason') as HTMLTextAreaElement;

    // Giờ vào: 09:00, Giờ ra: 08:00 (ra trước vào)
    fireEvent.change(inInput, { target: { value: '09:00' } });
    fireEvent.change(outInput, { target: { value: '08:00' } });
    fireEvent.change(reasonInput, { target: { value: 'Đi gặp khách hàng' } });

    fireEvent.submit(reasonInput.closest('form')!);

    expect(mockMutate).not.toHaveBeenCalled();
    expect(
      screen.getByText('hrm:extensions.adjustment.errors.invalidRange'),
    ).toBeInTheDocument();
  });

  it('blocks submission when time is in the future for today record (futureTime)', () => {
    // Mock thời điểm hiện tại: 2026-10-16 14:00 (GMT+7)
    const fakeNow = new Date('2026-10-16T14:00:00+07:00');
    vi.useFakeTimers();
    vi.setSystemTime(fakeNow);

    const todayRecord: Attendance = {
      ...baseRecord,
      id: 'att-today',
      workDate: '2026-10-16',
      checkInAt: '2026-10-16T08:30:00+07:00',
      checkOutAt: null,
    };

    render(
      <AttendanceAdjustmentModal
        record={todayRecord}
        open={true}
        onClose={vi.fn()}
      />,
    );

    const inInput = document.getElementById('adj-in-time') as HTMLInputElement;
    const outInput = document.getElementById('adj-out-time') as HTMLInputElement;
    const reasonInput = document.getElementById('adj-reason') as HTMLTextAreaElement;

    // Chọn giờ ra là 17:30 trong khi hiện tại mới 14:00
    fireEvent.change(inInput, { target: { value: '08:30' } });
    fireEvent.change(outInput, { target: { value: '17:30' } });
    fireEvent.change(reasonInput, { target: { value: 'Quên chấm công chiều' } });

    fireEvent.submit(reasonInput.closest('form')!);

    expect(mockMutate).not.toHaveBeenCalled();
    expect(
      screen.getByText('hrm:extensions.adjustment.errors.futureTime'),
    ).toBeInTheDocument();
  });

  it('resets form state when record prop changes', () => {
    const { rerender } = render(
      <AttendanceAdjustmentModal
        record={baseRecord}
        open={true}
        onClose={vi.fn()}
      />,
    );

    const reasonInput = document.getElementById('adj-reason') as HTMLTextAreaElement;
    fireEvent.change(reasonInput, { target: { value: 'Lý do nháp' } });
    expect(reasonInput.value).toBe('Lý do nháp');

    const nextRecord: Attendance = {
      ...baseRecord,
      id: 'att-456',
      workDate: '2026-10-11',
      checkInAt: '2026-10-11T09:15:00+07:00',
      checkOutAt: '2026-10-11T18:15:00+07:00',
    };

    rerender(
      <AttendanceAdjustmentModal
        record={nextRecord}
        open={true}
        onClose={vi.fn()}
      />,
    );

    const inInput = document.getElementById('adj-in-time') as HTMLInputElement;
    const outInput = document.getElementById('adj-out-time') as HTMLInputElement;
    const updatedReasonInput = document.getElementById('adj-reason') as HTMLTextAreaElement;

    expect(inInput.value).toBe('09:15');
    expect(outInput.value).toBe('18:15');
    expect(updatedReasonInput.value).toBe('');
  });

  it('submits payload with exact format YYYY-MM-DDTHH:mm:00+07:00 and attendanceId', () => {
    // Ngày 12/10/2026 (trong vòng 7 ngày so với hiện tại)
    const fakeNow = new Date('2026-10-16T10:00:00+07:00');
    vi.useFakeTimers();
    vi.setSystemTime(fakeNow);

    const record: Attendance = {
      ...baseRecord,
      id: 'att-valid-1',
      workDate: '2026-10-12',
      checkInAt: '2026-10-12T08:30:00+07:00',
      checkOutAt: '2026-10-12T17:30:00+07:00',
    };

    render(
      <AttendanceAdjustmentModal
        record={record}
        open={true}
        onClose={vi.fn()}
      />,
    );

    const inInput = document.getElementById('adj-in-time') as HTMLInputElement;
    const outInput = document.getElementById('adj-out-time') as HTMLInputElement;
    const reasonInput = document.getElementById('adj-reason') as HTMLTextAreaElement;

    fireEvent.change(inInput, { target: { value: '08:45' } });
    fireEvent.change(outInput, { target: { value: '17:45' } });
    fireEvent.change(reasonInput, { target: { value: 'Họp đột xuất tại đối tác' } });

    fireEvent.submit(reasonInput.closest('form')!);

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith(
      {
        attendanceId: 'att-valid-1',
        proposedCheckInAt: '2026-10-12T08:45:00+07:00',
        proposedCheckOutAt: '2026-10-12T17:45:00+07:00',
        reason: 'Họp đột xuất tại đối tác',
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });
});

