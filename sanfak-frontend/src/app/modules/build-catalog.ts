import type { ModulePermission } from '@/shared/lib/module';
import { registeredModules } from './registry';

export interface PermissionDef extends ModulePermission {
  module: string;
}

function buildCatalog(): readonly PermissionDef[] {
  const seen = new Map<string, string>();
  const list: PermissionDef[] = [];

  for (const { folder, manifest } of registeredModules) {
    for (const perm of manifest.permissions ?? []) {
      const claimed = seen.get(perm.key);
      if (claimed) {
        throw new Error(
          `Permission key "${perm.key}" declared by both module "${claimed}" and module "${folder}".`,
        );
      }
      seen.set(perm.key, folder);
      list.push({ ...perm, module: folder });
    }
  }
  return list;
}

export const PERMISSION_CATALOG: readonly PermissionDef[] = buildCatalog();

export const ALL_PERMISSION_KEYS: readonly string[] = PERMISSION_CATALOG.map((p) => p.key);
