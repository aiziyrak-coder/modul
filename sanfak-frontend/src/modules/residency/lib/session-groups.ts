import { useMemo } from 'react';
import { useGroups, useMyResidents, useResidents } from '../api/residency-api';
import type { RefOption, Resident } from '../api/types';

export const SESSION_RESIDENT_FILTER = { program: 'ordinatura', status: 'oquvda' } as const;

export function groupsFromResidents(residents: readonly Resident[]): RefOption[] {
  const byId = new Map<string, string>();
  for (const r of residents) {
    if (!r.groupId || byId.has(r.groupId)) continue;
    byId.set(r.groupId, r.groupTitle ?? 'Nomsiz guruh');
  }
  return [...byId.entries()]
    .map(([id, title]) => ({ id, title }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function residentNamesInGroup(residents: readonly Resident[], groupId: string): string[] {
  return residents
    .filter((r) => r.groupId === groupId)
    .map((r) => r.fullName)
    .sort((a, b) => a.localeCompare(b));
}

export interface GroupOptionsState {
  options: RefOption[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

export function useSessionGroupOptions(isOffice: boolean): GroupOptionsState {
  const officeQ = useGroups(isOffice);
  const teacherQ = useMyResidents(SESSION_RESIDENT_FILTER, !isOffice);
  const residents = teacherQ.data;
  const teacherOptions = useMemo(() => groupsFromResidents(residents ?? []), [residents]);
  const q = isOffice ? officeQ : teacherQ;
  return {
    options: isOffice ? (officeQ.data ?? []) : teacherOptions,
    isLoading: q.isLoading,
    isError: q.isError,
    error: q.error,
    refetch: () => void q.refetch(),
  };
}

export interface RosterPreview {
  count: number | null;
  names: string[] | null;
  isLoading: boolean;
}

export function useRosterPreview(group: string, isOffice: boolean): RosterPreview {
  const teacherQ = useMyResidents(SESSION_RESIDENT_FILTER, !isOffice);
  const officeQ = useResidents(
    { group, ...SESSION_RESIDENT_FILTER, limit: 1 },
    isOffice && !!group,
  );
  const residents = teacherQ.data;
  const names = useMemo(
    () => (residents && group ? residentNamesInGroup(residents, group) : null),
    [residents, group],
  );
  if (!group) return { count: null, names: null, isLoading: false };
  if (isOffice) {
    const fresh = officeQ.data && !officeQ.isPlaceholderData ? officeQ.data : null;
    return {
      count: fresh ? fresh.total : null,
      names: null,
      isLoading: !fresh && officeQ.isFetching,
    };
  }
  return { count: names ? names.length : null, names, isLoading: teacherQ.isLoading };
}
