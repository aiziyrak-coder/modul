import { usePermission, useSessionStore } from '@/app/session';
import type { CouncilRole } from './types';

export const ROLE_LABELS: Record<CouncilRole, string> = {
  ilmiy_kengash_kotibi: 'Ilmiy kengash kotibi',
  ilmiy_kengash_azosi: "Kengash a'zosi",
  oqituvchi: "O'qituvchi",
  rektor: 'Rektor',
};

const COUNCIL_ROLES: CouncilRole[] = [
  'ilmiy_kengash_kotibi',
  'ilmiy_kengash_azosi',
  'oqituvchi',
  'rektor',
];

const normalize = (s: string) => s.toLowerCase().replace(/['’‘ʻ`´]/g, '');

export function roleFromName(name: string): CouncilRole | null {
  if ((COUNCIL_ROLES as string[]).includes(name)) return name as CouncilRole;
  const n = normalize(name);
  if (n.includes('kotib')) return 'ilmiy_kengash_kotibi';
  if (n.includes('rektor')) return 'rektor';
  if (n.includes('oqituvchi')) return 'oqituvchi';
  if (n.includes('azo')) return 'ilmiy_kengash_azosi';
  return null;
}

export function roleFromPermissions(can: {
  (permission: string): boolean;
  any: (permissions: string[]) => boolean;
}): CouncilRole {
  if (can.any(['rankApplication:approve', 'councilMember:create'])) return 'ilmiy_kengash_kotibi';
  if (can('rankApplication:create')) return 'oqituvchi';
  if (can('anonymousVote:create')) return 'ilmiy_kengash_azosi';
  if (can('votingSession:export')) return 'rektor';
  return 'ilmiy_kengash_kotibi';
}

export function useCouncilRole(): CouncilRole {
  const roleName = useSessionStore((s) => s.user?.roles?.[0]?.name);
  const can = usePermission();

  const byName = roleName ? roleFromName(roleName) : null;
  return byName ?? roleFromPermissions(can);
}
