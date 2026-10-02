import type { ReactNode } from 'react';
import type { ModuleManifest } from '@/shared/lib/module';
import { hasAnyPermission, hasPermission } from '@/shared/lib/rbac';
import { registeredModules } from './registry';

export interface MenuNode {
  path: string;
  title: string;
  icon?: ReactNode;
  order: number;
  subGroup?: string;
  subGroupOrder?: number;
  children: MenuNode[];
}

interface RawEntry {
  path: string;
  titleKey: string;
  icon?: ReactNode;
  order: number;
  permission?: string | readonly string[];
  parent?: string;
  subGroupKey?: string;
  subGroupOrder?: number;
}

function permissionSatisfied(
  granted: readonly string[],
  permission: string | readonly string[] | undefined,
): boolean {
  if (!permission) return true;
  if (typeof permission === 'string') return hasPermission(granted, permission);
  return hasAnyPermission(granted, permission);
}

function collectRawFor(manifest: ModuleManifest): RawEntry[] {
  const out: RawEntry[] = [];
  for (const item of manifest.menu ?? []) {
    out.push({
      path: item.path,
      titleKey: item.titleKey,
      icon: item.icon,
      order: item.order ?? 100,
      permission: item.permission,
      parent: item.parent,
      subGroupKey: item.subGroup?.titleKey,
      subGroupOrder: item.subGroup?.order ?? 100,
    });
  }
  return out;
}

export function buildMenuTree(
  raw: RawEntry[],
  permissions: readonly string[],
  t: (key: string) => string,
): MenuNode[] {
  const allowed = raw.filter((e) => permissionSatisfied(permissions, e.permission));

  const groupPaths = new Set<string>();
  for (const e of raw) {
    if (e.parent && e.parent !== e.path) groupPaths.add(e.parent);
  }

  const byPath = new Map<string, MenuNode>();
  for (const e of allowed) {
    if (byPath.has(e.path)) continue;
    byPath.set(e.path, {
      path: e.path,
      title: t(e.titleKey),
      icon: e.icon,
      order: e.order,
      subGroup: e.subGroupKey ? t(e.subGroupKey) : undefined,
      subGroupOrder: e.subGroupOrder,
      children: [],
    });
  }

  const roots: MenuNode[] = [];
  const placed = new Set<MenuNode>();
  for (const e of allowed) {
    const node = byPath.get(e.path);
    if (!node || placed.has(node)) continue;
    placed.add(node);

    const parent =
      e.parent && e.parent !== e.path ? byPath.get(e.parent) : undefined;
    if (parent && parent !== node) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortRec = (nodes: MenuNode[], guard: Set<MenuNode>) => {
    nodes.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
    for (const n of nodes) {
      if (guard.has(n)) continue;
      guard.add(n);
      sortRec(n.children, guard);
    }
  };
  sortRec(roots, new Set<MenuNode>());

  const prune = (nodes: MenuNode[]): MenuNode[] =>
    nodes.filter((n) => {
      n.children = prune(n.children);
      return !(groupPaths.has(n.path) && n.children.length === 0);
    });
  return prune(roots);
}

export interface MenuGroup {
  key: string;
  title: string;
  order: number;
  nodes: MenuNode[];
}

export function buildAppMenu(
  permissions: readonly string[],
  t: (key: string) => string,
): MenuGroup[] {
  const groups: MenuGroup[] = [];
  for (const { manifest } of registeredModules) {
    const nodes = buildMenuTree(collectRawFor(manifest), permissions, t);
    if (nodes.length === 0) continue;
    nodes.sort(
      (a, b) =>
        (a.subGroupOrder ?? 0) - (b.subGroupOrder ?? 0) ||
        a.order - b.order ||
        a.title.localeCompare(b.title),
    );
    groups.push({
      key: manifest.name,
      title: manifest.menuGroup ? t(manifest.menuGroup.titleKey) : manifest.name,
      order: manifest.menuGroup?.order ?? 100,
      nodes,
    });
  }
  groups.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  return groups;
}
