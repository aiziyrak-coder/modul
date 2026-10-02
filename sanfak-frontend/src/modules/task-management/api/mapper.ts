import type {
  AssignerRow,
  RoleOption,
  Task,
  TaskAttachment,
  TaskNotification,
  TaskPriorityEn,
  TaskPriorityUz,
  TaskResponse,
  TaskStatsScope,
  TaskStatusEn,
  TaskStatusUz,
  TaskUser,
} from '../model/types';
import {
  priorityByEn,
  priorityByUz,
  statusByEn,
  statusByUz,
} from '../model/status-workflow';
import { nameOf } from './user-name';

export const toUzStatus = (s?: string): TaskStatusUz =>
  statusByEn(s).uz as TaskStatusUz;
export const toEnStatus = (s?: string): TaskStatusEn | undefined =>
  s ? (statusByUz(s).en as TaskStatusEn) : undefined;
export const toUzPriority = (p?: string): TaskPriorityUz =>
  priorityByEn(p).uz as TaskPriorityUz;
export const toEnPriority = (p?: string): TaskPriorityEn =>
  priorityByUz(p).en as TaskPriorityEn;

type Ref = string | { _id?: string; title?: string; name?: string } | null | undefined;

export interface BackendUser {
  _id?: string;
  id?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  name?: string;
  position?: Ref;
  department?: Ref;
  role?: Ref;
}

export interface BackendAssigner extends BackendUser {
  grantCount?: number;
}

export interface BackendRole {
  _id?: string;
  id?: string;
  title?: string;
  description?: string;
}

export interface BackendResponse {
  _id?: string;
  id?: string;
  author?: BackendUser | string;
  text?: string;
  isComment?: boolean;
  isCompleted?: boolean;
  isRejected?: boolean;
  rejectionReason?: string | null;
  isDeadlineChange?: boolean;
  isReassign?: boolean;
  createdAt?: string;
  attachments?: TaskAttachment[];
}

export interface BackendTask {
  _id?: string;
  id?: string;
  code?: string;
  title: string;
  description?: string;
  createdBy?: BackendUser;
  assignee?: BackendUser;
  deadline: string;
  createdAt: string;
  priority?: string;
  status?: string;
  displayStatus?: string;
  category?: { name?: string } | null;
  attachments?: TaskAttachment[];
  readAt?: string;
  completedAt?: string;
  responseCount?: number;
}

export interface BackendStatsScope {
  total?: number;
  new?: number;
  in_progress?: number;
  under_review?: number;
  completed?: number;
  rejected?: number;
  not_needed?: number;
  overdue?: number;
}

export interface BackendNotification {
  _id?: string;
  id?: string;
  title?: string;
  body?: string;
  read?: boolean;
  createdAt?: string;
  metadata?: { taskId?: string; code?: string };
}

const refTitle = (v: Ref): string =>
  v && typeof v === 'object' ? v.title ?? v.name ?? '' : '';

export const fullName = (u?: BackendUser | null): string =>
  nameOf(u) || u?.name || '—';

const EMPTY_USER: TaskUser = { id: '', name: '—', position: '', department: '', roleTitle: '' };

export const adaptUser = (u?: BackendUser | string | null): TaskUser => {
  if (!u || typeof u === 'string') return EMPTY_USER;
  return {
    id: String(u._id ?? u.id ?? ''),
    name: fullName(u),
    position: refTitle(u.position),
    department: refTitle(u.department),
    roleTitle: refTitle(u.role) || (typeof u.role === 'string' ? u.role : ''),
  };
};

export const adaptAssigner = (u: BackendAssigner): AssignerRow => ({
  ...adaptUser(u),
  grantCount: u.grantCount ?? 0,
});

export const adaptRoleOption = (r: BackendRole): RoleOption => ({
  id: String(r._id ?? r.id ?? ''),
  title: r.title ?? '',
  description: r.description ?? '',
});

export const adaptResponse = (r: BackendResponse): TaskResponse => ({
  id: String(r._id ?? r.id ?? ''),
  userId: String(
    (typeof r.author === 'object' ? r.author?._id ?? r.author?.id : r.author) ?? '',
  ),
  user: adaptUser(r.author),
  text: r.text ?? '',
  isComment: !!r.isComment,
  isCompleted: !!r.isCompleted,
  isRejected: !!r.isRejected,
  rejectionReason: r.rejectionReason ?? null,
  isDeadlineChange: !!r.isDeadlineChange,
  isReassign: !!r.isReassign,
  createdAt: r.createdAt ?? '',
  attachments: r.attachments ?? [],
});

export const adaptTask = (t: BackendTask, responses: BackendResponse[] = []): Task => {
  const assignee = adaptUser(t.assignee);
  const hasAssignee = !!assignee.id;
  return {
    id: String(t._id ?? t.id ?? ''),
    code: t.code ?? '',
    title: t.title,
    description: t.description ?? '',
    createdBy: adaptUser(t.createdBy),
    assignees: hasAssignee ? [assignee] : [],
    deadline: t.deadline,
    createdAt: t.createdAt,
    priority: toUzPriority(t.priority),
    status: toUzStatus(t.displayStatus ?? t.status),
    category: t.category?.name ?? null,
    attachments: t.attachments ?? [],
    responses: responses.map(adaptResponse),
    responseCount: t.responseCount ?? responses.length,
    readBy: t.readAt && hasAssignee ? [assignee.id] : [],
    completedBy: t.completedAt && hasAssignee && t.status === 'completed' ? [assignee.id] : [],
  };
};

export const statsToUz = (s: BackendStatsScope = {}): TaskStatsScope => ({
  total: s.total ?? 0,
  yangi: s.new ?? 0,
  jarayonda: s.in_progress ?? 0,
  tekshiruvda: s.under_review ?? 0,
  bajarildi: s.completed ?? 0,
  'rad etildi': s.rejected ?? 0,
  bajarilmadi: s.not_needed ?? 0,
  kechikdi: s.overdue ?? 0,
});

export const adaptNotification = (n: BackendNotification): TaskNotification => ({
  id: String(n._id ?? n.id ?? ''),
  message: n.body ? `${n.title}: ${n.body}` : n.title ?? '',
  read: !!n.read,
  createdAt: n.createdAt ?? '',
  taskId: n.metadata?.taskId ? String(n.metadata.taskId) : null,
  taskCode: n.metadata?.code ? String(n.metadata.code) : null,
});
