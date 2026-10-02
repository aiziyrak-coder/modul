export type TaskStatusUz =
  | 'yangi'
  | 'jarayonda'
  | 'tekshiruvda'
  | 'bajarildi'
  | 'rad etildi'
  | 'bajarilmadi'
  | 'kechikdi';

export type TaskPriorityUz = 'yuqori' | "o'rta" | 'past';

export type TaskStatusEn =
  | 'new'
  | 'in_progress'
  | 'under_review'
  | 'completed'
  | 'rejected'
  | 'not_needed'
  | 'overdue';

export type TaskPriorityEn = 'low' | 'medium' | 'high';

export interface TaskUser {
  id: string;
  name: string;
  position: string;
  department: string;
  roleTitle: string;
}

export interface TaskAttachment {
  name: string;
  size?: string;
  type?: string;
  url?: string;
}

export interface TaskResponse {
  id: string;
  userId: string;
  user: TaskUser;
  text: string;
  isComment: boolean;
  isCompleted: boolean;
  isRejected: boolean;
  rejectionReason: string | null;
  createdAt: string;
  attachments: TaskAttachment[];
  isReassign: boolean;
  isDeadlineChange: boolean;
}

export interface Task {
  id: string;
  code: string;
  title: string;
  description: string;
  createdBy: TaskUser;
  assignees: TaskUser[];
  deadline: string;
  createdAt: string;
  priority: TaskPriorityUz;
  status: TaskStatusUz;
  category: string | null;
  attachments: TaskAttachment[];
  responses: TaskResponse[];
  responseCount: number;
  readBy: string[];
  completedBy: string[];
  responsesMeta?: { page: number; hasMore: boolean; total: number };
}

export interface TaskStatsScope {
  total: number;
  yangi: number;
  jarayonda: number;
  tekshiruvda: number;
  bajarildi: number;
  'rad etildi': number;
  bajarilmadi: number;
  kechikdi: number;
}

export interface TaskStats {
  created: TaskStatsScope;
  assigned: TaskStatsScope;
}

export interface TaskNotification {
  id: string;
  message: string;
  read: boolean;
  createdAt: string;
  taskId: string | null;
  taskCode: string | null;
}

export interface Category {
  _id: string;
  name: string;
}

export interface MonitoringRow {
  assigneeId: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  department?: string;
  position?: string;
  total: number;
  completed: number;
  active: number;
  overdue: number;
  rating: number;
}

export interface EmployeeStat {
  id: string;
  name: string;
  position: string;
  department: string;
  total: number;
  done: number;
  active: number;
  late: number;
  rate: number;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  deadline: string;
  priority: TaskPriorityUz;
  categoryId?: string;
  assigneeIds: string[];
  files?: File[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  deadline?: string;
  priority?: TaskPriorityUz;
  categoryId?: string | null;
  files?: File[];
}

export interface AddResponseInput {
  text?: string;
  isCompleted?: boolean;
  isRejected?: boolean;
  rejectionReason?: string;
  files?: File[];
}

export interface AssignerRow extends TaskUser {
  grantCount: number;
}

export interface RoleOption {
  id: string;
  title: string;
  description: string;
}
