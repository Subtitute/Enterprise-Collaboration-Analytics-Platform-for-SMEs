import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { FaceStatus } from '@/types';

const STYLES: Record<FaceStatus, string> = {
  ACTIVE: 'bg-success-soft text-success border-success/20',
  PENDING_CONSENT: 'bg-warning-soft text-warning border-warning/30',
  NONE: 'bg-bg-subtle text-text-tertiary border-border-subtle',
  WITHDRAWN: 'bg-error-soft text-error border-error/20',
};

/** 26/10/2026: cot "Anh nhan dien" chi la TRANG THAI - khong bao gio hien anh trong danh sach (Wireframe 16.1). */
export function FaceStatusBadge({ status, className }: { status?: FaceStatus; className?: string }) {
  const { t } = useTranslation();
  if (!status) return <span className="text-[12px] text-text-tertiary">—</span>;
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-radius-sm border px-2 py-0.5 text-[12px] font-medium', STYLES[status], className)}>
      {t(`hrm:face.status.${status}`)}
    </span>
  );
}
