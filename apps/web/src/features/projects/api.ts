import { apiClient } from '@/lib/api-client';
import { unwrapList } from '@/lib/utils';
import type { PaginatedResponse, Project, Task, TaskComment, TaskStatus, TaskStatusHistoryEntry } from '@/types';

export interface CreateProjectPayload {
  name: string;
  description?: string;
  startDate?: string;
  dueDate?: string;
  // 26/08/2026 (fix code review, loi MAJOR - Fix 3): 2 field moi - gio duoc gui THANG len server
  // (xem project.entity.ts/create-project.dto.ts/update-project.dto.ts, project-task-service) thay
  // vi chi luu rieng trong localStorage['ec_projects_metadata'] cua tung trinh duyet nhu truoc.
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  leadUserId?: string;
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

/** 26/08/2026 (fix code review, loi CRITICAL - Fix 1): helper dung chung cho completeProject()/
 *  reopenProject() ben duoi - chi ghi de trang thai + thu tu hien thi vao localStorage SAU KHI da
 *  nhan duoc phan hoi THANH CONG THAT SU tu server. Truoc ban sua nay ca 2 ham ghi "optimistic"
 *  ngay tu dau ham, TRUOC CA khi goi API - neu request that bai (vd. 403 khong co quyen, mat mang)
 *  thi override van nam lai trong localStorage va UI tiep tuc hien SAI trang thai (da "hoan
 *  thanh"/"mo lai") mai mai, khong co duong nao tu phuc hoi ngoai xoa thu cong localStorage.
 *  Nhan tien sua luon key thu tu: dung CHUNG 'ec_projects_custom_order' voi ORDER_STORAGE_KEY
 *  (ProjectsListPage.tsx) va NewProjectModal.tsx - truoc day ham nay ghi NHAM vao key rieng
 *  'ec_projects_order' ma khong noi nao doc, nen thu tu hien thi khong bao gio thuc su duoc cap
 *  nhat sau khi hoan thanh/mo lai du an (dead code). */
function persistProjectOrderOverride(id: string, status: 'ACTIVE' | 'COMPLETED', toFront: boolean) {
  try {
    const meta = JSON.parse(localStorage.getItem('ec_projects_metadata') || '{}');
    meta[id] = { ...(meta[id] || {}), status };
    localStorage.setItem('ec_projects_metadata', JSON.stringify(meta));

    const savedOrder: string[] = JSON.parse(localStorage.getItem('ec_projects_custom_order') || '[]');
    const filtered = savedOrder.filter((pId) => pId !== id);
    localStorage.setItem('ec_projects_custom_order', JSON.stringify(toFront ? [id, ...filtered] : [...filtered, id]));
  } catch {
    // Bo qua loi localStorage (vd. Safari private mode chan setItem/getItem) - khong anh huong ket qua API that.
  }
}

export async function completeProject(id: string): Promise<Project> {
  try {
    const { data } = await apiClient.post<Project>(`/projects/${id}/complete`);
    persistProjectOrderOverride(id, 'COMPLETED', false);
    window.dispatchEvent(new Event('ec_projects_updated'));
    return data;
  } catch (err) {
    // 26/08/2026 (fix code review, loi CRITICAL - Fix 1): truoc ban sua nay, khi POST
    // /projects/:id/complete that bai, nhanh catch nay "nuot" loi va tra ve 1 object Project GIA
    // (fabricate, coi nhu thanh cong) thay vi nem lai loi that. He qua: useCompleteProject()
    // (hooks.ts).onError() KHONG BAO GIO duoc goi (khong toast loi that cho nguoi dung biet),
    // trong khi onSuccess() van chay va patch cache React Query sang COMPLETED - UI hien SAI trang
    // thai "da hoan thanh" du server chua he doi gi, cho toi khi tai lai trang. (Fallback PATCH
    // /projects/:id { status: 'COMPLETED' } da bi bo hoan toan truoc do - xem update-project.dto.ts
    // - vi BE khong con nhan field `status` qua endpoint nay nen fallback do se "thanh cong" ma
    // khong doi status that, cang nguy hiem hon neu van giu.) Nem lai loi that de onError() chay dung.
    throw err;
  }
}

export async function reopenProject(id: string): Promise<Project> {
  try {
    const { data } = await apiClient.post<Project>(`/projects/${id}/reopen`);
    persistProjectOrderOverride(id, 'ACTIVE', true);
    window.dispatchEvent(new Event('ec_projects_updated'));
    return data;
  } catch (err) {
    // 26/08/2026 (fix code review, loi CRITICAL - Fix 1, tiep tuc sua sau khi phat hien qua doi
    // chieu cuoi cung): ban sua truoc do (cung ngay) van giu 1 nhanh fallback PATCH /projects/:id
    // { status: 'ACTIVE' } khi /reopen loi - nhung ValidationPipe cua service nay chi bat
    // `whitelist: true`, KHONG bat `forbidNonWhitelisted`, nen field `status` (da bi bo khoi
    // UpdateProjectDto o Fix "Project status bypass" cung dot sua nay) chi bi AM THAM LOAI BO
    // khoi body thay vi bi tu choi 400 - PATCH do van tra ve 200 kem project KHONG DOI trang thai,
    // khien ham nay coi nhu "thanh cong" va ghi de localStorage/dispatch event sang ACTIVE du server
    // van con ARCHIVED - tai dung loi CRITICAL vua sua (UI hien sai trang thai vinh vien) qua chinh
    // nhanh fallback duoc them de "phong ngua". Bo han fallback nay - /reopen la duong duy nhat co
    // the thuc su doi trang thai, giong het completeProject() o tren (khong con fallback nao).
    throw err;
  }
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
