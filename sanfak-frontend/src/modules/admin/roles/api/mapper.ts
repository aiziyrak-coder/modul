import type { AdminRole } from '../model/types';

export interface BackendRole {
  _id: string;
  title: string;
  desc: string;
  permissions: Array<{ section: string; actionKeys: string[] }>;
  scopeLevel: string;
  isSystem: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export function mapRole(b: BackendRole): AdminRole {
  return {
    id: b._id,
    title: b.title,
    desc: b.desc,
    permissions: b.permissions ?? [],
    scopeLevel: b.scopeLevel as AdminRole['scopeLevel'],
    isSystem: b.isSystem,
    active: b.active,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}
