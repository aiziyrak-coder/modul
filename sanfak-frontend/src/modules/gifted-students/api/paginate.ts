export interface PaginateEnvelope<T> {
  docs?: T[];
  totalPages?: number;
}

export const LIST_PAGE_LIMIT = 1000;

export const MAX_PAGES = 20;

export async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<PaginateEnvelope<T>>,
  pageCap: number = MAX_PAGES,
): Promise<T[]> {
  const first = await fetchPage(1);
  const all: T[] = [...(first.docs ?? [])];

  const totalPages = Number(first.totalPages ?? 1);
  if (!Number.isFinite(totalPages) || totalPages <= 1) return all;

  const lastPage = Math.min(totalPages, Math.max(1, pageCap));
  if (lastPage <= 1) return all;

  const rest = await Promise.all(
    Array.from({ length: lastPage - 1 }, (_, i) => fetchPage(i + 2)),
  );
  for (const page of rest) all.push(...(page.docs ?? []));
  return all;
}
