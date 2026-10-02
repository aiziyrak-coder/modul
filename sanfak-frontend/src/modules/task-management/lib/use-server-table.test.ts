import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Paginated } from '@/shared/api';
import { useServerTable, type TableFilters } from './use-server-table';

interface Row {
  id: string;
}

const emptyPage: Paginated<Row> = {
  docs: [],
  totalDocs: 0,
  limit: 10,
  page: 1,
  totalPages: 0,
  hasNextPage: false,
  hasPrevPage: false,
  nextPage: null,
  prevPage: null,
};

describe('useServerTable', () => {
  it("bo'shliqli qidiruvni tozalab yuboradi", async () => {
    const fetcher = vi.fn<(p: TableFilters) => Promise<Paginated<Row>>>().mockResolvedValue(emptyPage);
    const { result } = renderHook(() => useServerTable<Row>(fetcher));

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    act(() => result.current.resetFilters({ search: '  Hisobot   yillik  ' }));

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    const secondCall = fetcher.mock.calls[1];
    expect(secondCall).toBeDefined();
    expect(secondCall?.[0].search).toBe('Hisobot yillik');
  });

  it("faqat bo'shliqdan iborat qidiruv FILTR emas", async () => {
    const fetcher = vi.fn<(p: TableFilters) => Promise<Paginated<Row>>>().mockResolvedValue(emptyPage);
    const { result } = renderHook(() => useServerTable<Row>(fetcher, { initialFilters: { search: '   ' } }));

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    const firstCall = fetcher.mock.calls[0];
    expect(firstCall).toBeDefined();
    expect(firstCall?.[0]).not.toHaveProperty('search');
    expect(result.current.error).toBeNull();
  });

  it("so'rov yiqilsa bo'sh jadval EMAS, xato qaytadi", async () => {
    const fetcher = vi
      .fn<(p: TableFilters) => Promise<Paginated<Row>>>()
      .mockRejectedValue(new Error('tarmoq xatosi'));
    const { result } = renderHook(() => useServerTable<Row>(fetcher));

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.rows).toEqual([]);
  });
});
