import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/stores/toast.store';
import { extractErrorMessage } from '@/lib/api-client';
import type { Task, TaskStatus } from '@/types';
import {
  addAssignee,
  addComment,
  completeProject,
  createProject,
  createTask,
  deleteProject,
  deleteTask,
  fetchComments,
  fetchProject,
  fetchProjects,
  fetchTasks,
  removeAssignee,
  updateProject,
  updateTask,
  updateTaskStatus,
} from './api';
import type { CreateProjectPayload, CreateTaskPayload } from './api';

export function useProjectsQuery(params: { page?: number; limit?: number } = {}) {
  return useQuery({ queryKey: ['projects', params], queryFn: () => fetchProjects(params) });
}

/** Toan bo cong viec cua to chuc (khong loc projectId) - dung de tinh tien do tren danh sach du
 *  an ma khong phai goi API rieng cho tung du an (tranh N+1). */
export function useAllTasksQuery() {
  return useQuery({ queryKey: ['tasks', 'all'], queryFn: () => fetchTasks({}), staleTime: 60_000 });
}

export function useProjectQuery(id: string | undefined) {
  return useQuery({ queryKey: ['project', id], queryFn: () => fetchProject(id as string), enabled: Boolean(id) });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProjectPayload) => createProject(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Đã tạo dự án mới');
    },
    onError: (error) => toast.error('Không thể tạo dự án', extractErrorMessage(error)),
  });
}

export function useUpdateProject(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<CreateProjectPayload>) => updateProject(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      toast.success('Đã cập nhật dự án');
    },
    onError: (error) => toast.error('Không thể cập nhật dự án', extractErrorMessage(error)),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Đã xoá dự án');
    },
    onError: (error) => toast.error('Không thể xoá dự án', extractErrorMessage(error)),
  });
}

export function useCompleteProject(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => completeProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      toast.success('Đã đánh dấu dự án hoàn thành');
    },
    onError: (error) => toast.error('Không thể hoàn thành dự án', extractErrorMessage(error)),
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<CreateTaskPayload, 'projectId'>) => createTask({ projectId, ...payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Đã tạo công việc mới');
    },
    onError: (error) => toast.error('Không thể tạo công việc', extractErrorMessage(error)),
  });
}

export function useUpdateTask(projectId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Omit<CreateTaskPayload, 'projectId'>>) => updateTask(taskId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Đã lưu thay đổi công việc');
    },
    onError: (error) => toast.error('Không thể cập nhật công việc', extractErrorMessage(error)),
  });
}

export function useDeleteTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Đã xoá công việc');
    },
    onError: (error) => toast.error('Không thể xoá công việc', extractErrorMessage(error)),
  });
}

/** Cap nhat trang thai Kanban (keo-tha) - optimistic update de UI phan hoi ngay lap tuc. */
export function useUpdateTaskStatus(projectId: string) {
  const queryClient = useQueryClient();
  const queryKey = ['tasks', projectId];

  return useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) => updateTaskStatus(taskId, status),
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Task[]>(queryKey);
      queryClient.setQueryData<Task[]>(queryKey, (old) => (old ?? []).map((t) => (t.id === taskId ? { ...t, status } : t)));
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error('Không thể cập nhật trạng thái công việc', extractErrorMessage(error));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}

export function useAddAssignee(projectId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => addAssignee(taskId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
    onError: (error) => toast.error('Không thể thêm người phụ trách', extractErrorMessage(error)),
  });
}

export function useRemoveAssignee(projectId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeAssignee(taskId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
    onError: (error) => toast.error('Không thể gỡ người phụ trách', extractErrorMessage(error)),
  });
}

export function useCommentsQuery(taskId: string | undefined) {
  return useQuery({ queryKey: ['task-comments', taskId], queryFn: () => fetchComments(taskId as string), enabled: Boolean(taskId) });
}

export function useAddComment(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => addComment(taskId, content),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task-comments', taskId] }),
    onError: (error) => toast.error('Không thể gửi bình luận', extractErrorMessage(error)),
  });
}
