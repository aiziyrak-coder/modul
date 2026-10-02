import type { RolePermission } from './types';

export type PermissionSetMap = Record<string, Set<string>>;

export function permissionsToMap(list: RolePermission[]): PermissionSetMap {
  const map: PermissionSetMap = {};
  for (const p of list) map[p.section] = new Set(p.actionKeys);
  return map;
}

export function mapToPermissions(map: PermissionSetMap): RolePermission[] {
  return Object.entries(map)
    .filter(([, set]) => set.size > 0)
    .map(([section, set]) => ({ section, actionKeys: Array.from(set) }));
}
