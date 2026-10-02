import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  apiClient,
  deleteData,
  fetchList,
  fetchOne,
  fetchPaginated,
  getApiErrorMessage,
  patchJson,
  postJson,
  type Paginated,
} from '@/shared/api';
import {
  mapWorkload,
  mapWorkloadDetail,
  mapStaffPositions,
  type BackendStaffPositions,
  type BackendWorkload,
  type BackendWorkloadDetailFull,
} from './mapper';
import { fetchAllPages } from '../../lib/fetch-all-pages';
import type { CreateWorkloadResult, RefOption, WorkloadFormValues } from '../model/types';
import type {
  StaffPositions,
  UpdateBlockPayload,
  UpdateBlockResult,
  WorkloadDetail,
} from '../model/detail-types';
import { APPROVAL_INBOX_KEY } from '../../approval-inbox/api/approval-inbox-api';

export const WORKLOAD_KEY = 'workload';
const ROOT = '/workloads';

export interface WorkloadsFilter {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  department?: string;
}

interface BackendRef {
  _id: string;
  title: string;
}

function mapRef(b: BackendRef): RefOption {
  return { id: b._id, title: b.title };
}

async function fetchRefList(url: string): Promise<RefOption[]> {
  try {
    const docs = await fetchList<BackendRef>(url, { active: true });
    return docs.map(mapRef);
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[perm] reference so'rovi muvaffaqiyatsiz:", e);
    return [];
  }
}

function workloadFilterParams(filter: Omit<WorkloadsFilter, 'page' | 'limit'>) {
  const params: Record<string, unknown> = {};
  if (filter.search) params['search'] = filter.search;
  if (filter.status) params['status'] = filter.status;
  if (filter.department) params['department'] = filter.department;
  return params;
}

export function fetchAllWorkloads(filter: Omit<WorkloadsFilter, 'page' | 'limit'>) {
  return fetchAllPages(`${ROOT}/paginate`, workloadFilterParams(filter), mapWorkload);
}

export function useWorkloads(filter: WorkloadsFilter) {
  return useQuery({
    queryKey: [WORKLOAD_KEY, 'paginate', filter],
    queryFn: async () => {
      const res: Paginated<BackendWorkload> = await fetchPaginated(`${ROOT}/paginate`, {
        page: filter.page,
        limit: filter.limit,
        ...workloadFilterParams(filter),
      });
      return {
        items: res.docs.map(mapWorkload),
        meta: {
          page: res.page,
          limit: res.limit,
          total: res.totalDocs,
          totalPages: res.totalPages,
        },
      };
    },
  });
}

export function useApprovedWorkloadExists(department?: string, academicYear?: string) {
  return useQuery({
    queryKey: [WORKLOAD_KEY, 'approved-exists', department, academicYear],
    enabled: Boolean(department && academicYear),
    retry: false,
    queryFn: async () => {
      const res: Paginated<BackendWorkload> = await fetchPaginated(`${ROOT}/paginate`, {
        page: 1,
        limit: 1,
        status: 'approved',
        department,
        academicYear,
      });
      return (res.totalDocs ?? 0) > 0;
    },
  });
}

export function useCreateWorkload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: WorkloadFormValues) =>
      postJson<CreateWorkloadResult>(ROOT, {
        department: values.department,
        academicYear: values.academicYear,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [WORKLOAD_KEY] }),
  });
}

export function useDeleteWorkload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [WORKLOAD_KEY] }),
  });
}

export function useApproveWorkload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.patch(`${ROOT}/approve/${id}`, {}).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [WORKLOAD_KEY] });
      qc.invalidateQueries({ queryKey: [APPROVAL_INBOX_KEY] });
    },
  });
}

export function useRejectWorkload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      apiClient.patch(`${ROOT}/reject/${id}`, { comment }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [WORKLOAD_KEY] });
      qc.invalidateQueries({ queryKey: [APPROVAL_INBOX_KEY] });
    },
  });
}

export function useDepartmentsRef() {
  return useQuery({
    queryKey: ['departments', 'list-for-select'],
    queryFn: () => fetchRefList('/departments'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAcademicYearsRef() {
  return useQuery({
    queryKey: ['academicYears', 'list-for-select'],
    queryFn: () => fetchRefList('/academic-years'),
    staleTime: 5 * 60 * 1000,
  });
}

export const WORKLOAD_DETAIL_KEY = 'workload-detail';

export function useWorkloadDetail(id: string | undefined) {
  return useQuery({
    queryKey: [WORKLOAD_DETAIL_KEY, id],
    queryFn: () => fetchOne<BackendWorkloadDetailFull>(`${ROOT}/${id}`).then(mapWorkloadDetail),
    enabled: Boolean(id),
  });
}

export function useUpdateWorkloadBlock(workloadId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ blockId, payload }: { blockId: string; payload: UpdateBlockPayload }) =>
      patchJson<UpdateBlockResult>(`${ROOT}/${workloadId}/blocks/${blockId}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [WORKLOAD_DETAIL_KEY, workloadId] });
      qc.invalidateQueries({ queryKey: [WORKLOAD_KEY] });
    },
  });
}

export type { WorkloadDetail };

export { getApiErrorMessage };

export interface RecalculateResultItem {
  workloadId: string;
  blocksUpdated?: number;
  success: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
}

export interface RecalculateResponse {
  message: string;
  total: number;
  successful: number;
  failed: number;
  results: RecalculateResultItem[];
}

export function useRecalculateWorkload(workloadId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      postJson<RecalculateResponse>('/workloads/recalculate', {
        workloadIds: workloadId ? [workloadId] : [],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [WORKLOAD_DETAIL_KEY, workloadId] });
      qc.invalidateQueries({ queryKey: [WORKLOAD_KEY] });
    },
  });
}

export interface StaffPositionEditItem {
  id?: string;
  category: string;
  slug: string;
  positions: number;
  load: number;
  hourly: number;
}

export function useUpdateStaffPositions(workloadId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: StaffPositionEditItem[]) =>
      patchJson<{ message: string; staffPositions: BackendStaffPositions }>(
        `${ROOT}/${workloadId}/staff-positions`,
        {
          items: items.map((it) => ({
            ...(it.id ? { _id: it.id } : {}),
            category: it.category,
            slug: it.slug,
            positions: it.positions,
            load: it.load,
            hourly: it.hourly,
          })),
        },
      ).then((res): { message: string; staffPositions: StaffPositions } => ({
        message: res.message,
        staffPositions: mapStaffPositions(res.staffPositions),
      })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [WORKLOAD_DETAIL_KEY, workloadId] });
      qc.invalidateQueries({ queryKey: [WORKLOAD_KEY] });
    },
  });
}
