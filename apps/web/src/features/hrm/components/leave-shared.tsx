import type { LeaveRequestStatus } from '@/types';

export function LeaveTypeBadge({ rawType, label }: { rawType: string | null; label: string | null }) {
  if (!label) return null;
  // §4 Badge loại nghỉ: h22, padding 2x8, radius 2 (rounded-[2px]), font 11/600, dot 4px cùng màu chữ
  // ANNUAL: accent-soft #E4EFEE, accent #0E5E5E
  // SICK: warning-soft #FBEEE0, warning #B45309
  // UNPAID: bg-subtle #FAF9F6, text-secondary #5C5A55
  let bgClass = 'bg-[#FAF9F6] text-[#5C5A55]';
  let dotClass = 'bg-[#5C5A55]';

  const typeUpper = (rawType || '').toUpperCase();
  if (typeUpper === 'ANNUAL' || label.includes('năm') || label.includes('Annual') || label.includes('有給')) {
    bgClass = 'bg-[#E4EFEE] text-[#0E5E5E]';
    dotClass = 'bg-[#0E5E5E]';
  } else if (typeUpper === 'SICK' || label.includes('ốm') || label.includes('Sick') || label.includes('病気')) {
    bgClass = 'bg-[#FBEEE0] text-[#B45309]';
    dotClass = 'bg-[#B45309]';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[2px] text-[11px] font-semibold shrink-0 ${bgClass}`}>
      <span className={`h-1 w-1 rounded-full shrink-0 ${dotClass}`} />
      <span>{label}</span>
    </span>
  );
}

export function LeaveStatusBadge({ status, label }: { status: LeaveRequestStatus; label: string }) {
  // §5 Badge trạng thái: h22, padding 2x8, radius 2, font 11/600
  // APPROVED: success-soft #E6F1E9, success #2F6F44
  // REJECTED: error-soft #F8E5E3, error #B3261E
  // PENDING: info-soft #E4EEF5, info #1E5A8A
  let styleClass = 'bg-[#E4EEF5] text-[#1E5A8A]';
  if (status === 'APPROVED') {
    styleClass = 'bg-[#E6F1E9] text-[#2F6F44]';
  } else if (status === 'REJECTED') {
    styleClass = 'bg-[#F8E5E3] text-[#B3261E]';
  }

  return (
    <span className={`inline-flex items-center justify-center h-[22px] px-2 rounded-[2px] text-[11px] font-semibold shrink-0 ${styleClass}`}>
      {label}
    </span>
  );
}

/** Tách loại nghỉ phép và lý do thực tế từ chuỗi reason đã lưu (hỗ trợ cả key enum ANNUAL/SICK/UNPAID và text cũ).
 *  03/10/2026: export de LeaveRequestDetailPage.tsx tai su dung (tranh chep lai y het logic nay). */
export function parseLeaveReason(rawReason: string | undefined | null, t: (key: string, options?: any) => string) {
  if (!rawReason) return { rawType: null, leaveType: null, cleanReason: '' };
  const match = rawReason.match(/^\[(.*?)\]\s*(.*)$/);
  if (match) {
    const rawType = match[1];
    // Nếu là mã type (ANNUAL, SICK, UNPAID)
    if (rawType === 'ANNUAL' || rawType === 'SICK' || rawType === 'UNPAID') {
      return {
        rawType,
        leaveType: t(`hrm:newLeaveRequestModal.types.${rawType}`),
        cleanReason: match[2],
      };
    }
    let translatedType = rawType;
    if (rawType.includes('Nghỉ phép năm') || rawType.includes('Annual leave') || rawType.includes('年次有給休暇')) {
      translatedType = t('hrm:newLeaveRequestModal.types.ANNUAL');
    } else if (rawType.includes('Nghỉ ốm') || rawType.includes('Sick leave') || rawType.includes('病気休暇')) {
      translatedType = t('hrm:newLeaveRequestModal.types.SICK');
    } else if (rawType.includes('Nghỉ việc riêng') || rawType.includes('Personal leave') || rawType.includes('私用休暇')) {
      translatedType = t('hrm:newLeaveRequestModal.types.UNPAID');
    }
    return {
      rawType,
      leaveType: translatedType,
      cleanReason: match[2],
    };
  }
  return {
    rawType: null,
    leaveType: null,
    cleanReason: rawReason,
  };
}

