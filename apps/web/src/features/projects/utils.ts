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

const PROJECT_MEMBERS_STORAGE_PREFIX = 'ec_project_members_';

/** Lấy danh sách ID thành viên dự án (hợp nhất từ leadUserId, assignees của tasks và thành viên bổ sung được gán) */
export function getProjectMemberIds(projectId: string, leadUserId?: string | null, tasks?: Task[]): string[] {
  const memberSet = new Set<string>();
  if (leadUserId) memberSet.add(leadUserId);

  if (tasks && Array.isArray(tasks)) {
    for (const t of tasks) {
      if (t.assignees && Array.isArray(t.assignees)) {
        for (const a of t.assignees) {
          if (a.userId) memberSet.add(a.userId);
        }
      }
    }
  }

  try {
    const raw = localStorage.getItem(`${PROJECT_MEMBERS_STORAGE_PREFIX}${projectId}`);
    if (raw) {
      const parsed: string[] = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const id of parsed) memberSet.add(id);
      }
    }
  } catch {
    // Ignore storage parse error
  }

  return Array.from(memberSet);
}

/** Thêm thành viên vào danh sách thành viên trực tiếp của dự án */
export function addProjectMember(projectId: string, userId: string): void {
  try {
    const key = `${PROJECT_MEMBERS_STORAGE_PREFIX}${projectId}`;
    const raw = localStorage.getItem(key);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(userId)) {
      list.push(userId);
      localStorage.setItem(key, JSON.stringify(list));
      window.dispatchEvent(new Event('ec_projects_updated'));
    }
  } catch {
    // Ignore
  }
}

/** Gỡ thành viên khỏi dự án */
export function removeProjectMember(projectId: string, userId: string): void {
  try {
    const key = `${PROJECT_MEMBERS_STORAGE_PREFIX}${projectId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const list: string[] = JSON.parse(raw);
      const updated = list.filter((id) => id !== userId);
      localStorage.setItem(key, JSON.stringify(updated));
      window.dispatchEvent(new Event('ec_projects_updated'));
    }
  } catch {
    // Ignore
  }
}

interface NotifyTaskCompletedParams {
  task: Task;
  project?: { id: string; name: string; leadUserId?: string | null };
  currentUser?: { id: string; fullName?: string; email?: string } | null;
}

/**
 * Tự động tạo và gửi thông báo khi Task hoàn thành (Task Done -> Notify Manager)
 * Điều kiện:
 * 1. Có thông tin project và leadUserId (Project Manager)
 * 2. Người thực hiện khác Manager (currentUser.id !== leadUserId) để tránh tự spam thông báo
 * 3. Bỏ qua Admin khỏi danh sách nhận tự động để tránh tràn hòm thư (Notification Fatigue)
 * 4. Tạo thông báo với Deep Link: /projects/${project.id}?taskId=${task.id}
 */
export function notifyTaskCompleted({ task, project, currentUser }: NotifyTaskCompletedParams): void {
  if (!project || !project.leadUserId) return;

  const managerId = project.leadUserId;
  const currentUserId = currentUser?.id;

  // Chặn tự gửi thông báo cho chính mình nếu người hoàn thành là Manager
  if (currentUserId && currentUserId === managerId) return;

  const actorName = currentUser?.fullName || currentUser?.email?.split('@')[0] || t('projects:taskCard.unknownAssignee');
  const taskTitle = task.title || 'Công việc';
  const projectName = project.name || 'Dự án';

  const notificationId = `notif_task_done_${task.id}_${Date.now()}`;
  const notificationTitle = t('notifications:page.titles.taskCompleted', { defaultValue: 'Công việc đã hoàn thành' });
  const notificationMessage = `${actorName} đã hoàn thành công việc "${taskTitle}" trong dự án "${projectName}".`;

  // Lưu thông báo vào client-side storage của Manager
  try {
    const key = `ec_user_notifications_${managerId}`;
    const raw = localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];

    // Tránh gửi liên tục nhiều thông báo trùng lặp cho cùng 1 task trong thời gian ngắn (trong vòng 1 phút)
    const oneMinuteAgo = Date.now() - 60000;
    const isRecentlyNotified = list.some(
      (n: { payload?: { taskId?: string }; createdAt: string }) =>
        n.payload?.taskId === task.id && new Date(n.createdAt).getTime() > oneMinuteAgo,
    );

    if (!isRecentlyNotified) {
      const newNotification = {
        id: notificationId,
        title: notificationTitle,
        message: notificationMessage,
        type: 'task.completed',
        isRead: false,
        link: `/projects/${project.id}?taskId=${task.id}`,
        payload: {
          taskId: task.id,
          projectId: project.id,
          projectName: project.name,
          taskTitle: task.title,
          actorId: currentUserId,
          actorName,
        },
        createdAt: new Date().toISOString(),
      };

      list.unshift(newNotification);
      localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
      window.dispatchEvent(new Event('ec_notifications_updated'));
    }
  } catch {
    // Ignore storage errors
  }
}

