import { useSessionStore } from '@/app/session';

export const VERIFIER_PERMISSION = 'personalWorkPlan:review';

export function useIsVerifier(): boolean {
  const permissions = useSessionStore((s) => s.permissions);

  if (permissions.includes('*')) return true;
  return permissions.includes(VERIFIER_PERMISSION);
}
