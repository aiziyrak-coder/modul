import {
  apiClient,
  deleteData,
  fetchOne,
  fetchPaginated,
  patchJson,
  postJson,
  putJson,
  uploadMultipart,
  type Paginated,
} from '@/shared/api';
import {
  adaptAssigner,
  adaptNotification,
  adaptResponse,
  adaptRoleOption,
  adaptTask,
  adaptUser,
  statsToUz,
  toEnPriority,
  type BackendAssigner,
  type BackendNotification,
  type BackendResponse,
  type BackendRole,
  type BackendStatsScope,
  type BackendTask,
  type BackendUser,
} from './mapper';
import type {
  AddResponseInput,
  AssignerRow,
  Category,
  CreateTaskInput,
  MonitoringRow,
  RoleOption,
  Task,
  TaskNotification,
  TaskStatsScope,
  TaskUser,
  UpdateTaskInput,
} from '../model/types';

export { getApiErrorMessage } from '@/shared/api';

const RESP_PAGE = 30;
export const ASSIGNEE_PAGE = 50;

export type ListParams = Record<string, string | number | undefined>;

const num = (v: string | number | undefined, d: number): number =>
  v === undefined || v === '' ? d : Number(v);

const asList = <T>(res: unknown): T[] => {
  if (Array.isArray(res)) return res as T[];
  const env = res as { docs?: T[]; data?: T[] } | null;
  return env?.docs ?? env?.data ?? [];
};

export async function fetchTasksPage(
  params: ListParams = {},
): Promise<Paginated<Task>> {
  const res = await fetchPaginated<BackendTask>('/tasks/paginate', { ...params, page: num(params.page, 1), limit: num(params.limit, 10) });
  return { ...res, docs: (res.docs ?? []).map((t) => adaptTask(t)) };
}

export async function fetchMyTasksPage(
  params: ListParams = {},
): Promise<Paginated<Task>> {
  const res = await fetchPaginated<BackendTask>('/tasks/my/paginate', { ...params, page: num(params.page, 1), limit: num(params.limit, 10) });
  return { ...res, docs: (res.docs ?? []).map((t) => adaptTask(t)) };
}

export async function fetchTaskStats(
  params: ListParams = {},
): Promise<{ created: TaskStatsScope; assigned: TaskStatsScope }> {
  const { status: _s, page: _p, limit: _l, sort: _so, order: _o, ...rest } = params;
  const raw = await fetchOne<{ created?: BackendStatsScope; assigned?: BackendStatsScope }>(
    '/tasks/stats',
    rest,
  );
  return { created: statsToUz(raw.created), assigned: statsToUz(raw.assigned) };
}

export async function fetchTaskDetail(id: string): Promise<Task> {
  const [detail, page] = await Promise.all([
    fetchOne<BackendTask>(`/tasks/${id}`),
    fetchPaginated<BackendResponse>(`/tasks/${id}/responses`, { page: 1, limit: RESP_PAGE, order: 'desc' }),
  ]);
  const docs = (page.docs ?? []).slice().reverse();
  const task = adaptTask(detail, docs);
  task.responsesMeta = { page: 1, hasMore: !!page.hasNextPage, total: page.totalDocs ?? docs.length };
  return task;
}

export async function loadOlderResponses(id: string, page: number) {
  const res = await fetchPaginated<BackendResponse>(`/tasks/${id}/responses`, {
    page,
    limit: RESP_PAGE,
    order: 'desc',
  });
  const docs = (res.docs ?? []).slice().reverse();
  return { responses: docs.map(adaptResponse), hasMore: !!res.hasNextPage };
}

