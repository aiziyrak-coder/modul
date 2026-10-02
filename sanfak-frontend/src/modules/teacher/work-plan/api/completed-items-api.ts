import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, fetchPaginated, getApiErrorMessage, patchJson, type Paginated } from '@/shared/api';
import { mapCompletedItem, type BackendCompletedItem } from './completed-items-mapper';
import type { CompletedItemsFilter, VerifyDecision } from '../model/completed-item-types';
import type { ActivitySection } from '../model/types';

const COMPLETED_KEY = 'personalWorkPlanCompletedItems';
const ROOT = '/personal-work-plans';

function buildFilterParams(filter: Omit<CompletedItemsFilter, 'page' | 'limit'>): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  if (filter.search) params.search = filter.search;
  if (filter.academicYear) params.academicYear = filter.academicYear;
  if (filter.verificationStatus) params.verificationStatus = filter.verificationStatus;
  return params;
}

export function useCompletedWorkItems(filter: CompletedItemsFilter) {
  return useQuery({
    queryKey: [COMPLETED_KEY, 'paginate', filter],
    queryFn: async () => {
      const params: { page: number; limit: number; [key: string]: unknown } = {
        page: filter.page,
        limit: filter.limit,
        ...buildFilterParams(filter),
      };
      const res: Paginated<BackendCompletedItem> = await fetchPaginated(`${ROOT}/completed-items`, params);
      return {
        items: res.docs.map(mapCompletedItem),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs },
      };
    },
  });
}

export async function downloadCompletedItemsExport(
  filter: Omit<CompletedItemsFilter, 'page' | 'limit'>,
): Promise<void> {
  const params = buildFilterParams(filter);
  const res = await apiClient.get(`${ROOT}/completed-items/export`, { params, responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bajarilgan-ish-rejalar.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function useVerifyWorkItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      planId,
      itemId,
      section,
      decision,
      comment,
    }: {
      planId: string;
      itemId: string;
      section: ActivitySection;
      decision: VerifyDecision;
      comment?: string;
    }) =>
      patchJson<{ message: string }>(`${ROOT}/${planId}/activity/${itemId}/verify`, {
        section,
        decision,
        comment: comment || undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [COMPLETED_KEY] }),
  });
}

export { getApiErrorMessage };
