import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  apiClient,
  deleteData,
  fetchPaginated,
  getApiErrorMessage,
  patchJson,
  postJson,
  putJson,
  type Paginated,
} from '@/shared/api';
import {
  mapPersonalReport,
  toCreateReportPayload,
  toUpdateReportPayload,
  type BackendPersonalReport,
  type BackendReportMutationResponse,
} from './reports-mapper';
import type { ReportFormValues, ReportStatus } from '../model/report-types';

const REPORT_KEY = 'personalReport';
const ROOT = '/personal-reports';

export interface ReportsFilter {
  planId: string;
  page: number;
  limit: number;
}

export function useReportsPaginated(filter: ReportsFilter) {
  return useQuery({
    queryKey: [REPORT_KEY, 'paginate', filter],
    queryFn: async () => {
      const res: Paginated<BackendPersonalReport> = await fetchPaginated(`${ROOT}/paginate`, {
        page: filter.page,
        limit: filter.limit,
        plan: filter.planId,
      });
      return {
        items: res.docs.map(mapPersonalReport),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs },
      };
    },
    enabled: Boolean(filter.planId),
  });
}

export interface FacultyReportsFilter {
  page: number;
  limit: number;
  academicYear?: string;
  status?: ReportStatus;
}

export function useFacultyReportsPaginated(filter: FacultyReportsFilter) {
  return useQuery({
    queryKey: [REPORT_KEY, 'faculty-paginate', filter],
    queryFn: async () => {
      const params: { page: number; limit: number; [key: string]: unknown } = {
        page: filter.page,
        limit: filter.limit,
      };
      if (filter.academicYear) params.academicYear = filter.academicYear;
      if (filter.status) params.status = filter.status;
      const res: Paginated<BackendPersonalReport> = await fetchPaginated(`${ROOT}/paginate`, params);
      return {
        items: res.docs.map(mapPersonalReport),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs },
      };
    },
  });
}

function invalidateReports(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: [REPORT_KEY] });
}

export function useCreateReport(planId: string, academicYearId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: ReportFormValues) =>
      postJson<BackendReportMutationResponse>(
        ROOT,
        toCreateReportPayload(values, planId, academicYearId),
      ),
    onSuccess: () => invalidateReports(qc),
  });
}

export function useUpdateReport(reportId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: ReportFormValues) =>
      putJson<BackendReportMutationResponse>(`${ROOT}/${reportId}`, toUpdateReportPayload(values)),
    onSuccess: () => invalidateReports(qc),
  });
}

export function useDeleteReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => invalidateReports(qc),
  });
}

export function useSubmitReport(reportId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postJson<{ message: string }>(`${ROOT}/${reportId}/submit`, {}),
    onSuccess: () => invalidateReports(qc),
  });
}

export function useApproveReport(reportId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (comment?: string) =>
      patchJson<{ message: string }>(`${ROOT}/${reportId}/approve`, { comment: comment || undefined }),
    onSuccess: () => invalidateReports(qc),
  });
}

export function useRejectReport(reportId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (comment: string) =>
      patchJson<{ message: string }>(`${ROOT}/${reportId}/reject`, { comment }),
    onSuccess: () => invalidateReports(qc),
  });
}

export async function downloadReportsExport(planId: string): Promise<void> {
  const res = await apiClient.get(`${ROOT}/export`, {
    params: { plan: planId },
    responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'hisobotlar.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export { getApiErrorMessage };
