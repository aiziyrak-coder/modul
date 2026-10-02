import type { TaskStatus, RankStatus, VotingStatus } from './types';

interface Meta {
  label: string;
  color: string;
}

export const TASK_STATUS_META: Record<TaskStatus, Meta> = {
  new: { label: 'Yangi', color: 'blue' },
  in_progress: { label: 'Jarayonda', color: 'orange' },
  done: { label: 'Bajarildi', color: 'cyan' },
  approved: { label: 'Tasdiqlandi', color: 'green' },
  rejected: { label: 'Rad etildi', color: 'red' },
  overdue: { label: "Muddati o'tdi", color: 'red' },
};

export const RANK_STATUS_META: Record<RankStatus, Meta> = {
  new: { label: 'Yangi', color: 'blue' },
  accepted: { label: 'Qabul qilindi', color: 'green' },
  returned: { label: 'Qaytarildi', color: 'red' },
};

export const VOTING_STATUS_META: Record<VotingStatus, Meta> = {
  active: { label: 'Faol', color: 'blue' },
  approved: { label: 'Tasdiqlandi', color: 'green' },
  rejected: { label: 'Rad etildi', color: 'red' },
};

export const TASK_STATUS_ORDER: TaskStatus[] = [
  'new',
  'in_progress',
  'done',
  'approved',
  'rejected',
  'overdue',
];

export const taskStatusMeta = (s: TaskStatus): Meta =>
  TASK_STATUS_META[s] ?? { label: s, color: 'default' };
export const rankStatusMeta = (s: RankStatus): Meta =>
  RANK_STATUS_META[s] ?? { label: s, color: 'default' };
export const votingStatusMeta = (s: VotingStatus): Meta =>
  VOTING_STATUS_META[s] ?? { label: s, color: 'default' };
