import type { BadgeVariant } from '@/components/ui/Badge';
import type { Task } from '@/types';
// `projectStatusMeta` la ham NGOAI component (module-level) - khong the goi useTranslation()
// (vi pham Rules of Hooks). Dung tham chieu `t` khong-qua-hook tu i18n/index.ts, cung pattern voi
// statusLabel() o features/dashboard/components/TaskStatusDonut.tsx.
import { t } from '@/i18n';

export function projectStatusMeta(status: string): { label: string; variant: BadgeVariant } {
  switch (status) {
    case 'ACTIVE':
      return { label: t('projects:enums.projectStatus.ACTIVE'), variant: 'info' };
    case 'COMPLETED':
      return { label: t('projects:enums.projectStatus.COMPLETED'), variant: 'success' };
    case 'ARCHIVED':
      return { label: t('projects:enums.projectStatus.ARCHIVED'), variant: 'outline' };
    default:
      return { label: t(`projects:enums.projectStatus.${status}`, { defaultValue: status }), variant: 'default' };
  }
}

/** Tinh % tien do tu danh sach cong viec khi backend chua tra ve san truong progress. */
export function computeProgressFromTasks(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((task) => task.status === 'DONE').length;
  return Math.round((done / tasks.length) * 100);
}

export function isOverdue(dueDate?: string | null, status?: string): boolean {
  if (!dueDate || status === 'DONE') return false;
  return new Date(dueDate).getTime() < Date.now();
}
