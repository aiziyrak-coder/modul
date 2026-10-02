import { hasAnyPermission } from '@/shared/lib/rbac';

export const EXTRA_MENU_GATES: Record<string, readonly string[]> = {
  '/residency/chat': ['chat:readAll'],
};

interface GatedItem {
  path: string;
}

export const applyExtraGates = <T extends GatedItem>(
  items: readonly T[],
  granted: readonly string[],
): T[] =>
  items.filter((item) => {
    const required = EXTRA_MENU_GATES[item.path];
    if (!required) return true;
    return hasAnyPermission(granted, required);
  });
