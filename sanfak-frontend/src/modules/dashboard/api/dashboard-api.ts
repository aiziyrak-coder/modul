import { useQueries } from '@tanstack/react-query';
import { usePermission } from '@/app/session';
import { fetchOne, fetchPaginated } from '@/shared/api';
import { statPermission, type ModuleCard, type StatSource } from '../model/registry';

export interface StatValue {
  label: string;
  value: number | null;
  format?: 'number' | 'money';
  tone?: 'good' | 'critical';
}

export interface CardStats {
  cardKey: string;
  loading: boolean;
  stats: StatValue[];
}

function pick(obj: unknown, path: string): number | null {
  let cur: unknown = obj;
  for (const key of path.split('.')) {
    if (typeof cur !== 'object' || cur === null) return null;
    cur = (cur as Record<string, unknown>)[key];
  }
  return typeof cur === 'number' ? cur : null;
}

async function valueOf(src: StatSource): Promise<number | null> {
  try {
    if (src.field) {
      const res = await fetchOne<unknown>(src.url, src.params);
      return pick(res, src.field);
    }
    const res = await fetchPaginated<unknown>(src.url, { page: 1, limit: 1, ...src.params });
    return typeof res.totalDocs === 'number' ? res.totalDocs : null;
  } catch {
    return null;
  }
}

export function useCardStats(cards: readonly ModuleCard[]): Record<string, CardStats> {
  const can = usePermission();
  const flat = cards.flatMap((c) =>
    c.stats.map((s) => ({ cardKey: c.key, src: s, cardPermission: c.permission })),
  );

  const results = useQueries({
    queries: flat.map(({ cardKey, src, cardPermission }) => ({
      queryKey: ['dashboard', 'stat', cardKey, src.url, src.field ?? '', src.params ?? {}],
      queryFn: () => valueOf(src),
      staleTime: 60_000,
      retry: false,
      enabled: can(statPermission(src.url, cardPermission)),
    })),
  });

  const byCard: Record<string, CardStats> = {};
  for (const c of cards) byCard[c.key] = { cardKey: c.key, loading: false, stats: [] };

  flat.forEach(({ cardKey, src }, i) => {
    const r = results[i];
    const entry = byCard[cardKey];
    if (!entry) return;
    if (r?.isLoading) entry.loading = true;
    entry.stats.push({
      label: src.label,
      value: (r?.data as number | null | undefined) ?? null,
      format: src.format,
      tone: src.tone,
    });
  });

  return byCard;
}
