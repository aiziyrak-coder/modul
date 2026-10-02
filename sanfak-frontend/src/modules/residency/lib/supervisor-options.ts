export function supervisorDepartmentLimit(
  isOffice: boolean,
  resident: { departmentId: string | null } | null | undefined,
): string | null {
  if (isOffice) return null;
  return resident?.departmentId ?? null;
}

export function limitSupervisorOptions<T extends { departmentId: string | null }>(
  options: readonly T[],
  limit: string | null,
): readonly T[] {
  if (!limit) return options;
  return options.filter((u) => u.departmentId === limit);
}
