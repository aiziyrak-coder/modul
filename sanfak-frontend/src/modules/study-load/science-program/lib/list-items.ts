export const MAX_LIST_ITEMS = 30;
export const MAX_LIST_ITEM_LENGTH = 500;

export function splitPastedItems(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
