import { AxiosError } from 'axios';

export type QueryState = { isLoading: boolean; isError: boolean; error: unknown };
export type NoticeState = 'loading' | 'forbidden' | 'error' | 'ok';

export function combineState(queries: QueryState[]): NoticeState {
  if (queries.some((q) => q.isLoading)) return 'loading';
  const failed = queries.filter((q) => q.isError);
  if (failed.length === 0) return 'ok';
  const allForbidden = failed.every(
    (q) => q.error instanceof AxiosError && q.error.response?.status === 403,
  );
  return allForbidden ? 'forbidden' : 'error';
}
