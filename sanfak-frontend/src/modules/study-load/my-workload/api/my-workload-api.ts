import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiErrorMessage } from '@/shared/api';
import { mapMyDistribution } from './mapper';
import type { MyWorkload, RespondWorkloadPayload } from '../model/types';
import type { BackendMyDistribution } from './mapper';

const MY_WORKLOAD_KEY = 'myWorkloadDistributions';
const ROOT = '/distributions';

export function useMyWorkloads() {
  return useQuery<MyWorkload[]>({
    queryKey: [MY_WORKLOAD_KEY],
    queryFn: async () => {
      const { apiClient } = await import('@/shared/api');
      const res = await apiClient.get<BackendMyDistribution[]>(`${ROOT}/my`);
      const raw = Array.isArray(res.data) ? res.data : [];
      return raw.map(mapMyDistribution);
    },
  });
}

export function useRespondWorkload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      distributionId,
      teacherEntryId,
      payload,
    }: {
      distributionId: string;
      teacherEntryId: string;
      payload: RespondWorkloadPayload;
    }) => {
      const { apiClient } = await import('@/shared/api');
      const res = await apiClient.patch(
        `${ROOT}/${distributionId}/teachers/${teacherEntryId}/respond`,
        payload,
      );
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [MY_WORKLOAD_KEY] }),
  });
}

export { getApiErrorMessage };
