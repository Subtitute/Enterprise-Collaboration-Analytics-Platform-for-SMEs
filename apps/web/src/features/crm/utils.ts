import type { BadgeVariant } from '@/components/ui/Badge';
import type { DealStage } from '@/types';

export function dealStageBadgeVariant(stage: DealStage): BadgeVariant {
  switch (stage) {
    case 'WON':
      return 'success';
    case 'LOST':
      return 'danger';
    case 'NEGOTIATION':
      return 'warning';
    default:
      return 'info';
  }
}

/** Dinh dang gia tri deal thanh chuoi tien te VND (khong dung Intl.NumberFormat truc tiep o
 *  moi noi de de doi dinh dang tap trung 1 cho neu can sau nay). */
export function formatDealValue(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return `${new Intl.NumberFormat('vi-VN').format(value)} VND`;
}
