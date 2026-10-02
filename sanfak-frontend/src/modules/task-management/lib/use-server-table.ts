import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiErrorMessage, type Paginated } from '@/shared/api';
import { normalizeSearch } from './use-debounced';

export type TableFilters = Record<string, string | number | undefined>;
export interface TableSort {
  field: string;
  order: 'asc' | 'desc';
}
export type TableFetcher<T> = (params: TableFilters) => Promise<Paginated<T>>;

const clean = (f: TableFilters = {}): TableFilters => {
  const o: TableFilters = {};
  for (const [k, v] of Object.entries(f)) {
    const value = typeof v === 'string' ? normalizeSearch(v) : v;
    if (value !== undefined && value !== null && value !== '') o[k] = value;
  }
  return o;
};

export function useServerTable<T>(
  fetcher: TableFetcher<T>,
  { initialLimit = 10, initialFilters = {} }: { initialLimit?: number; initialFilters?: TableFilters } = {},
) {
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);
  const [filters, setFiltersState] = useState<TableFilters>(initialFilters);
  const [sort, setSortState] = useState<TableSort | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const res = await fetcherRef.current({
        page,
        limit,
        ...clean(filters),
        ...(sort ? { sort: sort.field, order: sort.order } : {}),
      });
      if (id === reqId.current) {
        setRows(res?.docs ?? []);
        setTotal(res?.totalDocs ?? 0);
        setError(null);
      }
    } catch (e) {
      if (id === reqId.current) {
        setRows([]);
        setTotal(0);
        setError(getApiErrorMessage(e, "Ma'lumotni yuklab bo'lmadi"));
      }
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [page, limit, filters, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilter = (patch: TableFilters) => {
    setPage(1);
    setFiltersState((f) => ({ ...f, ...patch }));
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

  const setSort = (field: string | null, order: 'asc' | 'desc' | null) => {
    setPage(1);
    setSortState(field && order ? { field, order } : null);
  };

  return {
    rows,
    total,
    page,
    limit,
    filters,
    sort,
    loading,
    error,
    setPage,
    setLimit,
    setFilter,
    resetFilters,
    setSort,
    reload: load,
  };
}
