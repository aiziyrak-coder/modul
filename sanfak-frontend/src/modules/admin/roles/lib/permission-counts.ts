import type { PermissionGroup, PermissionSection } from '../model/types';

export interface Count {
  selected: number;
  total: number;
}

export type SelectedMap = Record<string, Set<string>>;

export const countSection = (
  section: PermissionSection,
  selectedMap: SelectedMap,
): Count => {
  const selected = selectedMap[section.section];
  if (!selected || selected.size === 0) {
    return { selected: 0, total: section.actionKeys.length };
  }
  let n = 0;
  section.actionKeys.forEach((k) => {
    if (selected.has(k)) n += 1;
  });
  return { selected: n, total: section.actionKeys.length };
};

export const countGroup = (
  group: PermissionGroup,
  selectedMap: SelectedMap,
): Count =>
  (group.permissions ?? []).reduce<Count>(
    (acc, sec) => {
      const c = countSection(sec, selectedMap);
      return { selected: acc.selected + c.selected, total: acc.total + c.total };
    },
    { selected: 0, total: 0 },
  );

export type CountState = 'none' | 'partial' | 'full';

export const countState = ({ selected, total }: Count): CountState => {
  if (selected === 0) return 'none';
  return selected >= total && total > 0 ? 'full' : 'partial';
};
