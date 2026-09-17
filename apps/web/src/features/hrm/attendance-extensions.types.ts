export interface AttendanceAdjustment {
  id: string;
  attendanceId: string;
  userId: string;
  userName: string;
  workDate: string;
  originalCheckInAt: string;
  originalCheckOutAt?: string | null;
  proposedCheckInAt: string;
  proposedCheckOutAt: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
}

export interface OvertimeRegistration {
  id: string;
  userId: string;
  userName: string;
  workDate: string;
  otStart: string; // 'HH:mm'
  otEnd: string; // 'HH:mm'
  multiplier: number; // 1.5 | 2.0 | 3.0
  multiplierType: 'WEEKDAY' | 'WEEKEND' | 'HOLIDAY';
  reason: string;
  estimatedHours: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
}

const STORAGE_KEY_ADJUSTMENTS = 'ecap_attendance_adjustments';
const STORAGE_KEY_OT = 'ecap_attendance_overtime';

export function getStoredAdjustments(): AttendanceAdjustment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ADJUSTMENTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredAdjustments(items: AttendanceAdjustment[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_ADJUSTMENTS, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors
  }
}

export function getStoredOvertime(): OvertimeRegistration[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OT);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredOvertime(items: OvertimeRegistration[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_OT, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors
  }
}

