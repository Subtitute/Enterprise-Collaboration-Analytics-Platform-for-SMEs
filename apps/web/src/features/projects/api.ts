import { apiClient } from '@/lib/api-client';
import { unwrapList } from '@/lib/utils';
import type { PaginatedResponse, Project, Task, TaskComment, TaskStatus, TaskStatusHistoryEntry } from '@/types';

export interface CreateProjectPayload {
  name: string;
  description?: string;
  startDate?: string;
  dueDate?: string;
}

export interface FetchProjectsParams {
  page?: number;
  limit?: number;
  /** Tim kiem theo ten du an (Wireframe.md muc 4.1) - server loc, khong loc client. */
  search?: string;
  /** Loc theo trang thai du an (ACTIVE/COMPLETED/ARCHIVED...). Khong con bo loc "Phong ban"
   *  (Dieu chinh 21/07/2026 - xem Wireframe.md muc 4.1). */
  status?: string;
}

export async function fetchProjects(params: FetchProjectsParams = {}): Promise<PaginatedResponse<Project>> {
  const { data } = await apiClient.get<PaginatedResponse<Project>>('/projects', { params });
  return data;
}

export async function fetchProject(id: string): Promise<Project> {
  const { data } = await apiClient.get<Project>(`/projects/${id}`);
  return data;
}

export async function createProject(payload: CreateProjectPayload): Promise<Project> {
  const { data } = await apiClient.post<Project>('/projects', payload);
  return data;
}

export async function updateProject(id: string, payload: Partial<CreateProjectPayload>): Promise<Project> {
  const { data } = await apiClient.patch<Project>(`/projects/${id}`, payload);
  return data;
}

export async function deleteProject(id: string): Promise<void> {
  await apiClient.delete(`/projects/${id}`);
}

export async function completeProject(id: string): Promise<Project> {
  const { data } = await apiClient.post<Project>(`/projects/${id}/complete`);
  return data;
}

export interface FetchTasksParams {
  projectId?: string;
  status?: TaskStatus;
  limit?: number;
}

export async function fetchTasks(params: FetchTasksParams = {}): Promise<Task[]> {
  const { data } = await apiClient.get<PaginatedResponse<Task>>('/tasks', { params: { limit: 500, ...params } });
  return data.data;
}

export interface CreateTaskPayload {
  projectId: string;
  title: string;
  description?: string;
  dueDate?: string;
}

export async function createTask(payload: CreateTaskPayload): Promise<Task> {
  const { data } = await apiClient.post<Task>('/tasks', payload);
  return data;
}

export async function updateTask(id: string, payload: Partial<Omit<CreateTaskPayload, 'projectId'>>): Promise<Task> {
  const { data } = await apiClient.patch<Task>(`/tasks/${id}`, payload);
  return data;
}

export async function deleteTask(id: string): Promise<void> {
  await apiClient.delete(`/tasks/${id}`);
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  const { data } = await apiClient.patch<Task>(`/tasks/${id}/status`, { status });
  return data;
}

export async function addAssignee(taskId: string, userId: string): Promise<void> {
  await apiClient.post(`/tasks/${taskId}/assignees`, { userId });
}

export async function removeAssignee(taskId: string, userId: string): Promise<void> {
  await apiClient.delete(`/tasks/${taskId}/assignees/${userId}`);
}

export async function fetchComments(taskId: string): Promise<TaskComment[]> {
  const { data } = await apiClient.get<PaginatedResponse<TaskComment> | TaskComment[]>(`/tasks/${taskId}/comments`);
  return Array.isArray(data) ? data : data.data;
}

export async function addComment(taskId: string, content: string): Promise<TaskComment> {
  const { data } = await apiClient.post<TaskComment>(`/tasks/${taskId}/comments`, { content });
  return data;
}

/** GET /tasks/:id/status-history - tra ve mang tho hoac { data: [] } tuy service, chuan hoa qua unwrapList. */
export async function fetchTaskStatusHistory(taskId: string): Promise<TaskStatusHistoryEntry[]> {
  const { data } = await apiClient.get(`/tasks/${taskId}/status-history`);
  return unwrapList<TaskStatusHistoryEntry>(data);
}
