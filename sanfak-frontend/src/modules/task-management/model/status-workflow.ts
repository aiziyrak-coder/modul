export interface TaskStatusMeta {
  en: string;
  uz: string;
  label: string;
  color: string;
  bg: string;
  closed: boolean;
}

export const TASK_STATUSES: readonly TaskStatusMeta[] = [
  { en: 'new', uz: 'yangi', label: 'Yangi', color: '#1677ff', bg: '#e6f4ff', closed: false },
  { en: 'in_progress', uz: 'jarayonda', label: 'Jarayonda', color: '#fa8c16', bg: '#fff7e6', closed: false },
  { en: 'under_review', uz: 'tekshiruvda', label: 'Tekshiruvda', color: '#722ed1', bg: '#f9f0ff', closed: false },
  { en: 'completed', uz: 'bajarildi', label: 'Bajarildi', color: '#52c41a', bg: '#f6ffed', closed: true },
  { en: 'rejected', uz: 'rad etildi', label: 'Rad etildi', color: '#8c8c8c', bg: '#f5f5f5', closed: true },
  { en: 'not_needed', uz: 'bajarilmadi', label: 'Bajarilmadi', color: '#cf1322', bg: '#fff1f0', closed: true },
  { en: 'overdue', uz: 'kechikdi', label: 'Kechikdi', color: '#ff4d4f', bg: '#fff2f0', closed: false },
] as const;

export interface TaskPriorityMeta {
  en: string;
  uz: string;
  label: string;
  color: string;
}

export const TASK_PRIORITIES: readonly TaskPriorityMeta[] = [
  { en: 'high', uz: 'yuqori', label: 'Yuqori', color: '#ff4d4f' },
  { en: 'medium', uz: "o'rta", label: "O'rta", color: '#fa8c16' },
  { en: 'low', uz: 'past', label: 'Past', color: '#52c41a' },
] as const;

const byEn = new Map(TASK_STATUSES.map((s) => [s.en, s]));
const byUz = new Map(TASK_STATUSES.map((s) => [s.uz, s]));
const prByEn = new Map(TASK_PRIORITIES.map((p) => [p.en, p]));
const prByUz = new Map(TASK_PRIORITIES.map((p) => [p.uz, p]));

export const CLOSED_STATUS_UZ: readonly string[] = TASK_STATUSES.filter((s) => s.closed).map(
  (s) => s.uz,
);

export const unknownStatus = (raw: string): TaskStatusMeta => ({
  en: raw,
  uz: raw,
  label: raw || 'Nomaʼlum',
  color: '#8c8c8c',
  bg: '#f5f5f5',
  closed: false,
});

export const statusByEn = (en?: string): TaskStatusMeta =>
  byEn.get(en ?? '') ?? unknownStatus(en ?? '');

export const statusByUz = (uz?: string): TaskStatusMeta =>
  byUz.get(uz ?? '') ?? unknownStatus(uz ?? '');

export const priorityByEn = (en?: string): TaskPriorityMeta =>
  prByEn.get(en ?? '') ?? { en: en ?? '', uz: en ?? '', label: en || 'Nomaʼlum', color: '#8c8c8c' };

export const priorityByUz = (uz?: string): TaskPriorityMeta =>
  prByUz.get(uz ?? '') ?? { en: uz ?? '', uz: uz ?? '', label: uz || 'Nomaʼlum', color: '#8c8c8c' };
