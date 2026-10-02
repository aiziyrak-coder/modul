import { useCallback } from 'react';
import { useSessionStore } from '@/app/session';

export interface StepLike {
  step: string | number;
}

export const FIXED_FINAL_STEP = {
  workingSchedule: 'rektor',
  workload: 'rektor',
  workloadDistribution: 'prorektor',
  syllabus: 'prorektor',
  workloadSummary: 'rektor',
  contingentReport: 'dean',
} as const;

export function finalStep(steps: readonly StepLike[] | null | undefined): string | null {
  const last = steps?.at(-1);
  return last ? String(last.step) : null;
}

export function finalStepRole(
  steps: readonly StepLike[] | null | undefined,
  stepRoles: Record<string, string>,
  fallbackStep?: string | null,
): string | null {
  const key = finalStep(steps) ?? fallbackStep ?? null;
  if (!key) return null;
  return stepRoles[key] ?? null;
}

export function scienceProgramFinalStep(formVersion: string | null | undefined): string | null {
  return formVersion === 'v142' ? 'dean' : null;
}

export const SCIENCE_PROGRAM_V259_FINAL_CANDIDATES = ['dean', 'rektor'] as const;

export type FixedFinalEntity = keyof typeof FIXED_FINAL_STEP;

export const DEFAULT_REVOCABLE_STATUSES: readonly string[] = ['approved'];

const REVOCABLE_STATUSES_OPT_IN: Partial<Record<string, readonly string[]>> = {
  workload: ['approved', 'superseded'],
  workloadSummary: ['approved', 'superseded'],
};

export function revocableStatuses(entity?: string | null): readonly string[] {
  return (entity ? REVOCABLE_STATUSES_OPT_IN[entity] : undefined) ?? DEFAULT_REVOCABLE_STATUSES;
}

export interface RevocableDoc {
  status: string;
  finalRole: string | null;
  entity?: string;
}

export function canRevokeFinal(
  doc: RevocableDoc,
  myRoles: readonly string[] | null | undefined,
  isSuper: boolean,
  statuses: readonly string[] = revocableStatuses(doc.entity),
): boolean {
  if (!statuses.includes(doc.status)) return false;
  if (isSuper) return true;
  if (!doc.finalRole) return false;
  return (myRoles ?? []).includes(doc.finalRole);
}

export function useRevokeFinalGate(entity?: FixedFinalEntity): (doc: RevocableDoc) => boolean {
  const permissions = useSessionStore((s) => s.permissions);
  const roles = useSessionStore((s) => s.user?.roles);
  const statuses = entity ? revocableStatuses(entity) : undefined;
  return useCallback(
    (doc: RevocableDoc) =>
      canRevokeFinal(
        doc,
        roles?.map((r) => r.name),
        permissions.includes('*'),
        statuses,
      ),
    [permissions, roles, statuses],
  );
}

export interface VisibleRevokeDependent {
  hidden: false;
  type: string;
  id: string;
  title: string | null;
  status: string;
}

export interface HiddenRevokeDependent {
  hidden: true;
  type: string;
  count: number;
}

export type RevokeDependent = VisibleRevokeDependent | HiddenRevokeDependent;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

export function extractRevokeDependents(error: unknown): RevokeDependent[] {
  if (!isRecord(error) || !isRecord(error.response)) return [];
  const { status, data } = error.response;
  if (status !== 409 || !isRecord(data) || !Array.isArray(data.dependents)) return [];
  return data.dependents.filter(isRecord).map((d): RevokeDependent => {
    const type = String(d.type ?? '');
    if (d.hidden === true) {
      const count = Number(d.count);
      return { hidden: true, type, count: Number.isFinite(count) && count > 0 ? count : 1 };
    }
    return {
      hidden: false,
      type,
      id: String(d.id ?? ''),
      title: typeof d.title === 'string' && d.title.trim() ? d.title : null,
      status: String(d.status ?? ''),
    };
  });
}
