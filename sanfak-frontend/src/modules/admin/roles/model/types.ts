export interface RolePermission {
  section: string;
  actionKeys: string[];
}

export type ScopeLevel = 'global' | 'faculty' | 'department' | 'self';

export interface AdminRole {
  id: string;
  title: string;
  desc: string;
  permissions: RolePermission[];
  scopeLevel: ScopeLevel;
  isSystem: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminRoleInput {
  title: string;
  desc?: string;
  permissions: RolePermission[];
  scopeLevel: ScopeLevel;
  active?: boolean;
}

export interface PermissionSection {
  section: string;
  title?: string;
  actionKeys: string[];
}

export interface PermissionGroup {
  _id: string;
  code: string;
  title: string;
  desc?: string;
  permissions: PermissionSection[];
}

export interface SectionsGroupedResponse {
  groups: PermissionGroup[];
  ungrouped: PermissionSection[];
  actions: string[];
  totalGroups: number;
  totalPermissions: number;
}
