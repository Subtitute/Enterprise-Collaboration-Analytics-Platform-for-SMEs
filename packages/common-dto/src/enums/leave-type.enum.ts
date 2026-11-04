/**
 * 04/11/2026: loai nghi phep tach khoi tien to trong `reason` (LeaveRequest.leaveType). LEAVE_TYPE_RULES
 * la nguon duy nhat cho 2 cau hoi "co tra luong khong" va "co tru so du phep nam khong", dung chung cho
 * kiem tra don nghi, so du phep va bang cong.
 */
export enum LeaveType {
  ANNUAL = 'ANNUAL',
  SICK = 'SICK',
  UNPAID = 'UNPAID',
}

export const LEAVE_TYPE_RULES: Record<LeaveType, { paid: boolean; deductsBalance: boolean }> = {
  [LeaveType.ANNUAL]: { paid: true, deductsBalance: true },
  [LeaveType.SICK]: { paid: true, deductsBalance: false },
  [LeaveType.UNPAID]: { paid: false, deductsBalance: false },
};
