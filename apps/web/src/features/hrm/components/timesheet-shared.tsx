import { useTranslation } from 'react-i18next';
import { TIMESHEET_SYMBOLS } from '@/types';
import type { TimesheetSymbol } from '@/types';

// 04/11/2026: ky hieu cong do may chu tra ve (X, Q, LN, P, OM, KL, L, V). Mau cung bo Badge phang cua
// leave-shared.tsx (nen soft + chu dam, radius 2px, khong pill).
const SYMBOL_STYLE: Record<TimesheetSymbol, string> = {
  X: 'bg-[#E6F1E9] text-[#2F6F44]',
  Q: 'bg-[#FBEEE0] text-[#B45309]',
  LN: 'bg-[#E4EEF5] text-[#1E5A8A]',
  P: 'bg-[#E4EFEE] text-[#0E5E5E]',
  OM: 'bg-[#FBEEE0] text-[#B45309]',
  KL: 'bg-[#FAF9F6] text-[#5C5A55]',
  L: 'bg-[#E4EEF5] text-[#1E5A8A]',
  V: 'bg-[#F8E5E3] text-[#B3261E]',
};

export function SymbolBadge({ symbol }: { symbol: TimesheetSymbol | null | undefined }) {
  const { t } = useTranslation();
  if (!symbol) return <span className="text-text-tertiary">—</span>;
  return (
    <span
      title={t(`hrm:timesheet.symbols.${symbol}`)}
      className={`inline-flex items-center justify-center h-[22px] min-w-[28px] px-1.5 rounded-[2px] text-[11px] font-semibold ${SYMBOL_STYLE[symbol] ?? SYMBOL_STYLE.KL}`}
    >
      {symbol}
    </span>
  );
}

/** Chu giai ky hieu: hien duoi bang cong de nguoi doc tra nghia nhanh. */
export function SymbolLegend() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-text-secondary">
      {TIMESHEET_SYMBOLS.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <SymbolBadge symbol={s} />
          <span>{t(`hrm:timesheet.symbols.${s}`)}</span>
        </span>
      ))}
    </div>
  );
}

/** Ten hien thi cua nguoi dung: thieu ten thi lui ve email, thieu ca hai thi nhan chung (khong bao gio rong/undefined). */
export function displayUserName(user: { fullName?: string | null; email?: string | null } | undefined, fallback: string): string {
  return user?.fullName?.trim() || user?.email?.trim() || fallback;
}
