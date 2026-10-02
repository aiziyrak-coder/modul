import type { DeptRefOption, StaffOption } from '../api/science-council-api';

export interface CascadeState {
  divisionId?: string;
  facultyId?: string;
  departmentId?: string;
}

export function resolveCascade(
  staffId: string | undefined,
  allStaff: StaffOption[],
  allDepts: DeptRefOption[],
): CascadeState {
  if (!staffId) return {};
  const staff = allStaff.find((s) => s.id === staffId);
  if (!staff) return {};
  if (staff.divisionId) return { divisionId: staff.divisionId };
  if (staff.departmentId) {
    const dept = allDepts.find((d) => d.id === staff.departmentId);
    if (dept?.facultyId) {
      return { facultyId: dept.facultyId, departmentId: staff.departmentId };
    }
  }
  return {};
}

export function staffToOption(s: StaffOption) {
  return {
    value: s.id,
    label: s.position ? `${s.name} — ${s.position}` : s.name,
  };
}

export function staffOptionsFor(
  allStaff: StaffOption[],
  division: string | undefined,
  dept: string | undefined,
  faculty: string | undefined,
  facultyDepts: { id: string }[],
) {
  const deptIds = new Set(facultyDepts.map((d) => d.id));
  if (division) return allStaff.filter((s) => s.divisionId === division).map(staffToOption);
  if (dept) return allStaff.filter((s) => s.departmentId === dept).map(staffToOption);
  if (faculty) return allStaff.filter((s) => deptIds.has(s.departmentId)).map(staffToOption);
  return allStaff.map(staffToOption);
}

export function isCascadeNarrowedEmpty(
  optionsCount: number,
  division?: string,
  dept?: string,
  faculty?: string,
): boolean {
  const narrowed = !!(division || dept || faculty);
  return narrowed && optionsCount === 0;
}
