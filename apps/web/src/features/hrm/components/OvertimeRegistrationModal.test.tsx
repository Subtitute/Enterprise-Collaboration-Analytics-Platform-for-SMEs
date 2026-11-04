// 04/11/2026: kiem tra trung gio hanh chinh phai theo lich lam viec cua cong ty, khong co dinh 08:30 - 17:30.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OvertimeRegistrationModal } from './OvertimeRegistrationModal';

const mocks = vi.hoisted(() => ({ schedule: undefined as unknown, mutate: vi.fn() }));
vi.mock('../hooks', () => ({
  useWorkScheduleQuery: () => ({ data: mocks.schedule }),
  useCreateOvertimeRequest: () => ({ mutate: mocks.mutate, isPending: false }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: { start?: string; end?: string }) => (params?.start ? `${key}|${params.start}-${params.end}` : key),
  }),
}));

const OVERLAP = 'hrm:extensions.overtime.errors.overlapOfficeHours';

function submit() {
  render(<OvertimeRegistrationModal userId="u-1" open onClose={() => {}} />);
  fireEvent.change(screen.getByLabelText(/reasonLabel/), { target: { value: 'Chốt số liệu' } });
  fireEvent.click(screen.getByRole('button', { name: 'hrm:extensions.overtime.submitButton' }));
}

describe('OvertimeRegistrationModal theo lich lam viec', () => {
  beforeEach(() => {
    mocks.mutate.mockClear();
  });

  it('chua co lich: giu moc 08:30 - 17:30, khung mac dinh 18:00 - 20:00 gui duoc', () => {
    mocks.schedule = undefined;
    submit();
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
  });

  it('ca lam toi 19:00: khung 18:00 - 20:00 bi chan, thong bao dung gio cua lich', () => {
    mocks.schedule = { workStart: '10:00', workEnd: '19:00' };
    submit();
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(screen.getByText(`${OVERLAP}|10:00-19:00`)).toBeInTheDocument();
  });
});
