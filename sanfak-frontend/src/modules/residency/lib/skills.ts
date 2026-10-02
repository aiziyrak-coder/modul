import type { SkillEntry } from '../api/types';

export function skillLabel(entry: SkillEntry): string {
  const name = (entry.skill ?? '').trim();
  if (!name) return '';
  return typeof entry.count === 'number' ? `${name} ×${entry.count}` : name;
}

export function skillsText(entries: SkillEntry[] | undefined | null): string {
  if (!entries?.length) return '';
  return entries.map(skillLabel).filter(Boolean).join(', ');
}
