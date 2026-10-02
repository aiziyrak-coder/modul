import type { Role } from '../data/types';

const GS_CREATE = 'giftedStudent:create';
const GS_READ_ALL = 'giftedStudent:readAll';
const CHAT_CREATE = 'chat:create';
const ACH_CREATE = 'studentAchievement:create';
const APP_SCORE = 'scholarshipApplication:score';

export function surfaceFromPermissions(permissions: readonly string[] | undefined): Role | null {
  if (!permissions || permissions.length === 0) return null;
  const has = (key: string) => permissions.includes(key);

  if (has(GS_CREATE)) return 'department';
  if (has(APP_SCORE)) return 'judge';
  if (has(GS_READ_ALL)) return has(CHAT_CREATE) ? 'advisor' : 'management';
  if (has(ACH_CREATE)) return 'student';
  return null;
}
