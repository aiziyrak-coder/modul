import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchPaginated = vi.fn();
vi.mock('@/shared/api', () => ({ fetchPaginated: (...args: unknown[]) => fetchPaginated(...args) }));

const { fetchAllPages, EXPORT_PAGE_SIZE } = await import('./fetch-all-pages');

describe('fetchAllPages (D-31)', () => {
  beforeEach(() => fetchPaginated.mockReset());

  it('barcha sahifalar joriy filtr bilan o`qiladi va birlashtiriladi', async () => {
    fetchPaginated
      .mockResolvedValueOnce({ docs: [{ n: 1 }, { n: 2 }], totalPages: 2 })
      .mockResolvedValueOnce({ docs: [{ n: 3 }], totalPages: 2 });

    const all = await fetchAllPages<{ n: number }, number>('/groups/paginate', { course: 2 }, (b) => b.n);

    expect(all).toEqual([1, 2, 3]);
    expect(fetchPaginated).toHaveBeenCalledTimes(2);
    expect(fetchPaginated).toHaveBeenNthCalledWith(1, '/groups/paginate', {
      course: 2,
      page: 1,
      limit: EXPORT_PAGE_SIZE,
    });
    expect(fetchPaginated.mock.calls[1]?.[1]).toMatchObject({ page: 2 });
  });

  it('bo`sh sahifada to`xtaydi', async () => {
    fetchPaginated.mockResolvedValueOnce({ docs: [], totalPages: 5 });
    expect(await fetchAllPages('/x', {}, (b) => b)).toEqual([]);
    expect(fetchPaginated).toHaveBeenCalledTimes(1);
  });
});
