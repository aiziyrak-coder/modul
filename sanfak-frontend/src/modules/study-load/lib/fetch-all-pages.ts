import { fetchPaginated } from '@/shared/api';

export const EXPORT_PAGE_SIZE = 100;
const MAX_PAGES = 200;

export async function fetchAllPages<TBackend, T>(
  url: string,
  params: Record<string, unknown>,
  map: (b: TBackend) => T,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const res = await fetchPaginated<TBackend>(url, { ...params, page, limit: EXPORT_PAGE_SIZE });
    const docs = Array.isArray(res.docs) ? res.docs : [];
    out.push(...docs.map(map));
    if (docs.length === 0 || page >= (res.totalPages ?? 1)) break;
  }
  return out;
}
