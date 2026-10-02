import { describe, expect, it, vi } from 'vitest';
import { fetchAllPages, type PaginateEnvelope } from './paginate';

function pager(pages: string[][], totalPages?: number) {
  return vi.fn(
    async (page: number): Promise<PaginateEnvelope<string>> => ({
      docs: pages[page - 1] ?? [],
      ...(totalPages === undefined ? {} : { totalPages }),
    }),
  );
}

describe('fetchAllPages', () => {
  it('`totalPages` > 1 bo\u2018lsa qolgan sahifalarni ham oladi', async () => {
    const fetchPage = pager([['a', 'b'], ['c', 'd'], ['e']], 3);

    await expect(fetchAllPages(fetchPage)).resolves.toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage.mock.calls.map(([p]) => p)).toEqual([1, 2, 3]);
  });

  it('bitta sahifa bo\u2018lsa qo\u2018shimcha so\u2018rov qilmaydi', async () => {
    const fetchPage = pager([['a']], 1);

    await expect(fetchAllPages(fetchPage)).resolves.toEqual(['a']);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('`totalPages` umuman bo\u2018lmasa eski xatti-harakat (faqat 1-sahifa)', async () => {
    const fetchPage = pager([['a'], ['b']]);

    await expect(fetchAllPages(fetchPage)).resolves.toEqual(['a']);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('`pageCap` cheksiz so\u2018rovdan himoya qiladi', async () => {
    const fetchPage = pager([['a'], ['b'], ['c'], ['d']], 999);

    await expect(fetchAllPages(fetchPage, 2)).resolves.toEqual(['a', 'b']);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("bo\u2018sh `docs` yiqilishga olib kelmaydi", async () => {
    const fetchPage = vi.fn(async (): Promise<PaginateEnvelope<string>> => ({}));

    await expect(fetchAllPages(fetchPage)).resolves.toEqual([]);
  });
});
