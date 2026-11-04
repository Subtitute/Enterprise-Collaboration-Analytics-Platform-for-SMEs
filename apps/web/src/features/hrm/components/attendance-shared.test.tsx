// 04/11/2026: nhan Di muon trong Nhat ky/Lich su phai cung quy tac voi bang cong khi lich lam viec thay doi.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AttendanceStatusBadge } from './attendance-shared';

const scheduleMock = vi.hoisted(() => ({ data: undefined as unknown }));
vi.mock('../hooks', () => ({ useWorkScheduleQuery: () => ({ data: scheduleMock.data }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const LATE = 'hrm:attendancePage.statusBadge.late';
const ON_TIME = 'hrm:attendancePage.statusBadge.onTime';

function renderBadge(workDate: string, time: string) {
  render(
    <AttendanceStatusBadge
      record={{ workDate, checkInAt: `${workDate}T${time}:00+07:00`, checkOutAt: `${workDate}T17:30:00+07:00` }}
      today="2026-11-04"
    />,
  );
}

describe('AttendanceStatusBadge theo lich lam viec', () => {
  const base = { workingWeekdays: [1, 2, 3, 4, 5], workStart: '08:30', lateGraceMinutes: 0 };

  it('chua co lich: giu moc 08:30', () => {
    scheduleMock.data = undefined;
    renderBadge('2026-11-03', '08:31');
    expect(screen.getByText(LATE)).toBeInTheDocument();
  });

  it('dung moc khong tinh muon', () => {
    scheduleMock.data = base;
    renderBadge('2026-11-03', '08:30');
    expect(screen.getByText(ON_TIME)).toBeInTheDocument();
  });

  it('gia han 15 phut: 08:45 chua muon, 08:46 muon', () => {
    scheduleMock.data = { ...base, lateGraceMinutes: 15 };
    renderBadge('2026-11-03', '08:45');
    expect(screen.getByText(ON_TIME)).toBeInTheDocument();
    renderBadge('2026-11-03', '08:46');
    expect(screen.getByText(LATE)).toBeInTheDocument();
  });

  it('doi gio vao 09:00: 08:45 khong muon', () => {
    scheduleMock.data = { ...base, workStart: '09:00' };
    renderBadge('2026-11-03', '08:45');
    expect(screen.getByText(ON_TIME)).toBeInTheDocument();
  });

  it('ngay nghi tuan khong tinh muon, Thu 7 thanh ngay lam thi co', () => {
    scheduleMock.data = base;
    renderBadge('2026-11-07', '10:00');
    expect(screen.getByText(ON_TIME)).toBeInTheDocument();
    scheduleMock.data = { ...base, workingWeekdays: [1, 2, 3, 4, 5, 6] };
    renderBadge('2026-11-07', '10:00');
    expect(screen.getByText(LATE)).toBeInTheDocument();
  });
});
