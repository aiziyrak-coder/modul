import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPaginated, getApiErrorMessage, patchJson, type Paginated } from '@/shared/api';
import { mapHrProfileDetail, mapHrProfileListItem, type BackendHrProfile } from './mapper';
import type { HrProfileDetail } from '../model/types';

const HR_PROFILE_KEY = 'hrProfileApproval';
const ROOT = '/teachers';

export interface HrProfilesFilter {
  page: number;
  limit: number;
  hrApprovalStatus?: string;
  department?: string;
}

export function useHrProfiles(filter: HrProfilesFilter) {
  return useQuery({
    queryKey: [HR_PROFILE_KEY, 'paginate', filter],
    queryFn: async () => {
      const params: Record<string, unknown> = { page: filter.page, limit: filter.limit };
      if (filter.hrApprovalStatus) params['hrApprovalStatus'] = filter.hrApprovalStatus;
      if (filter.department) params['department'] = filter.department;

      const res: Paginated<BackendHrProfile> = await fetchPaginated(
        `${ROOT}/paginate`,
        params as { page: number; limit: number; [key: string]: unknown },
      );
      return {
        items: res.docs.map(mapHrProfileListItem),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs },
      };
    },
  });
}

export function useHrProfile(id: string | undefined) {
  return useQuery<HrProfileDetail>({
    queryKey: [HR_PROFILE_KEY, 'detail', id],
    queryFn: async () => {
      if (!id) throw new Error('id kerak');
      const { apiClient } = await import('@/shared/api');
      const res = await apiClient.get<BackendHrProfile>(`${ROOT}/${id}`);
      return mapHrProfileDetail(res.data);
    },
    enabled: Boolean(id),
  });
}

export function useApproveHrProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) =>
      patchJson<{ message: string }>(`${ROOT}/${id}/approve`, comment ? { comment } : {}),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: [HR_PROFILE_KEY] });
      void qc.invalidateQueries({ queryKey: [HR_PROFILE_KEY, 'detail', id] });
    },
  });
}

export function useRejectHrProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      patchJson<{ message: string }>(`${ROOT}/${id}/reject`, { comment }),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: [HR_PROFILE_KEY] });
      void qc.invalidateQueries({ queryKey: [HR_PROFILE_KEY, 'detail', id] });
    },
  });
}

export { getApiErrorMessage };
