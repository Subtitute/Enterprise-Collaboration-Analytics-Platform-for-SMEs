import { getTodayGmt7DateString, removeVietnameseTones } from '@/lib/utils';

// 03/10/2026: bo phat hien "y dinh xin nghi phep" trong noi dung chat - pham vi da thong nhat voi
// chu nhiem de tai la mot bo regex rong, dua tren luat (KHONG phai model ML/NLP), chap nhan la
// "fuzzy" (co the co duong, co sot) mien la bao phu tot cac mau cau liet ke trong de bai. Chuan hoa
// TOAN BO van ban qua removeVietnameseTones() (lib/utils.ts - vua ha chu thuong vua bo dau) TRUOC
// khi so khop, roi chi viet regex o dang khong dau - cach nay tu dong "khoan dung thieu dau tieng
// Viet" (vd "ngày mai" va "ngay mai" cung khop 1 pattern duy nhat) ma khong can nhan doi moi pattern
// thanh 2 bien the (co dau / khong dau).
//
// Han che da biet (chap nhan duoc trong pham vi "fuzzy", khong co ML that su phan biet ngu nghia):
// - "mai" dung doc lap co the trung ten rieng (vd "Mai oi, ...") - se bi nhan nham la "ngay mai".
// - "thu tu" (thu tu/trinh tu) va "Thứ Tư" (ngay trong tuan) trung nhau sau khi bo dau.

export interface LeaveIntentMatch {
  /** Ngay duoc suy ra, dang 'YYYY-MM-DD', theo lich GMT+7. */
  resolvedDate: string;
}

const ABSOLUTE_DATE_RE = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;
const NGAY_THANG_NAM_RE = /\bngay\s+(\d{1,2})\s+thang\s+(\d{1,2})(?:\s+nam\s+(\d{4}))?\b/;

const HOM_NAY_RE = /\bhom\s*nay\b/;
const NGAY_MOT_RE = /\bngay\s*mot\b/;
const NGAY_KIA_RE = /\bngay\s*kia\b/;
// "ngay mai" HOAC "mai" dung mot minh (\b dam bao khong khop vao giua 1 tu khac).
const NGAY_MAI_RE = /\b(?:ngay\s*)?mai\b/;

const WEEKDAY_RE = /\b(?:thu\s*(hai|ba|tu|nam|sau|bay)|chu\s*nhat)\b(?:\s*(tuan\s*(nay|sau|toi)))?/;
const WEEKDAY_TO_JS_DOW: Record<string, number> = { hai: 1, ba: 2, tu: 3, nam: 4, sau: 5, bay: 6 };

const RELATIVE_OFFSET_RE = /\b(\d+)\s*(ngay|tuan)\s*(?:nua|toi|sau)\b/;

const HOUR_SUFFIX_RE = /\b\d{1,2}h\b/; // vd "2h"
const GIO_RE = /\b\d{1,2}\s*gio\b/; // vd "14 gio"
const CLOCK_RE = /\b([01]?\d|2[0-3]):[0-5]\d\b/; // vd "14:30"
const TIENG_RE = /\b\d{1,2}\s*tieng\b/; // vd "2 tieng"
const PHUT_RE = /\b\d{1,3}\s*phut\b/; // vd "30 phut"

function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatIsoDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(iso: string, days: number): string {
  const d = parseIsoDateLocal(iso);
  d.setDate(d.getDate() + days);
  return formatIsoDateLocal(d);
}

/** Dung Date object de kiem tra (nam, thang, ngay) co "tran" thanh 1 ngay khac khong (vd 31/02)
 *  truoc khi chap nhan - mirror dung cach DatePicker.tsx dang lam voi input go tay. */
function toValidIsoOrUndefined(year: number, month1to12: number, day: number): string | undefined {
  const d = new Date(year, month1to12 - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month1to12 - 1 || d.getDate() !== day) return undefined;
  return formatIsoDateLocal(d);
}

function resolveAbsoluteDate(text: string, todayIso: string): string | undefined {
  const m = ABSOLUTE_DATE_RE.exec(text);
  if (!m) return undefined;
  const day = Number(m[1]);
  const month = Number(m[2]);
  // 03/10/2026: khong ghi nam (vd "15/10") - mac dinh lay nam HIEN TAI, khong tu dong day sang nam
  // sau du ngay do co the da qua trong nam nay. Don gian hoa co chu dich: cho phep nguoi dung tu
  // sua lai o o ngay (van con "editable" theo dung yeu cau) neu suy luan mac dinh nay sai.
  let year = Number(todayIso.slice(0, 4));
  if (m[3]) {
    year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  }
  return toValidIsoOrUndefined(year, month, day);
}

