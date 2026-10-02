export const DEPARTMENT_LEVEL_ROLES = ['kafedra_mudiri'] as const;

export function isInstituteViewer(role: string | undefined, isSuper: boolean): boolean {
  if (isSuper) return true;
  return !(DEPARTMENT_LEVEL_ROLES as readonly string[]).includes(role ?? '');
}

export function canCreateContingent(hasCreatePermission: boolean, isSuper: boolean): boolean {
  return hasCreatePermission && !isSuper;
}
