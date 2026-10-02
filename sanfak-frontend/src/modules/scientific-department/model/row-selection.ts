export function selectedRows<T extends { id: string }>(
  pageRows: readonly T[],
  selectedIds: readonly string[],
  canSelect: (row: T) => boolean,
): T[] {
  return pageRows.filter((r) => selectedIds.includes(r.id) && canSelect(r));
}

export function toggleAll(
  selectedIds: readonly string[],
  pageSelectableIds: readonly string[],
  on: boolean,
): string[] {
  return on
    ? [...new Set([...selectedIds, ...pageSelectableIds])]
    : selectedIds.filter((id) => !pageSelectableIds.includes(id));
}

export function allSelected(
  selectedIds: readonly string[],
  pageSelectableIds: readonly string[],
): boolean {
  return pageSelectableIds.length > 0 && pageSelectableIds.every((id) => selectedIds.includes(id));
}
