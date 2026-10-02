export function toNumberList(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw
        .map((v) => (typeof v === 'string' ? v.trim() : v))
        .filter((v) => v !== '' && v !== null && v !== undefined)
        .map((v) => Number(v))
        .filter((n) => !Number.isNaN(n)),
    ),
  ).sort((a, b) => a - b);
}
