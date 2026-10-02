import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  apiClient,
  deleteData,
  fetchPaginated,
  getApiErrorMessage,
  postJson,
  putJson,
  type Paginated,
} from '@/shared/api';
import { TEMP_ERI_SIGNATURE } from '../../lib/eri';
import {
  mapSyllabus,
  mapSyllabusScience,
  mapSyllabusDetail,
  mapSyllabusApprovalSteps,
  type BackendSyllabusListItem,
  type BackendSyllabusScience,
  type BackendSyllabusDetail,
} from './mapper';
import type { SyllabusPayload } from '../model/types';
import { APPROVAL_INBOX_KEY } from '../../approval-inbox/api/approval-inbox-api';

export const SYLLABUS_KEY = 'syllabus';
const ROOT = '/syllabi';

export interface SyllabusFilter {
  page: number;
  limit: number;
  status?: string;
  search?: string;
}

export function useSyllabi(filter: SyllabusFilter) {
  return useQuery({
    queryKey: [SYLLABUS_KEY, 'paginate', filter],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        page: filter.page,
        limit: filter.limit,
      };
      if (filter.status) params['status'] = filter.status;
      if (filter.search) params['search'] = filter.search;

      const res: Paginated<BackendSyllabusListItem> = await fetchPaginated(
        `${ROOT}/paginate`,
        params as { page: number; limit: number; [key: string]: unknown },
      );
      return {
        items: res.docs.map(mapSyllabus),
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

export function useMyAssignedSciences(academicYear?: string) {
  return useQuery({
    queryKey: [SYLLABUS_KEY, 'my-sciences', academicYear],
    queryFn: async () => {
      const params: Record<string, unknown> = { onlyAccepted: 'true' };
      if (academicYear) params['academicYear'] = academicYear;

      const data = await apiClient
        .get<{ data: BackendSyllabusScience[]; total: number }>(
          `${ROOT}/my-sciences`,
          { params },
        )
        .then((r) => r.data);

      const docs = Array.isArray(data) ? data : (data?.data ?? []);
      return (docs as BackendSyllabusScience[]).map(mapSyllabusScience);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSyllabus(id: string) {
  return useQuery({
    queryKey: [SYLLABUS_KEY, 'detail', id],
    queryFn: async () => {
      const data: BackendSyllabusDetail = await apiClient
        .get(`${ROOT}/${id}`)
        .then((r) => r.data);
      return mapSyllabusDetail(data);
    },
    enabled: !!id,
  });
}

export function useSyllabusApproval(id: string | undefined) {
  return useQuery({
    queryKey: [SYLLABUS_KEY, 'approval', id],
    queryFn: async () => {
      if (!id) throw new Error('id kerak');
      const data: BackendSyllabusDetail = await apiClient
        .get(`${ROOT}/${id}`)
        .then((r) => r.data);
      return mapSyllabusApprovalSteps(data);
    },
    enabled: Boolean(id),
  });
}

export function useCreateSyllabus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SyllabusPayload) =>
      postJson<{ _id: string; status: string }>(ROOT, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SYLLABUS_KEY] }),
  });
}

export function useUpdateSyllabus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<SyllabusPayload>) =>
      putJson(`${ROOT}/${id}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SYLLABUS_KEY] }),
  });
}

export function useDeleteSyllabus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SYLLABUS_KEY] }),
  });
}

export function useArchiveSyllabus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => putJson(`${ROOT}/${id}/archive`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SYLLABUS_KEY] }),
  });
}

export function useRestoreSyllabus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => putJson(`${ROOT}/${id}/restore`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SYLLABUS_KEY] }),
  });
}

export function useApproveSyllabus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, protocol }: { id: string; protocol?: string }) =>
      apiClient
        .patch(`${ROOT}/approve/${id}`, { signature: TEMP_ERI_SIGNATURE, protocol })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SYLLABUS_KEY] });
      qc.invalidateQueries({ queryKey: [APPROVAL_INBOX_KEY] });
    },
  });
}

export function useRejectSyllabus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      apiClient.patch(`${ROOT}/reject/${id}`, { comment }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SYLLABUS_KEY] });
      qc.invalidateQueries({ queryKey: [APPROVAL_INBOX_KEY] });
    },
  });
}

export function useScienceProgramTopics(scienceProgramId: string | null | undefined) {
  return useQuery({
    queryKey: [SYLLABUS_KEY, 'sp-topics', scienceProgramId],
    queryFn: async () => {
      if (!scienceProgramId) return [] as Array<{ label: string; value: string }>;
      const rows = await apiClient
        .get<Array<{ _id?: string; title?: string | null }>>(
          `/science-programs/topic/${scienceProgramId}`,
        )
        .then((r) => (Array.isArray(r.data) ? r.data : []));
      return rows
        .filter((tp) => Boolean(tp?.title))
        .map((tp) => ({ label: tp.title as string, value: tp.title as string }));
    },
    enabled: Boolean(scienceProgramId),
    staleTime: 5 * 60 * 1000,
  });
}

export { getApiErrorMessage };
