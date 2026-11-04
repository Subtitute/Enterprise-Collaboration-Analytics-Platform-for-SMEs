// 04/11/2026: form don nghi gui leaveType rieng (khong ghep tien to vao reason), lay so ngay lam viec tu lich cong ty.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NewLeaveRequestModal } from './NewLeaveRequestModal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key),
  }),
}));
vi.mock('@/lib/api-client', () => ({ extractErrorMessage: () => 'loi-may-chu' }));

// DatePicker/CustomFilterSelect la bo chon tuy bien - thay bang input/select don gian de dieu khien trong test.
vi.mock('@/components/ui/DatePicker', () => ({
  DatePicker: ({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) => (
    <input aria-label={id} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock('@/components/ui/CustomFilterSelect', () => ({
  CustomFilterSelect: ({
    value,
    options,
    onChange,
  }: {
    value: string;
    options: { value: string; label: string }[];
    onChange: (v: string) => void;
  }) => (
    <select aria-label="leave-type" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

const mockMutate = vi.fn();
const mockWorkingDays = vi.fn();
const mockBalance = vi.fn();
vi.mock('../hooks', () => ({
  useCreateLeaveRequest: () => ({ mutate: mockMutate, isPending: false }),
  useWorkingDaysQuery: (s: string, e: string) => mockWorkingDays(s, e),
  useMyLeaveBalanceQuery: () => mockBalance(),
}));

describe('NewLeaveRequestModal - loại nghỉ và số ngày làm việc từ máy chủ', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkingDays.mockReturnValue({ data: { workingDays: 3, holidays: [] } });
    mockBalance.mockReturnValue({ data: { remainingDays: 10 } });
  });

  function fill(type?: string) {
    render(<NewLeaveRequestModal open onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('leave-start-date'), { target: { value: '2099-01-05' } });
    fireEvent.change(screen.getByLabelText('leave-end-date'), { target: { value: '2099-01-07' } });
    if (type) fireEvent.change(screen.getByLabelText('leave-type'), { target: { value: type } });
    fireEvent.change(document.getElementById('leave-reason') as HTMLElement, { target: { value: 'Ốm nằm viện' } });
    fireEvent.click(screen.getByText('hrm:newLeaveRequestModal.submitButton'));
  }

  it('Case 1: gửi leaveType riêng, lý do không có tiền tố [SICK]', () => {
    fill('SICK');
    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate.mock.calls[0][0]).toEqual({
      startDate: '2099-01-05',
      endDate: '2099-01-07',
      reason: 'Ốm nằm viện',
      leaveType: 'SICK',
    });
  });

  it('Case 2: mặc định phép năm (ANNUAL) và hiện số ngày làm việc + số phép còn lại', () => {
    fill();
    expect(mockMutate.mock.calls[0][0].leaveType).toBe('ANNUAL');
    expect(screen.getByText(/"count":3/)).toBeInTheDocument();
    expect(screen.getByText(/hrm:newLeaveRequestModal.remainingHint \{"remaining":10\}/)).toBeInTheDocument();
  });

  it('Case 3: số ngày vượt phép còn lại thì cảnh báo, lỗi máy chủ (LEAVE_*) hiện ngay dưới ô lý do', async () => {
    mockWorkingDays.mockReturnValue({ data: { workingDays: 12, holidays: [] } });
    fill();
    expect(screen.getByText(/hrm:newLeaveRequestModal.exceedsBalance/)).toBeInTheDocument();

    const { act } = await import('@testing-library/react');
    act(() => mockMutate.mock.calls[0][1].onError(new Error('x')));
    expect(await screen.findByText('loi-may-chu')).toBeInTheDocument();
  });
});
