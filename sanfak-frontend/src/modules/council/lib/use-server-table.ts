import { useCallback, useEffect, useRef, useState } from 'react';
import type { Paginated } from '@/shared/api';

export type TableFilters = Record<string, string | number | undefined>;
export type TableFetcher<T> = (params: TableFilters) => Promise<Paginated<T>>;

const clean = (f: TableFilters = {}): TableFilters => {
  const o: TableFilters = {};
  for (const [k, v] of Object.entries(f)) {
    if (v !== undefined && v !== null && v !== '') o[k] = v;
  }
  return o;
};

export function useServerTable<T>(
  fetcher: TableFetcher<T>,
  { initialLimit = 12, initialFilters = {} }: { initialLimit?: number; initialFilters?: TableFilters } = {},
) {
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimitState] = useState(initialLimit);
  const [filters, setFiltersState] = useState<TableFilters>(initialFilters);
  const [loading, setLoading] = useState(false);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const res = await fetcherRef.current({ page, limit, ...clean(filters) });
      if (id === reqId.current) {
        setRows(res?.docs ?? []);
        setTotal(res?.totalDocs ?? 0);
      }
    } catch {
      if (id === reqId.current) {
        setRows([]);
        setTotal(0);
      }
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [page, limit, filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const setLimit = (next: number) => {
    setPage(1);
    setLimitState(next);
  };

  const resetFilters = useCallback((next: TableFilters = {}) => {
    const cleanedNext = clean(next);
    setFiltersState((prev) => {
      const cleanedPrev = clean(prev);
      const pk = Object.keys(cleanedPrev);
      const nk = Object.keys(cleanedNext);
      const same = pk.length === nk.length && pk.every((k) => cleanedPrev[k] === cleanedNext[k]);
      return same ? prev : cleanedNext;
    });
    setPage(1);
  }, []);

  return {
    rows,
    total,
    page,
    limit,
    filters,
    loading,
    setPage,
    setLimit,
    resetFilters,
    reload: load,
  };
}
