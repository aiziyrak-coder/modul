export interface DeadlineBadge {
  color: string;
  key: 'overdue' | 'endsToday' | 'oneDayLeft';
}

export function deadlineBadge(diffDays: number): DeadlineBadge | null {
  if (diffDays < 0) return { color: 'default', key: 'overdue' };
  if (diffDays === 0) return { color: 'red', key: 'endsToday' };
  if (diffDays === 1) return { color: 'volcano', key: 'oneDayLeft' };
  return null;
}
