import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from '@/stores/toast.store';
import { extractErrorMessage } from '@/lib/api-client';
import type { PaginatedResponse, Project, Task, TaskStatus } from '@/types';
import {
  addAssignee,
  addComment,
  completeProject,
  reopenProject,
  createProject,
  createTask,
  deleteProject,
  deleteTask,
  fetchComments,
  fetchProject,
  fetchProjects,
  fetchTaskStatusHistory,
  fetchTasks,
  removeAssignee,
  updateProject,
  updateTask,
  updateTaskStatus,
} from './api';
import type { CreateProjectPayload, CreateTaskPayload, FetchProjectsParams } from './api';

export function useProjectsQuery(params: FetchProjectsParams = {}) {
  return useQuery({ queryKey: ['projects', params], queryFn: () => fetchProjects(params) });
}

/** Toan bo cong viec cua to chuc (khong loc projectId) - dung de tinh tien do tren danh sach du
 *  an ma khong phai goi API rieng cho tung du an (tranh N+1).
 *  22/07/2026: them tham so `options.enabled` (mac dinh khong truyen = giu nguyen hanh vi cu, luon
 *  bat, vd. ProjectsListPage) - can thiet de useGlobalSearch() (Topbar) co the tri hoan query
 *  nay toi khi nguoi dung thuc su focus o tim kiem, thay vi goi ngay khi Topbar mount o MOI trang. */
export function useAllTasksQuery(options?: { enabled?: boolean }) {
  return useQuery({ queryKey: ['tasks', 'all'], queryFn: () => fetchTasks({}), staleTime: 60_000, enabled: options?.enabled });
}

export function useProjectQuery(id: string | undefined) {
  return useQuery({ queryKey: ['project', id], queryFn: () => fetchProject(id as string), enabled: Boolean(id) });
}

export function useCreateProject() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProjectPayload) => createProject(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success(t('projects:toast.project.created'));
    },
    onError: (error) => toast.error(t('projects:toast.project.createError'), extractErrorMessage(error)),
  });
}

export function useUpdateProject(id: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<CreateProjectPayload>) => updateProject(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      toast.success(t('projects:toast.project.updated'));
    },
    onError: (error) => toast.error(t('projects:toast.project.updateError'), extractErrorMessage(error)),
  });
}

export function useDeleteProject() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: (_, id) => {
      try {
        const meta = JSON.parse(localStorage.getItem('ec_projects_metadata') || '{}');
        delete meta[id];
        localStorage.setItem('ec_projects_metadata', JSON.stringify(meta));

        const savedOrder: string[] = JSON.parse(localStorage.getItem('ec_projects_order') || '[]');
        localStorage.setItem('ec_projects_order', JSON.stringify(savedOrder.filter((pId) => pId !== id)));
        window.dispatchEvent(new Event('ec_projects_updated'));
      } catch {
        // Ignore
      }
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      toast.success(t('projects:toast.project.deleted'));
    },
    onError: (error) => toast.error(t('projects:toast.project.deleteError'), extractErrorMessage(error)),
  });
}

export function useCompleteProject(id: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => completeProject(id),
    onSuccess: () => {
      // 1. Cập nhật trực tiếp cache danh sách projects
      queryClient.setQueriesData<PaginatedResponse<Project>>({ queryKey: ['projects'] }, (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((p) => (p.id === id ? { ...p, status: 'COMPLETED' as const } : p)),
        };
      });

      // 2. Cập nhật trực tiếp cache chi tiết project
      queryClient.setQueryData<Project>(['project', id], (old) => {
        if (!old) return old;
        return { ...old, status: 'COMPLETED' as const };
      });

      // 3. Invalidate để đồng bộ
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      toast.success(t('projects:toast.project.completed'));
    },
    onError: (error) => toast.error(t('projects:toast.project.completeError'), extractErrorMessage(error)),
  });
}

export function useReopenProject(id: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => reopenProject(id),
    onSuccess: (updated) => {
      // 1. Cập nhật trực tiếp cache danh sách projects
      queryClient.setQueriesData<PaginatedResponse<Project>>({ queryKey: ['projects'] }, (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((p) => (p.id === id ? { ...p, status: 'ACTIVE' as const } : p)),
        };
      });

      // 2. Cập nhật trực tiếp cache chi tiết project
      queryClient.setQueryData<Project>(['project', id], (old) => {
        if (!old) return old;
        return { ...old, status: 'ACTIVE' as const };
      });

      // 3. Invalidate để đồng bộ
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      toast.success(t('projects:toast.project.reopened'));
    },
    onError: (error) => toast.error(t('projects:toast.project.reopenError'), extractErrorMessage(error)),
  });
}

export function useTasksQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => fetchTasks({ projectId }),
    enabled: Boolean(projectId),
  });
}

export function useCreateTask(projectId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<CreateTaskPayload, 'projectId'>) => createTask({ projectId, ...payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success(t('projects:toast.task.created'));
    },
    onError: (error) => toast.error(t('projects:toast.task.createError'), extractErrorMessage(error)),
  });
}

export function useUpdateTask(projectId: string, taskId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Omit<CreateTaskPayload, 'projectId'>>) => updateTask(taskId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success(t('projects:toast.task.updated'));
    },
    onError: (error) => toast.error(t('projects:toast.task.updateError'), extractErrorMessage(error)),
  });
}

export function useDeleteTask(projectId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success(t('projects:toast.task.deleted'));
    },
    onError: (error) => toast.error(t('projects:toast.task.deleteError'), extractErrorMessage(error)),
  });
}

/** Cap nhat trang thai Kanban (keo-tha) - optimistic update de UI phan hoi ngay lap tuc. */
export function useUpdateTaskStatus(projectId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ['tasks', projectId];

  return useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) => updateTaskStatus(taskId, status),
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Task[]>(queryKey);
      queryClient.setQueryData<Task[]>(queryKey, (old) => (old ?? []).map((task) => (task.id === taskId ? { ...task, status } : task)));
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error(t('projects:toast.task.statusUpdateError'), extractErrorMessage(error));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}

export function useAddAssignee(projectId: string, taskId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => addAssignee(taskId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
    onError: (error) => toast.error(t('projects:toast.task.addAssigneeError'), extractErrorMessage(error)),
  });
}

export function useRemoveAssignee(projectId: string, taskId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeAssignee(taskId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
    onError: (error) => toast.error(t('projects:toast.task.removeAssigneeError'), extractErrorMessage(error)),
  });
}

export function useCommentsQuery(taskId: string | undefined) {
  return useQuery({ queryKey: ['task-comments', taskId], queryFn: () => fetchComments(taskId as string), enabled: Boolean(taskId) });
}

export function useAddComment(taskId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => addComment(taskId, content),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task-comments', taskId] }),
    onError: (error) => toast.error(t('projects:toast.task.addCommentError'), extractErrorMessage(error)),
  });
}

/** Lich su doi trang thai cua 1 task (Modal chi tiet Task - Wireframe.md muc 4.2). */
export function useTaskStatusHistory(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task-status-history', taskId],
    queryFn: () => fetchTaskStatusHistory(taskId as string),
    enabled: Boolean(taskId),
  });
}
