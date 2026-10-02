export function son(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('uz-UZ').replace(/,/g, ' ');
}

export function foiz(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  const rounded = Math.round(n * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

export function dash(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : son(n);
}
