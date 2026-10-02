import type { TaskPriorityUz, TaskStatusUz } from '../model/types';
import { TASK_PRIORITIES, TASK_STATUSES } from '../model/status-workflow';

export interface PriorityMeta {
  value: TaskPriorityUz;
  label: string;
  color: string;
}

export interface StatusMeta {
  value: TaskStatusUz;
  label: string;
  color: string;
  bg: string;
}

export const priorities: PriorityMeta[] = TASK_PRIORITIES.map((x) => ({
  value: x.uz as TaskPriorityUz,
  label: x.label,
  color: x.color,
}));

export const statuses: StatusMeta[] = TASK_STATUSES.map((x) => ({
  value: x.uz as TaskStatusUz,
  label: x.label,
  color: x.color,
  bg: x.bg,
}));

export const months = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];

export interface BoardColumn {
  key: string;
  label: string;
  statuses: TaskStatusUz[];
  color: string;
}

export const boardColumns: BoardColumn[] = [
  { key: 'yangi', label: 'Yangi', statuses: ['yangi'], color: '#0ea5e9' },
  { key: 'jarayonda', label: 'Jarayonda', statuses: ['jarayonda'], color: '#f59e0b' },
  { key: 'tekshiruvda', label: 'Tekshiruvda', statuses: ['tekshiruvda'], color: '#8b5cf6' },
  { key: 'rad-etildi', label: 'Rad etildi', statuses: ['rad etildi'], color: '#64748b' },
  { key: 'kechikdi', label: 'Kechikayotgan', statuses: ['kechikdi'], color: '#f43f5e' },
  {
    key: 'yakunlangan',
    label: 'Yakunlangan',
    statuses: ['bajarildi', 'bajarilmadi'],
    color: '#22c55e',
  },
];

export const statusTabs: { key: '' | TaskStatusUz; label: string }[] = [
  { key: '', label: 'Barchasi' },
  { key: 'yangi', label: 'Yangi' },
  { key: 'jarayonda', label: 'Jarayonda' },
  { key: 'tekshiruvda', label: 'Tekshiruvda' },
  { key: 'bajarildi', label: 'Bajarildi' },
  { key: 'kechikdi', label: 'Kechikdi' },
  { key: 'rad etildi', label: 'Rad etildi' },
  { key: 'bajarilmadi', label: 'Bajarilmadi' },
];
