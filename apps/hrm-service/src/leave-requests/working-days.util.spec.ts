import { countWorkingDaysInclusive } from './working-days.util';

describe('countWorkingDaysInclusive', () => {
  it('dem dung 5 ngay lam viec cho 1 tuan tron (Thu 2 -> Thu 6)', () => {
    // 02/06/2025 la Thu Hai, 06/06/2025 la Thu Sau.
    expect(countWorkingDaysInclusive('2025-06-02', '2025-06-06')).toBe(5);
  });

  it('loai tru Thu 7/Chu Nhat khoi khoang tinh', () => {
    // 30/05/2025 (T6) -> 08/06/2025 (CN ke tiep): T6(30) + T7,CN(31,01 loai) + T2-T6(02-06) + T7,CN(07,08 loai) = 1 + 5 = 6 ngay lam viec.
    expect(countWorkingDaysInclusive('2025-05-30', '2025-06-08')).toBe(6);
  });

  it('tra ve 0 khi ca khoang chi roi vao cuoi tuan', () => {
    // 31/05/2025 la Thu Bay, 01/06/2025 la Chu Nhat.
    expect(countWorkingDaysInclusive('2025-05-31', '2025-06-01')).toBe(0);
  });

  it('tra ve 1 khi start = end va la ngay lam viec', () => {
    expect(countWorkingDaysInclusive('2025-06-02', '2025-06-02')).toBe(1);
  });

  it('tra ve 0 khi start sau end (khoang khong hop le)', () => {
    expect(countWorkingDaysInclusive('2025-06-06', '2025-06-02')).toBe(0);
  });
});
