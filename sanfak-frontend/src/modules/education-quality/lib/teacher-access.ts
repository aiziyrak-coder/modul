import type { TeacherAccess } from '../model/types';

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isTeacherActive(access: TeacherAccess, today = new Date()): boolean {
  if (access.active) return true;
  if (!access.activeFrom) return false;
  return access.activeFrom <= toDateKey(today);
}
