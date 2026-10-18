// 16/10/2026: Inventory Service - vai ham dinh dang/tien ich nho dung chung giua ProductsPage.tsx,
// WarehousePage.tsx va cac component con, mirror features/crm/utils.ts (formatDealValue).
import type { BadgeVariant } from '@/components/ui/Badge';
import type { StockMovementType } from '@/types';

/** Dinh dang gia tien/gia tri VND - mirror formatDealValue() (features/crm/utils.ts). */
export function formatVnd(value?: number | null): string {
  const n = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);
}

export function stockMovementTypeBadgeVariant(type: StockMovementType): BadgeVariant {
  switch (type) {
    case 'IN':
      return 'success';
    case 'OUT':
      return 'danger';
    default:
      return 'warning';
  }
}
