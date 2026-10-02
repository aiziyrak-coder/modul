import type { MenuGroup, MenuNode } from '@/app/modules/build-menu';

export function firstReachablePath(
  groups: readonly MenuGroup[],
  deprioritised: readonly string[] = [],
): string | null {
  const fromNodes = (nodes: readonly MenuNode[]): string | null => {
    for (const node of nodes) {
      if (node.children.length > 0) {
        const nested = fromNodes(node.children);
        if (nested) return nested;
        continue;
      }
      if (node.path) return node.path;
    }
    return null;
  };

  const ranked = [
    ...groups.filter((g) => !deprioritised.includes(g.key)),
    ...groups.filter((g) => deprioritised.includes(g.key)),
  ];

  for (const group of ranked) {
    const hit = fromNodes(group.nodes);
    if (hit) return hit;
  }
  return null;
}