export async function createTask(input: CreateTaskInput): Promise<void> {
  const files = input.files ?? [];
  if (files.length) {
    await uploadMultipart('/tasks', 'POST', {
      title: input.title,
      description: input.description ?? '',
      deadline: input.deadline,
      priority: toEnPriority(input.priority),
      ...(input.categoryId ? { category: input.categoryId } : {}),
      assignees: JSON.stringify(input.assigneeIds),
      files,
    });
    return;
  }
  await postJson('/tasks', {
    title: input.title,
    description: input.description ?? '',
    deadline: input.deadline,
    priority: toEnPriority(input.priority),
    category: input.categoryId ?? undefined,
    assignees: input.assigneeIds,
  });
}

export async function updateTask(id: string, updates: UpdateTaskInput): Promise<void> {
  const files = updates.files ?? [];
  if (files.length) {
    await uploadMultipart(`/tasks/${id}`, 'PUT', {
      ...(updates.title !== undefined ? { title: updates.title } : {}),
      ...(updates.description !== undefined ? { description: updates.description ?? '' } : {}),
      ...(updates.deadline !== undefined ? { deadline: updates.deadline } : {}),
      ...(updates.priority !== undefined ? { priority: toEnPriority(updates.priority) } : {}),
      ...(updates.categoryId !== undefined ? { category: updates.categoryId ?? '' } : {}),
      files,
    });
    return;
  }
  const body: Record<string, unknown> = {};
  if (updates.title !== undefined) body.title = updates.title;
  if (updates.description !== undefined) body.description = updates.description;
  if (updates.deadline !== undefined) body.deadline = updates.deadline;
  if (updates.priority !== undefined) body.priority = toEnPriority(updates.priority);
  if (updates.categoryId !== undefined) body.category = updates.categoryId;
  await putJson(`/tasks/${id}`, body);
}

export async function deleteTask(id: string): Promise<void> {
  await deleteData(`/tasks/${id}`);
}

export type FinalizeStatus = 'bajarildi' | 'bajarilmadi' | 'jarayonda';

export async function finalizeTask(id: string, status: FinalizeStatus = 'bajarildi'): Promise<void> {
  if (status === 'bajarildi') await patchJson(`/tasks/${id}/complete`, { outcome: 'completed' });
  else if (status === 'bajarilmadi') await patchJson(`/tasks/${id}/complete`, { outcome: 'not_needed' });
  else await patchJson(`/tasks/${id}/reopen`, {});
}

export async function resumeTask(id: string): Promise<void> {
  await patchJson(`/tasks/${id}/reopen`, {});
}

export async function reassignTask(id: string, reason: string): Promise<void> {
  await patchJson(`/tasks/${id}/reopen`, {});
  try {
    await postJson(`/tasks/${id}/responses`, { text: reason, isReassign: true });
  } catch {}
}

export async function extendDeadline(id: string, newDeadline: string): Promise<void> {
  await putJson(`/tasks/${id}`, { deadline: newDeadline });
  try {
    await postJson(`/tasks/${id}/responses`, {
      text: `Muddat o'zgartirildi: ${newDeadline}`,
      isDeadlineChange: true,
    });
  } catch {}
}

export async function addResponse(id: string, response: AddResponseInput): Promise<void> {
  const files = response.files ?? [];
  if (files.length) {
    await uploadMultipart(`/tasks/${id}/responses`, 'POST', {
      ...(response.text ? { text: response.text } : {}),
      ...(response.isCompleted ? { isCompleted: 'true' } : {}),
      ...(response.isRejected ? { isRejected: 'true' } : {}),
      ...(response.rejectionReason ? { rejectionReason: response.rejectionReason } : {}),
      files,
    });
    return;
  }
  await postJson(`/tasks/${id}/responses`, {
    text: response.text ?? '',
    isCompleted: !!response.isCompleted,
    isRejected: !!response.isRejected,
    rejectionReason: response.rejectionReason,
  });
}

export function fetchMonitoring(params: ListParams = {}): Promise<Paginated<MonitoringRow>> {
  return fetchPaginated<MonitoringRow>('/tasks/monitoring', { ...params, page: num(params.page, 1), limit: num(params.limit, 12) });
}

