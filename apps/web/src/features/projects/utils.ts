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

// 26/08/2026: gom nhan hien thi do uu tien (label + mau) ve chung 1 ham o day - truoc do
// ProjectCard.tsx va ProjectDetailPage.tsx moi noi tu khai bao 1 object y het nhau (phat hien qua
// check-hardcoded-vietnamese.js: ca 2 file cung con nguyen 4 chuoi tieng Viet co dau chua qua t()),
// sua rieng le tung file de sot 1 ban hoac lam 2 ban lech nhau ve sau. Dua ve 1 ham dung chung,
// cung pattern voi projectStatusMeta() o tren (dung tham chieu t khong-qua-hook vi day la ham
// module-level, khong the goi useTranslation()).
export function projectPriorityMeta(priority: string): { label: string; color: string } {
  switch (priority) {
    case 'LOW':
      return { label: t('projects:priority.LOW'), color: 'text-slate-600 bg-slate-50 border-slate-200' };
    case 'HIGH':
      return { label: t('projects:priority.HIGH'), color: 'text-amber-700 bg-amber-50 border-amber-200' };
    case 'URGENT':
      return { label: t('projects:priority.URGENT'), color: 'text-rose-700 bg-rose-50 border-rose-200' };
    case 'MEDIUM':
    default:
      return { label: t('projects:priority.MEDIUM'), color: 'text-blue-700 bg-blue-50 border-blue-200' };
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

// 22/09/2026: getProjectMemberIds()/addProjectMember()/removeProjectMember() (localStorage-only,
// khong dong bo giua trinh duyet/thiet bi) va notifyTaskCompleted() (localStorage-only, khong the
// toi session cua Manager tren thiet bi khac) da bi XOA khoi day - thay bang du lieu server-side
// that: ProjectMember (xem features/projects/api.ts fetchProjectMembers()/hooks.ts
// useProjectMembersQuery(), goi that qua GET/POST/DELETE /projects/:id/members) va thong bao "Task
// Done" gio duoc Project-Task Service tu dong phat qua Kafka -> Notification Service ngay khi
// TasksService.updateStatus() chuyen mot Task sang DONE (xem event-notification-builder.ts, khong
// can frontend tu goi gi them).

