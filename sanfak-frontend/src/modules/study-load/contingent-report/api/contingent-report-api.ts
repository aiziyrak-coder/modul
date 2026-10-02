import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteData,
  fetchList,
  fetchOne,
  fetchPaginated,
  patchJson,
  postJson,
  putJson,
  type Paginated,
} from '@/shared/api';
import { APPROVAL_INBOX_KEY } from '../../approval-inbox/api/approval-inbox-api';
import { httpStatus } from '../../department-contingent/api/department-contingent-api';
import {
  mapContingentReport,
  mapContingentReportDetail,
  mapPrefillMeta,
  mapSummary,
  type BackendContingentReport,
  type BackendPrefillMeta,
  type BackendSummaryResponse,
} from './mapper';
import type {
  ApproveReportResult,
  CreateReportResult,
  PrefillResult,
  UpdateReportPayload,
} from '../model/types';

export const CONTINGENT_REPORT_KEY = 'contingentReport';
const ROOT = '/contingent-reports';

export function useFacultyOptions() {
  return useQuery({
    queryKey: ['faculties', 'contingent-report-filter'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      try {
        const docs = await fetchList<{ _id: string; title?: string | null }>('/faculties', {
          active: true,
        });
        return docs.map((d) => ({ id: d._id, title: d.title ?? '' }));
      } catch (e) {
        if (import.meta.env.DEV) console.warn("[perm] fakultetlar so'rovi muvaffaqiyatsiz:", e);
        return [];
      }
    },
  });
}

export interface ContingentReportsFilter {
  page: number;
  limit: number;
  academicYear?: string;
  faculty?: string;
  status?: string;
}

export function useContingentReports(filter: ContingentReportsFilter) {
  return useQuery({
    queryKey: [CONTINGENT_REPORT_KEY, 'paginate', filter],
    queryFn: async () => {
      const params: { page: number; limit: number; [key: string]: unknown } = {
        page: filter.page,
        limit: filter.limit,
      };
      if (filter.academicYear) params['academicYear'] = filter.academicYear;
      if (filter.faculty) params['faculty'] = filter.faculty;
      if (filter.status) params['status'] = filter.status;
      const res: Paginated<BackendContingentReport> = await fetchPaginated(`${ROOT}/paginate`, params);
      return {
        items: res.docs.map(mapContingentReport),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs, totalPages: res.totalPages },
      };
    },
  });
}

export function useContingentReportDetail(id: string | undefined) {
  return useQuery({
    queryKey: [CONTINGENT_REPORT_KEY, 'detail', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await fetchOne<{ data: BackendContingentReport }>(`${ROOT}/${id}`);
      return mapContingentReportDetail(res.data);
    },
  });
}

export function useContingentSummary(academicYearId: string | undefined) {
  return useQuery({
    queryKey: [CONTINGENT_REPORT_KEY, 'summary', academicYearId],
    enabled: Boolean(academicYearId),
    retry: (count, error) => httpStatus(error) !== 403 && count < 1,
    queryFn: async () => {
      const res = await fetchOne<{ data: BackendSummaryResponse }>(`${ROOT}/summary`, {
        academicYear: academicYearId,
      });
      return mapSummary(res.data);
    },
  });
}

export function useCreateContingentReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { academicYearId: string; asOfDate?: string }) => {
      const res = await postJson<{ message: string; data: BackendContingentReport; meta?: BackendPrefillMeta }>(
        ROOT,
        { academicYear: input.academicYearId, ...(input.asOfDate ? { asOfDate: input.asOfDate } : {}) },
      );
      const out: CreateReportResult = { message: res.message, id: res.data._id, meta: mapPrefillMeta(res.meta) };
      return out;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CONTINGENT_REPORT_KEY] }),
  });
}

export function useUpdateContingentReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateReportPayload }) => {
      const res = await putJson<{ message: string; data: BackendContingentReport }>(`${ROOT}/${id}`, payload);
      return mapContingentReportDetail(res.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CONTINGENT_REPORT_KEY] }),
  });
}

export function usePrefillContingentReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, force }: { id: string; force?: boolean }) => {
      const res = await postJson<{ message: string; data: BackendContingentReport; meta?: BackendPrefillMeta }>(
        `${ROOT}/${id}/prefill`,
        { force: Boolean(force) },
      );
      const out: PrefillResult = {
        message: res.message,
        detail: mapContingentReportDetail(res.data),
        meta: mapPrefillMeta(res.meta),
      };
      return out;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CONTINGENT_REPORT_KEY] }),
  });
}

export function useApproveContingentReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, protocol }: { id: string; protocol?: string }) =>
      patchJson<ApproveReportResult>(`${ROOT}/approve/${id}`, protocol ? { protocol } : {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CONTINGENT_REPORT_KEY] });
      qc.invalidateQueries({ queryKey: [APPROVAL_INBOX_KEY] });
    },
  });
}

export function useRejectContingentReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      patchJson<{ message: string }>(`${ROOT}/reject/${id}`, { comment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CONTINGENT_REPORT_KEY] });
      qc.invalidateQueries({ queryKey: [APPROVAL_INBOX_KEY] });
    },
  });
}

export function useDeleteContingentReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [CONTINGENT_REPORT_KEY] }),
  });
}