export async function fetchMonitoringMonthly(
  params: ListParams = {},
): Promise<Array<Record<string, number | string>>> {
  const res = await fetchOne<{ data?: Array<Record<string, number | string>> }>(
    '/tasks/monitoring/monthly',
    params,
  );
  return res.data ?? [];
}

export async function downloadMonitoringXlsx(
  params: ListParams = {},
  filename = 'topshiriqlar-monitoringi.xlsx',
): Promise<void> {
  const res = await apiClient.get('/tasks/monitoring/export', { params, responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function fetchCategories(): Promise<Category[]> {
  return asList<Category>(await fetchOne<unknown>('/task-categories?active=true'));
}

export function fetchCategoriesPage(params: ListParams = {}): Promise<Paginated<Category>> {
  return fetchPaginated<Category>('/task-categories/paginate', { ...params, page: num(params.page, 1), limit: num(params.limit, 10) });
}

export function createCategory(name: string): Promise<Category> {
  return postJson<Category>('/task-categories', { name });
}

export function updateCategory(id: string, name: string): Promise<Category> {
  return putJson<Category>(`/task-categories/${id}`, { name });
}

export function removeCategory(id: string): Promise<void> {
  return deleteData(`/task-categories/${id}`);
}

export async function fetchNotifications(): Promise<TaskNotification[]> {
  return asList<BackendNotification>(await fetchOne<unknown>('/notifications')).map(adaptNotification);
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await fetchOne<{ count?: number }>('/notifications/unread-count');
  return res.count ?? 0;
}

export function markNotificationRead(id: string): Promise<unknown> {
  return putJson(`/notifications/${id}/read`, {});
}

export function markAllNotificationsRead(): Promise<unknown> {
  return putJson('/notifications/read-all', {});
}

export async function fetchAssignableUsers(
  params: ListParams = {},
): Promise<Paginated<TaskUser>> {
  const res = await fetchPaginated<BackendUser>('/tasks/assignable-users', {
    ...params,
    page: num(params.page, 1),
    limit: num(params.limit, ASSIGNEE_PAGE),
  });
  return { ...res, docs: (res.docs ?? []).map(adaptUser).filter((u) => !!u.id) };
}

const GRANTS = '/task-assignee-grants';

export async function fetchAssigners(
  params: ListParams = {},
): Promise<Paginated<AssignerRow>> {
  const res = await fetchPaginated<BackendAssigner>(`${GRANTS}/users`, {
    ...params,
    page: num(params.page, 1),
    limit: num(params.limit, 10),
  });
  return { ...res, docs: (res.docs ?? []).map(adaptAssigner) };
}

export async function fetchGrantCandidates(
  params: ListParams = {},
): Promise<Paginated<TaskUser>> {
  const res = await fetchPaginated<BackendUser>(`${GRANTS}/candidates`, {
    ...params,
    page: num(params.page, 1),
    limit: num(params.limit, ASSIGNEE_PAGE),
  });
  return { ...res, docs: (res.docs ?? []).map(adaptUser).filter((u) => !!u.id) };
}

export async function fetchGrantRoles(): Promise<RoleOption[]> {
  return asList<BackendRole>(await fetchOne<unknown>(`${GRANTS}/roles`)).map(adaptRoleOption);
}

export async function fetchGrants(assignerId: string): Promise<TaskUser[]> {
  return asList<BackendUser>(await fetchOne<unknown>(`${GRANTS}/${assignerId}`))
    .map(adaptUser)
    .filter((u) => !!u.id);
}

export async function replaceGrants(assignerId: string, assigneeIds: string[]): Promise<void> {
  await putJson(`${GRANTS}/${assignerId}`, { assignees: assigneeIds });
}

export async function removeGrant(assignerId: string, assigneeId: string): Promise<void> {
  await deleteData(`${GRANTS}/${assignerId}/${assigneeId}`);
}
