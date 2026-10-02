import { useMemo } from 'react';
import { useSessionStore } from '@/app/session';
import type { ApprovalStep, ApprovalStepKey } from '../model/types';
import type { ReportApprovalStep, ReportApprovalStepKey } from '../model/report-types';

export const ROLE_STEP: Record<string, ApprovalStepKey> = {
  oqituvchi: 'teacher',
  kafedra_uslubiy_masul: 'kafedraUslubiy',
  kafedra_ilmiy_masul: 'kafedraIlmiy',
  kafedra_ustoz_shogird_masul: 'kafedraUstozShogird',
  kafedra_mudiri: 'kafedraMudiri',
  oquv_uslubiy_boshqarma: 'oquvUslubiy',
  dekan: 'dekan',
  ichki_nazorat: 'ichkiNazorat',
};

export function useHasPendingStep(approvals: ApprovalStep[] | undefined): boolean {
  const permissions = useSessionStore((s) => s.permissions);
  const roles = useSessionStore((s) => s.user?.roles);

  if (permissions.includes('*')) return true;
  if (!approvals?.length || !roles?.length) return false;

  const mySteps = roles.map((r) => ROLE_STEP[r.name]).filter(Boolean);
  if (mySteps.length === 0) return false;

  return approvals.some((a) => mySteps.includes(a.step) && a.status === 'pending');
}

export interface MyApprovalSteps {
  stepKeys: ApprovalStepKey[];
  showAll: boolean;
}

export function useMyApprovalStepKeys(): MyApprovalSteps {
  const permissions = useSessionStore((s) => s.permissions);
  const roles = useSessionStore((s) => s.user?.roles);

  return useMemo(() => {
    const stepKeys = (roles ?? [])
      .map((r) => ROLE_STEP[r.name])
      .filter((key): key is ApprovalStepKey => Boolean(key));

    return { stepKeys, showAll: permissions.includes('*') };
  }, [permissions, roles]);
}

export const REPORT_ROLE_STEP: Record<string, ReportApprovalStepKey> = {
  dekan: 'dekan',
  fakultet_kengash_kotibi: 'kotib',
};

export function useHasPendingReportStep(
  approvals: ReportApprovalStep[] | undefined,
): boolean {
  const permissions = useSessionStore((s) => s.permissions);
  const roles = useSessionStore((s) => s.user?.roles);

  if (permissions.includes('*')) return true;
  if (!approvals?.length || !roles?.length) return false;

  const mySteps = roles.map((r) => REPORT_ROLE_STEP[r.name]).filter(Boolean);
  if (mySteps.length === 0) return false;

  return approvals.some((a) => mySteps.includes(a.step) && a.status === 'pending');
}

export const COMPLETE_ROLE = 'ichki_nazorat';

export function useCanCompletePlan(): boolean {
  const permissions = useSessionStore((s) => s.permissions);
  const roles = useSessionStore((s) => s.user?.roles);

  if (permissions.includes('*')) return true;
  return Boolean(roles?.some((r) => r.name === COMPLETE_ROLE));
}
