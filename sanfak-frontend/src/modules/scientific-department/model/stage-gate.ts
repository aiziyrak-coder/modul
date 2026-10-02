import { useMemo } from 'react';
import { usePermission, useSessionStore } from '@/app/session';
import type { ArticleStatus } from './types';

export function useStageActionable(permSection: 'departmentWorkPlan' | 'annualReport'): {
  canApprove: (status: ArticleStatus) => boolean;
  canReject: (status: ArticleStatus) => boolean;
} {
  const can = usePermission();
  const user = useSessionStore((s) => s.user);
  const roleNames = useMemo(() => (user?.roles ?? []).map((r) => r.name), [user]);
  const canApprovePerm = can(`${permSection}:approve`);
  const canRejectPerm = can(`${permSection}:reject`);

  const stageOk = (status: ArticleStatus, hasPerm: boolean): boolean => {
    if (!hasPerm) return false;
    if (roleNames.includes('super_admin') || roleNames.includes('admin')) {
      return status === 'new' || status === 'pending';
    }
    if (roleNames.includes('dekan')) return status === 'new';
    if (roleNames.includes('prorektor')) return status === 'pending';
    return false;
  };

  return {
    canApprove: (status) => stageOk(status, canApprovePerm),
    canReject: (status) => stageOk(status, canRejectPerm),
  };
}
