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
  dedupeScienceOptions,
  mapScienceProgram,
  mapScienceOption,
  mapScienceProgramDetail,
  mapScienceProgramApprovalSteps,
  mapV142Detail,
  mapStaffPerson,
  mapWorkingPlanStatus,
  type BackendTeacherProfileLite,
  type BackendScienceProgramListItem,
  type BackendScienceOption,
  type BackendScienceProgramDetail,
  type BackendWorkingPlanStatus,
} from './mapper';
import type {
  ScienceProgramFormVersion,
  ScienceProgramPayload,
  ScienceProgramStatus,
  StaffPerson,
  V142FormValues,
  V142Payload,
} from '../model/types';
import { APPROVAL_INBOX_KEY } from '../../approval-inbox/api/approval-inbox-api';

export const SCIENCE_PROGRAM_KEY = 'scienceProgram';
const ROOT = '/science-programs';

export interface ScienceProgramsFilter {
  page: number;
  limit: number;
  status?: string;
  academicYear?: string;
}

export function useSciencePrograms(filter: ScienceProgramsFilter) {
  return useQuery({
    queryKey: [SCIENCE_PROGRAM_KEY, 'paginate', filter],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        page: filter.page,
        limit: filter.limit,
      };
      if (filter.status) params['status'] = filter.status;
      if (filter.academicYear) params['year'] = filter.academicYear;

      const res: Paginated<BackendScienceProgramListItem> = await fetchPaginated(
        `${ROOT}/paginate`,
        params as { page: number; limit: number; [key: string]: unknown },
      );
      return {
        items: res.docs.map(mapScienceProgram),
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

export function useMySciences(academicYear?: string) {
  return useQuery({
    queryKey: [SCIENCE_PROGRAM_KEY, 'my-sciences', academicYear],
    queryFn: async () => {
      const params: Record<string, unknown> = { onlyAccepted: 'true' };
      if (academicYear) params['academicYear'] = academicYear;

      const data = await apiClient
        .get<{ data: BackendScienceOption[] }>(`${ROOT}/my-sciences`, { params })
        .then((r) => r.data);

      const docs = Array.isArray(data) ? data : (data?.data ?? []);
      return dedupeScienceOptions((docs as BackendScienceOption[]).map(mapScienceOption));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useStaffForSelect(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['teacher', 'staff-for-science-program'],
    enabled: opts.enabled ?? true,
    retry: false,
    queryFn: async () => {
      const docs = await apiClient
        .get<BackendTeacherProfileLite[]>('/teachers')
        .then((r) => r.data);
      if (!Array.isArray(docs)) return [] as StaffPerson[];
      return docs
        .map(mapStaffPerson)
        .filter((p): p is StaffPerson => p !== null)
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useWorkingPlanStatus(scienceId: string | undefined) {
  const { data: sciences, isPending: sciencesPending } = useMySciences();
  const academicYear =
    (scienceId ? sciences?.find((s) => s.id === scienceId)?.academicYear : null) ?? undefined;

  return useQuery({
    queryKey: [SCIENCE_PROGRAM_KEY, 'working-plan-status', scienceId, academicYear],
    enabled: Boolean(scienceId) && !sciencesPending,
    queryFn: async () => {
      const raw = await apiClient
        .get<BackendWorkingPlanStatus>(`${ROOT}/working-plan-status`, {
          params: { science: scienceId, ...(academicYear ? { academicYear } : {}) },
        })
        .then((r) => r.data);
      return mapWorkingPlanStatus(raw);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useScienceProgram(id: string) {
  return useQuery({
    queryKey: [SCIENCE_PROGRAM_KEY, 'detail', id],
    queryFn: async () => {
      const data: BackendScienceProgramDetail = await apiClient
        .get(`${ROOT}/${id}`)
        .then((r) => r.data);
      return mapScienceProgramDetail(data);
    },
    enabled: !!id,
  });
}

export interface ScienceProgramV142Detail {
  values: V142FormValues;
  formVersion: ScienceProgramFormVersion;
  status: ScienceProgramStatus;
}

export function useScienceProgramV142(id: string) {
  return useQuery({
    queryKey: [SCIENCE_PROGRAM_KEY, 'detail-v142', id],
    queryFn: async (): Promise<ScienceProgramV142Detail> => {
      const data: BackendScienceProgramDetail = await apiClient
        .get(`${ROOT}/${id}`)
        .then((r) => r.data);
      return {
        values: mapV142Detail(data),
        formVersion: data.formVersion === 'v142' ? 'v142' : 'v259',
        status: (data.status as ScienceProgramStatus | null | undefined) ?? 'draft',
      };
    },
    enabled: !!id,
  });
}

export function useScienceProgramApproval(id: string | undefined) {
  return useQuery({
    queryKey: scienceProgramApprovalKey(id),
    queryFn: async () => {
      if (!id) throw new Error('id kerak');
      return fetchScienceProgramApprovalSteps(id);
    },
    enabled: Boolean(id),
  });
}

export const scienceProgramApprovalKey = (id: string | undefined) =>
  [SCIENCE_PROGRAM_KEY, 'approval', id] as const;

export async function fetchScienceProgramApprovalSteps(id: string) {
  const data: BackendScienceProgramDetail = await apiClient
    .get(`${ROOT}/${id}`)
    .then((r) => r.data);
  return mapScienceProgramApprovalSteps(data);
}

export function useCreateScienceProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ScienceProgramPayload | V142Payload) =>
      postJson<{ _id: string; status: string; warning?: string }>(ROOT, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SCIENCE_PROGRAM_KEY] }),
  });
}

export function useUpdateScienceProgram(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      payload: Partial<Omit<ScienceProgramPayload, 'formVersion'>> | Omit<V142Payload, 'formVersion'>,
    ) =>
      putJson(`${ROOT}/${id}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SCIENCE_PROGRAM_KEY] }),
  });
}

export function useDeleteScienceProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SCIENCE_PROGRAM_KEY] }),
  });
}

export function useArchiveScienceProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => putJson(`${ROOT}/${id}/archive`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SCIENCE_PROGRAM_KEY] }),
  });
}

export function useRestoreScienceProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => putJson(`${ROOT}/${id}/restore`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SCIENCE_PROGRAM_KEY] }),
  });
}

export function useApproveScienceProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, protocol }: { id: string; protocol?: string }) =>
      apiClient
        .patch(`${ROOT}/approve/${id}`, { signature: TEMP_ERI_SIGNATURE, protocol })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SCIENCE_PROGRAM_KEY] });
      qc.invalidateQueries({ queryKey: [APPROVAL_INBOX_KEY] });
    },
  });
}

export function useRejectScienceProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      apiClient.patch(`${ROOT}/reject/${id}`, { comment }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SCIENCE_PROGRAM_KEY] });
      qc.invalidateQueries({ queryKey: [APPROVAL_INBOX_KEY] });
    },
  });
}

export { getApiErrorMessage };
