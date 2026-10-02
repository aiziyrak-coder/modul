import { useCallback } from 'react';
import { useSessionStore } from '@/app/session';
import type { ApprovalStep } from '../distribution/model/types';

export const DISTRIBUTION_STEP_ROLES: Record<string, string> = {
  kafedra: 'kafedra_mudiri',
  methodical: 'oquv_uslubiy_boshqarma',
  financial: 'reja_moliya',
  dean: 'dekan',
  prorektor: 'prorektor',
};

export const WORKING_SCHEDULE_STEP_ROLES: Record<string, string> = {
  methodical: 'oquv_uslubiy_boshqarma',
  dean: 'dekan',
  prorektor: 'prorektor',
  rektor: 'rektor',
};

export const SYLLABUS_STEP_ROLES: Record<string, string> = {
  kafedra: 'kafedra_mudiri',
  arm: 'arm',
  methodical: 'oquv_uslubiy_boshqarma',
  dean: 'dekan',
  prorektor: 'prorektor',
};

export const SCIENCE_PROGRAM_STEP_ROLES: Record<string, string> = {
  teacher: 'oqituvchi',
  kafedra: 'kafedra_mudiri',
  arm: 'arm',
  methodical: 'oquv_uslubiy_boshqarma',
  prorektor: 'prorektor',
  rektor: 'rektor',
  dean: 'dekan',
};

export const SYLLABUS_SUBMIT_ROLE = 'oqituvchi';
export const SCIENCE_PROGRAM_SUBMIT_ROLE = 'oqituvchi';

export function useIsMyStep(
  currentStep: string | null | undefined,
  stepRoles: Record<string, string>,
): boolean {
  const permissions = useSessionStore((s) => s.permissions);
  const roles = useSessionStore((s) => s.user?.roles);
  return isStepMine(currentStep, stepRoles, roles, permissions);
}

export function isStepMine(
  currentStep: string | null | undefined,
  stepRoles: Record<string, string>,
  roles: { name: string }[] | undefined,
  permissions: string[],
): boolean {
  if (permissions.includes('*')) return true;
  if (!currentStep || !roles?.length) return false;

  const required = stepRoles[String(currentStep)];
  if (!required) return false;

  return roles.some((r) => r.name === required);
}

export function useChainRowGate(
  stepRoles: Record<string, string>,
  submitRole: string,
): (status: string, currentStep: string | null | undefined) => boolean {
  const permissions = useSessionStore((s) => s.permissions);
  const roles = useSessionStore((s) => s.user?.roles);

  return useCallback(
    (status: string, currentStep: string | null | undefined) => {
      if (status === 'approved' || status === 'rejected') return false;
      if (permissions.includes('*')) return true;
      if (status === 'draft' || status === 'new') {
        return Boolean(roles?.some((r) => r.name === submitRole));
      }
      return isStepMine(currentStep, stepRoles, roles, permissions);
    },
    [permissions, roles, stepRoles, submitRole],
  );
}

export function useHasRole(roleName: string): boolean {
  const permissions = useSessionStore((s) => s.permissions);
  const roles = useSessionStore((s) => s.user?.roles);

  if (permissions.includes('*')) return true;
  return Boolean(roles?.some((r) => r.name === roleName));
}

export function useHasPendingStep(
  history: ApprovalStep[] | undefined,
  stepRoles: Record<string, string>,
): boolean {
  const permissions = useSessionStore((s) => s.permissions);
  const roles = useSessionStore((s) => s.user?.roles);

  if (permissions.includes('*')) return true;
  if (!history?.length || !roles?.length) return false;

  const current = history.find((s) => s.status === 'pending');
  if (!current) return false;

  const required = stepRoles[String(current.step)];
  if (!required) return false;

  return roles.some((r) => r.name === required);
}
