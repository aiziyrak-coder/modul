import { useQuery } from '@tanstack/react-query';
import { fetchPaginated, type Paginated } from '@/shared/api';
import { mapTestResultDetail, type BackendTestResult } from './test-result-mapper';

const ENTRANCE = '/qualification-access-test-results';
const EXIT = '/qualification-exit-test-results';

export interface TestFilter {
  page: number;
  limit: number;
  course?: string;
  form?: number;
  [key: string]: unknown;
}

function usePaginatedResults(key: string, root: string, filter: TestFilter, enabled: boolean) {
  return useQuery({
    staleTime: 0,
    queryKey: [key, 'paginate', filter],
    queryFn: async () => {
      const res: Paginated<BackendTestResult> = await fetchPaginated(`${root}/paginate`, filter);
      return {
        items: res.docs.map(mapTestResultDetail),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs, totalPages: res.totalPages },
      };
    },
    enabled,
  });
}

export const useEntranceResultsPaginated = (filter: TestFilter, enabled = true) =>
  usePaginatedResults('qual-access-result', ENTRANCE, filter, enabled);
export const useExitResultsPaginated = (filter: TestFilter, enabled = true) =>
  usePaginatedResults('qual-exit-result', EXIT, filter, enabled);
