export const ELLIPSIS = '…' as const;

export type PageSlot = number | typeof ELLIPSIS;

export const MAX_SLOTS = 7;

export function pageWindow(current: number, total: number): PageSlot[] {
  if (!Number.isFinite(total) || total < 1) return [];
  const last = Math.floor(total);
  if (last <= MAX_SLOTS) {
    return Array.from({ length: last }, (_, i) => i + 1);
  }

  const c = Math.min(Math.max(Math.floor(current) || 1, 1), last);

  if (c <= 4) return [1, 2, 3, 4, 5, ELLIPSIS, last];
  if (c >= last - 3) return [1, ELLIPSIS, last - 4, last - 3, last - 2, last - 1, last];
  return [1, ELLIPSIS, c - 1, c, c + 1, ELLIPSIS, last];
}
