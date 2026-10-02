import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteData,
  fetchOne,
  fetchPaginated,
  patchJson,
  postJson,
  type Paginated,
} from '@/shared/api';
import { APPROVAL_INBOX_KEY } from '../../approval-inbox/api/approval-inbox-api';
import { WORKLOAD_KEY } from '../../workload/api/workload-api';
import {
  mapWorkloadSummary,
  mapWorkloadSummaryDetail,
  type BackendWorkloadSummary,
} from './mapper';
import type { ApproveSummaryResult, CreateSummaryResult } from '../model/types';

export const WORKLOAD_SUMMARY_KEY = 'workloadSummary';
const ROOT = '/workload-summaries';

export interface WorkloadSummariesFilter {
  page: number;
  limit: number;
  academicYear?: string;
  status?: string;
}

export function useWorkloadSummaries(filter: WorkloadSummariesFilter) {
  return useQuery({
    queryKey: [WORKLOAD_SUMMARY_KEY, 'paginate', filter],
    queryFn: async () => {
      const params: { page: number; limit: number; [key: string]: unknown } = {
        page: filter.page,
        limit: filter.limit,
      };
      if (filter.academicYear) params['academicYear'] = filter.academicYear;
      if (filter.status) params['status'] = filter.status;
      const res: Paginated<BackendWorkloadSummary> = await fetchPaginated(`${ROOT}/paginate`, params);
      return {
        items: res.docs.map(mapWorkloadSummary),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs, totalPages: res.totalPages },
      };
    },
  });
}

export function useWorkloadSummaryDetail(id: string | undefined) {
  return useQuery({
    queryKey: [WORKLOAD_SUMMARY_KEY, 'detail', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await fetchOne<{ data: BackendWorkloadSummary }>(`${ROOT}/${id}`);
      return mapWorkloadSummaryDetail(res.data);
    },
  });
}

export function useApprovedWorkloadCount(academicYearId: string | undefined) {
  return useQuery({
    queryKey: [WORKLOAD_KEY, 'approved-count', academicYearId],
    enabled: Boolean(academicYearId),
    queryFn: async () => {
      const res = await fetchPaginated<unknown>('/workloads/paginate', {
        page: 1,
        limit: 1,
        academicYear: academicYearId,
        status: 'approved',
      });
      return res.totalDocs;
    },
  });
}

export function useCreateWorkloadSummary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (academicYearId: string) => {
      const res = await postJson<{ message: string; data: BackendWorkloadSummary }>(ROOT, {
        academicYear: academicYearId,
      });
      const out: CreateSummaryResult = { message: res.message, id: res.data._id };
      return out;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [WORKLOAD_SUMMARY_KEY] }),
  });
}

export function useApproveWorkloadSummary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => patchJson<ApproveSummaryResult>(`${ROOT}/approve/${id}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [WORKLOAD_SUMMARY_KEY] });
      qc.invalidateQueries({ queryKey: [APPROVAL_INBOX_KEY] });
    },
  });
}

export function useRejectWorkloadSummary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      patchJson<{ message: string }>(`${ROOT}/reject/${id}`, { comment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [WORKLOAD_SUMMARY_KEY] });
      qc.invalidateQueries({ queryKey: [APPROVAL_INBOX_KEY] });
    },
  });
}

export function useDeleteWorkloadSummary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: [WORKLOAD_SUMMARY_KEY, 'detail', id], exact: true });
      return qc.invalidateQueries({ queryKey: [WORKLOAD_SUMMARY_KEY] });
    },
  });
}