function resolveNgayThangNam(text: string, todayIso: string): string | undefined {
  const m = NGAY_THANG_NAM_RE.exec(text);
  if (!m) return undefined;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = m[3] ? Number(m[3]) : Number(todayIso.slice(0, 4));
  return toValidIsoOrUndefined(year, month, day);
}

function resolveRelativeDayWord(text: string, todayIso: string): string | undefined {
  if (HOM_NAY_RE.test(text)) return todayIso;
  if (NGAY_MOT_RE.test(text) || NGAY_KIA_RE.test(text)) return addDays(todayIso, 2);
  if (NGAY_MAI_RE.test(text)) return addDays(todayIso, 1);
  return undefined;
}

function resolveWeekday(text: string, todayIso: string): string | undefined {
  const m = WEEKDAY_RE.exec(text);
  if (!m) return undefined;
  const targetDow = m[1] ? WEEKDAY_TO_JS_DOW[m[1]] : 0; // khong co nhom 1 -> da khop nhanh "chu nhat" (Chu Nhat = 0)
  const weekQualifier = m[2]; // "tuan nay" | "tuan sau" | "tuan toi" | undefined
  const todayDow = parseIsoDateLocal(todayIso).getDay();

  if (weekQualifier) {
    // Tinh Thu Hai cua TUAN NAY (co the la hom nay neu hom nay da la Thu Hai), roi cong them so
    // ngay tu Thu Hai den thu can tim; "tuan sau"/"tuan toi" cong them đúng 7 ngay nua.
    const mondayOffset = (todayDow + 6) % 7;
    const weekdayFromMonday = (targetDow + 6) % 7;
    const extraWeek = weekQualifier.includes('nay') ? 0 : 7;
    return addDays(todayIso, -mondayOffset + extraWeek + weekdayFromMonday);
  }

  // Khong noi ro "tuan nay/sau/toi" - mac dinh la LAN XAY RA GAN NHAT sap toi (hom nay duoc tinh
  // la hop le neu dung la thu dang hoi, vi nguoi dung thuong noi "thu Ba" dung vao thu Ba voi y la
  // HOM NAY).
  const diff = (targetDow - todayDow + 7) % 7;
  return addDays(todayIso, diff);
}

function resolveRelativeOffset(text: string, todayIso: string): string | undefined {
  const m = RELATIVE_OFFSET_RE.exec(text);
  if (!m) return undefined;
  const amount = Number(m[1]);
  const days = m[2] === 'tuan' ? amount * 7 : amount;
  return addDays(todayIso, days);
}

function hasTimeOrDurationMatch(text: string): boolean {
  return HOUR_SUFFIX_RE.test(text) || GIO_RE.test(text) || CLOCK_RE.test(text) || TIENG_RE.test(text) || PHUT_RE.test(text);
}

/**
 * Do tim 1 "y dinh xin nghi phep" trong noi dung tin nhan chat (ngay/gio/khoang thoi gian duoc
 * nhac den theo kieu noi chuyen tieng Viet). Tra ve null neu khong khop pattern nao. `todayGmt7`
 * mac dinh lay tu getTodayGmt7DateString() (lib/utils.ts) - cho phep truyen tay o unit test de ket
 * qua tat dinh, khong phu thuoc ngay chay test that su.
 */
export function detectLeaveIntent(rawText: string, todayGmt7: string = getTodayGmt7DateString()): LeaveIntentMatch | null {
  if (!rawText || !rawText.trim()) return null;
  const text = removeVietnameseTones(rawText);

  const resolvedDate =
    resolveAbsoluteDate(text, todayGmt7) ??
    resolveNgayThangNam(text, todayGmt7) ??
    resolveRelativeDayWord(text, todayGmt7) ??
    resolveWeekday(text, todayGmt7) ??
    resolveRelativeOffset(text, todayGmt7);

  if (resolvedDate) return { resolvedDate };
  // Chi khop gio/khoang thoi gian (khong co ngay cu the nao) - mac dinh la HOM NAY.
  if (hasTimeOrDurationMatch(text)) return { resolvedDate: todayGmt7 };
  return null;
}
