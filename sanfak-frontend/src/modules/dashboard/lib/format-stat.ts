import type { StatValue } from '../api/dashboard-api';

export function formatStat(s: StatValue): string {
  if (s.value === null) return '—';
  if (s.format !== 'money') return String(s.value);

  const v = s.value;
  if (v === 0) return "0 so'm";

  const bir = (n: number, birlik: string) => {
    const t = n.toFixed(2).replace(/\.?0+$/, '');
    return `${t} ${birlik}`;
  };

  if (v >= 1_000_000_000) return bir(v / 1_000_000_000, "mlrd so'm");
  if (v >= 1_000_000) return bir(v / 1_000_000, "mln so'm");
  return `${v.toLocaleString('uz-UZ').replace(/,/g, ' ')} so'm`;
}
