import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  className?: string;
  trackClassName?: string;
  barClassName?: string;
  showLabel?: boolean;
}

export function ProgressBar({ value, className, trackClassName, barClassName, showLabel }: ProgressBarProps) {
  const { t } = useTranslation();
  const clamped = Math.max(0, Math.min(100, Math.round(value || 0)));
  return (
    <div
      // 28/07/2026: them role="progressbar" + aria-valuenow/min/max + aria-label (phat hien qua ra
      // soat kha nang tiep can) - truoc do thanh tien do chi la <div> thuan tuy, trinh doc man hinh
      // khong biet day la 1 thanh tien do hay gia tri hien tai la bao nhieu. Chua co prop nao mo ta
      // ngu canh cu the (vd "Tien do du an X") duoc truyen vao component nay o cac noi dang dung, nen
      // dung nhan chung "Tiến độ" lam gia tri du phong hop ly.
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={t('common:progress')}
      className={cn('flex items-center gap-2', className)}
    >
      <div className={cn('h-2 w-full flex-1 overflow-hidden rounded-full bg-slate-100', trackClassName)}>
        <div
          className={cn('h-full rounded-full bg-primary-500 transition-all', barClassName)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && <span className="w-9 shrink-0 text-right text-xs font-medium text-slate-500">{clamped}%</span>}
    </div>
  );
}
