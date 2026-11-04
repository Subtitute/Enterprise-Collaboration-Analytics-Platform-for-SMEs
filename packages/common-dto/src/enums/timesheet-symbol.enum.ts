/**
 * 04/11/2026: ky hieu 1 ngay tren bang cong thang. X di lam, Q thieu luot cham, LN di lam ngay nghi,
 * P phep nam, OM nghi om, KL nghi khong luong, L le, V vang. Gia tri chuoi duoc luu thang vao DB
 * (dong sua tay) va tra ra API nen khong doi ten.
 */
export enum TimesheetSymbol {
  X = 'X',
  Q = 'Q',
  LN = 'LN',
  P = 'P',
  OM = 'OM',
  KL = 'KL',
  L = 'L',
  V = 'V',
}

/** So cong tinh cho moi ky hieu. LN = 0 vi ngay nghi khong nam trong cong chuan cua thang. */
export const TIMESHEET_SYMBOL_VALUE: Record<TimesheetSymbol, number> = {
  [TimesheetSymbol.X]: 1,
  [TimesheetSymbol.Q]: 1,
  [TimesheetSymbol.LN]: 0,
  [TimesheetSymbol.P]: 1,
  [TimesheetSymbol.OM]: 1,
  [TimesheetSymbol.KL]: 0,
  [TimesheetSymbol.L]: 1,
  [TimesheetSymbol.V]: 0,
};
