import type { MenuNode } from '@/app/modules/build-menu';

export interface ActiveMenuEntry {
  path: string;
  title: string;
}

function pathMatches(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

function flattenEntries(nodes: readonly MenuNode[]): ActiveMenuEntry[] {
  const out: ActiveMenuEntry[] = [];
  for (const node of nodes) {
    out.push({ path: node.path, title: node.title });
    for (const child of node.children) {
      out.push({ path: child.path, title: child.title });
    }
  }
  return out;
}

export function findActiveMenuEntry(
  nodes: readonly MenuNode[],
  pathname: string,
): ActiveMenuEntry | undefined {
  let best: ActiveMenuEntry | undefined;
  for (const entry of flattenEntries(nodes)) {
    if (!pathMatches(pathname, entry.path)) continue;
    if (!best || entry.path.length > best.path.length) best = entry;
  }
  return best;
}
