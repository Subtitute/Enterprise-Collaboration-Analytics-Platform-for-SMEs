import type { BadgeVariant } from '@/components/ui/Badge';
import type { Task } from '@/types';

export function projectStatusMeta(status: string): { label: string; variant: BadgeVariant } {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Đang hoạt động', variant: 'info' };
    case 'COMPLETED':
      return { label: 'Hoàn thành', variant: 'success' };
    case 'ARCHIVED':
      return { label: 'Lưu trữ', variant: 'outline' };
    default:
      return { label: status, variant: 'default' };
  }
}

/** Tinh % tien do tu danh sach cong viec khi backend chua tra ve san truong progress. */
export function computeProgressFromTasks(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.status === 'DONE').length;
  return Math.round((done / tasks.length) * 100);
}

export function isOverdue(dueDate?: string | null, status?: string): boolean {
  if (!dueDate || status === 'DONE') return false;
  return new Date(dueDate).getTime() < Date.now();
}
