import { useSessionStore } from '@/app/session';
import type { PracticeRole } from './types';

export const ROLE_LABELS: Record<PracticeRole, string> = {
  amaliyot_bolimi: "Amaliyot bo'limi",
  rektor: 'Rektor',
  tibbiyot_birlashmasi_rahbari: 'Tibbiyot birlashmasi rahbari',
  admin: 'Administrator',
};

const PRACTICE_ROLES: PracticeRole[] = [
  'amaliyot_bolimi',
  'rektor',
  'tibbiyot_birlashmasi_rahbari',
  'admin',
];

export function usePracticeRole(): PracticeRole {
  const roleName = useSessionStore((s) => s.user?.roles?.[0]?.name);
  if (roleName && (PRACTICE_ROLES as string[]).includes(roleName)) {
    return roleName as PracticeRole;
  }
  return 'amaliyot_bolimi';
}
