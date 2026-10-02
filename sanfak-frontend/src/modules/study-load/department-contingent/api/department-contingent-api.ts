import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteData, fetchList, fetchOne, fetchPaginated, postJson, putJson, type Paginated } from '@/shared/api';
import {
  mapDetail,
  mapFlagged,
  mapListItem,
  mapPrefill,
  mapSummary,
  type BackendDeptContingent,
  type BackendPrefill,
  type BackendSaveMeta,
  type BackendSummary,
} from './mapper';
import type { DeleteResult, RowInput, SaveResult } from '../model/types';
import { WORKLOAD_DETAIL_KEY, WORKLOAD_KEY } from '../../workload/api/workload-api';

export const DEPT_CONTINGENT_KEY = 'departmentContingent';
const ROOT = '/department-contingents';

function invalidateAfterContingentChange(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: [WORKLOAD_KEY] });
  qc.invalidateQueries({ queryKey: [WORKLOAD_DETAIL_KEY] });
  return qc.invalidateQueries({ queryKey: [DEPT_CONTINGENT_KEY] });
}

export function httpStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'response' in error) {
    const status = (error as { response?: { status?: unknown } }).response?.status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

export function apiErrorDetail(error: unknown): string | null {
  if (error && typeof error === 'object' && 'response' in error) {
    const detail = (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
    return typeof detail === 'string' && detail.trim() ? detail : null;
  }
  return null;
}

export function useDirectionOptions() {
  return useQuery({
    queryKey: ['directions', 'dept-contingent-select'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      try {
        const docs = await fetchList<{ _id: string; title?: string | null; code?: string | null }>('/directions', {
          active: true,
        });
        return docs.map((d) => ({ id: d._id, title: d.title ?? '', code: d.code ?? '' }));
      } catch (e) {
        if (import.meta.env.DEV) console.warn("[perm] yo'nalishlar so'rovi muvaffaqiyatsiz:", e);
        return [];
      }
    },
  });
}

export interface DeptContingentsFilter {
  page: number;
  limit: number;
  academicYear?: string;
  department?: string;
}

export function useDeptContingents(filter: DeptContingentsFilter, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [DEPT_CONTINGENT_KEY, 'paginate', filter],
    enabled: opts.enabled ?? true,
    queryFn: async () => {
      const params: { page: number; limit: number; [key: string]: unknown } = {
        page: filter.page,
        limit: filter.limit,
      };
      if (filter.academicYear) params['academicYear'] = filter.academicYear;
      if (filter.department) params['department'] = filter.department;
      const res: Pick<Paginated<BackendDeptContingent>, 'docs' | 'totalDocs' | 'page' | 'limit'> =
        await fetchPaginated(`${ROOT}/paginate`, params);
      return {
        items: (res.docs ?? []).map(mapListItem),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs },
      };
    },
  });
}

export function useDeptContingentDetail(id: string | undefined) {
  return useQuery({
    queryKey: [DEPT_CONTINGENT_KEY, 'detail', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await fetchOne<{ data: BackendDeptContingent }>(`${ROOT}/${id}`);
      return mapDetail(res.data);
    },
  });
}

export function useDeptContingentSummary(academicYearId: string | undefined) {
  return useQuery({
    queryKey: [DEPT_CONTINGENT_KEY, 'summary', academicYearId],
    enabled: Boolean(academicYearId),
    retry: (count, error) => httpStatus(error) !== 403 && count < 2,
    queryFn: async () => {
      const res = await fetchOne<{ data: BackendSummary }>(`${ROOT}/summary`, { academicYear: academicYearId });
      return mapSummary(res.data);
    },
  });
}

export function useDeptContingentPrefill(input: {
  academicYearId: string | null | undefined;
  directionId: string | undefined;
  courseNum: number | undefined;
}) {
  const { academicYearId, directionId, courseNum } = input;
  return useQuery({
    queryKey: [DEPT_CONTINGENT_KEY, 'prefill', academicYearId, directionId, courseNum],
    enabled: Boolean(academicYearId && directionId && courseNum),
    queryFn: async () => {
      const res = await fetchOne<{ data: BackendPrefill }>(`${ROOT}/prefill`, {
        academicYear: academicYearId,
        direction: directionId,
        courseNum,
      });
      return mapPrefill(res.data);
    },
  });
}

export function useCreateDeptContingent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (academicYearId: string) => {
      const res = await postJson<{ message?: string; data: BackendDeptContingent }>(ROOT, {
        academicYear: academicYearId,
      });
      return { message: res.message ?? '', id: res.data._id };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [DEPT_CONTINGENT_KEY] }),
  });
}

export function useUpdateDeptContingent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, rows }: { id: string; rows: RowInput[] }) => {
      const res = await putJson<{ message?: string; data: BackendDeptContingent; meta?: BackendSaveMeta }>(
        `${ROOT}/${id}`,
        { rows },
      );
      const out: SaveResult = {
        message: res.message ?? '',
        detail: mapDetail(res.data),
        flaggedWorkloads: mapFlagged(res.meta),
      };
      return out;
    },
    onSuccess: () => invalidateAfterContingentChange(qc),
  });
}

export function useDeleteDeptContingent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await deleteData<{ message?: string; meta?: BackendSaveMeta }>(`${ROOT}/${id}`);
      const out: DeleteResult = { message: res?.message ?? '', flaggedWorkloads: mapFlagged(res?.meta) };
      return out;
    },
    onSuccess: () => invalidateAfterContingentChange(qc),
  });
}
