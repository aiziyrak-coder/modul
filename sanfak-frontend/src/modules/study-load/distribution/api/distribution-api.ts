import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  apiClient,
  deleteData,
  fetchList,
  fetchPaginated,
  getApiErrorMessage,
  postJson,
  type Paginated,
} from '@/shared/api';
import {
  mapDistribution,
  mapDistributionDetail,
  mapWorkloadBlocks,
  mapTeacherOption,
  mapGroupOption,
  mapVacancy,
  mapElectiveOptions,
  mapElectiveChoiceResult,
  type BackendDistributionListItem,
  type BackendDistributionDetail,
  type BackendWorkloadDetail,
  type BackendVacancy,
  type BackendElectiveOptions,
  type BackendElectiveChoiceResult,
} from './mapper';
import { fetchAllPages } from '../../lib/fetch-all-pages';
import type {
  DistributionFormValues,
  WorkloadOption,
  WorkloadBlockOption,
  TeacherOption,
  GroupOption,
  AddTeacherPayload,
  AddBlockPayload,
  VacateTeacherPayload,
  FillVacancyPayload,
  ElectiveChoiceResult,
} from '../model/types';
import {
  buildJustificationPayload,
  type AssignmentBasis,
  type SuitabilityWarningEntry,
} from '../lib/suitability';
import { TEMP_ERI_SIGNATURE } from '../../lib/eri';
import { APPROVAL_INBOX_KEY } from '../../approval-inbox/api/approval-inbox-api';

export const DISTRIBUTION_KEY = 'workloadDistribution';
const ROOT = '/distributions';

export interface DistributionsFilter {
  page: number;
  limit: number;
  status?: string;
}

export interface OverloadWarning {
  teacherEntryId: string;
  totalHour: number;
  auditoriumHour?: number;
  maxHour: number;
  excess: number;
  message: string;
  severity: 'warning';
}

export interface SubmitDistributionResult {
  message: string;
  action?: string;
  status?: string;
  warnings?: OverloadWarning[];
  suitabilityWarnings?: SuitabilityWarningEntry[];
}

interface BackendWorkloadListItem {
  _id: string;
  title?: string | null;
  department?: { _id: string; title: string } | string | null;
  academicYear?: { _id: string; title: string } | string | null;
}

function mapWorkloadOption(b: BackendWorkloadListItem): WorkloadOption {
  const ay =
    b.academicYear && typeof b.academicYear === 'object'
      ? (b.academicYear as { _id: string; title: string }).title
      : null;
  const dept =
    b.department && typeof b.department === 'object'
      ? (b.department as { _id: string; title: string }).title
      : null;
  const parts = [dept, ay].filter(Boolean);
  const label = b.title ?? (parts.length > 0 ? parts.join(' — ') : 'Yuklama');
  return { id: b._id, label };
}

export function fetchAllDistributions(filter: Pick<DistributionsFilter, 'status'>) {
  return fetchAllPages(
    `${ROOT}/paginate`,
    filter.status ? { status: filter.status } : {},
    mapDistribution,
  );
}

export function useDistributions(filter: DistributionsFilter) {
  return useQuery({
    queryKey: [DISTRIBUTION_KEY, 'paginate', filter],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        page: filter.page,
        limit: filter.limit,
      };
      if (filter.status) params['status'] = filter.status;

      const res: Paginated<BackendDistributionListItem> = await fetchPaginated(
        `${ROOT}/paginate`,
        params as { page: number; limit: number; [key: string]: unknown },
      );
      return {
        items: res.docs.map(mapDistribution),
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

export function useDistribution(id: string | undefined) {
  return useQuery({
    queryKey: [DISTRIBUTION_KEY, 'detail', id],
    queryFn: async () => {
      if (!id) throw new Error('id kerak');
      const raw = await import('@/shared/api').then(({ apiClient }) =>
        apiClient
          .get<BackendDistributionDetail>(`${ROOT}/${id}`)
          .then((r) => r.data),
      );
      return mapDistributionDetail(raw);
    },
    enabled: Boolean(id),
  });
}

export function useCreateDistribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: DistributionFormValues) =>
      postJson<unknown>(ROOT, { workload: values.workload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [DISTRIBUTION_KEY] }),
  });
}

export function useDeleteDistribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [DISTRIBUTION_KEY] }),
  });
}

export function useWorkloadsForSelect() {
  return useQuery({
    queryKey: ['workload', 'list-for-select'],
    queryFn: async () => {
      const docs = await import('@/shared/api').then(({ apiClient }) =>
        apiClient
          .get<BackendWorkloadListItem[]>('/workloads', {
            params: { excludeDistributed: true, status: 'approved' },
          })
          .then((r) => r.data),
      );
      return Array.isArray(docs) ? docs.map(mapWorkloadOption) : [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useWorkloadBlocksForSelect(
  workloadId: string | null | undefined,
  opts: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: [DISTRIBUTION_KEY, 'workload-blocks', workloadId],
    queryFn: async () => {
      if (!workloadId) return [] as WorkloadBlockOption[];
      const raw = await import('@/shared/api').then(({ apiClient }) =>
        apiClient.get<BackendWorkloadDetail>(`/workloads/detail/${workloadId}`).then((r) => r.data),
      );
      return mapWorkloadBlocks(raw);
    },
    enabled: Boolean(workloadId) && (opts.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTeachersForSelect(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['teacher', 'list-for-select'],
    enabled: opts.enabled ?? true,
    queryFn: async () => {
      const docs = await import('@/shared/api').then(({ apiClient }) =>
        apiClient
          .get<
            Array<{
              _id: string;
              user?: {
                _id: string;
                firstName?: string | null;
                lastName?: string | null;
                middleName?: string | null;
              } | null;
              department?: { _id: string; title?: string | null } | string | null;
              teachingSpecialtyName?: string | null;
              teachingSpecialtyCode?: string | null;
              academicDegree?: string | null;
            }>
          >('/teachers')
          .then((r) => r.data),
      );
      if (!Array.isArray(docs)) return [] as TeacherOption[];
      return docs
        .map(mapTeacherOption)
        .filter((o): o is TeacherOption => o !== null);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useGroupsForSelect() {
  return useQuery({
    queryKey: ['groups', 'list-for-select'],
    queryFn: async () => {
      const docs = await import('@/shared/api').then(({ apiClient }) =>
        apiClient
          .get<Array<{ _id: string; title?: string | null }>>('/groups', { params: { active: true } })
          .then((r) => r.data),
      );
      return Array.isArray(docs) ? docs.map(mapGroupOption) : ([] as GroupOption[]);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAddTeacher(distributionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AddTeacherPayload) =>
      import('@/shared/api').then(({ apiClient }) =>
        apiClient.post(`${ROOT}/${distributionId}/teachers`, payload).then((r) => r.data),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: [DISTRIBUTION_KEY, 'detail', distributionId] }),
  });
}

export function useRemoveTeacher(distributionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teacherEntryId: string) =>
      deleteData(`${ROOT}/${distributionId}/teachers/${teacherEntryId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [DISTRIBUTION_KEY, 'detail', distributionId] }),
  });
}

export function useAddBlock(distributionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teacherEntryId, payload }: { teacherEntryId: string; payload: AddBlockPayload }) =>
      import('@/shared/api').then(({ apiClient }) =>
        apiClient
          .post(`${ROOT}/${distributionId}/teachers/${teacherEntryId}/blocks`, payload)
          .then((r) => r.data),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: [DISTRIBUTION_KEY, 'detail', distributionId] }),
  });
}

export function useRemoveBlock(distributionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teacherEntryId, blockId }: { teacherEntryId: string; blockId: string }) =>
      deleteData(`${ROOT}/${distributionId}/teachers/${teacherEntryId}/blocks/${blockId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [DISTRIBUTION_KEY, 'detail', distributionId] }),
  });
}

export function useUpdateBlockHours(distributionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      teacherEntryId,
      blockId,
      totalHour,
    }: {
      teacherEntryId: string;
      blockId: string;
      totalHour: number;
    }) =>
      import('@/shared/api').then(({ apiClient }) =>
        apiClient
          .patch(
            `${ROOT}/${distributionId}/teachers/${teacherEntryId}/blocks/${blockId}`,
            { totalHour },
          )
          .then((r) => r.data),
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [DISTRIBUTION_KEY, 'detail', distributionId] }),
  });
}

export function useElectiveOptions(
  distributionId: string,
  blockId: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [DISTRIBUTION_KEY, 'elective-options', distributionId, blockId],
    queryFn: async () => {
      if (!blockId) throw new Error('blockId kerak');
      const res = await apiClient.get<{ data: BackendElectiveOptions }>(
        `${ROOT}/${distributionId}/elective-options`,
        { params: { blockId } },
      );
      return mapElectiveOptions(res.data.data);
    },
    enabled: enabled && Boolean(blockId),
    staleTime: 0,
  });
}

export interface ElectiveChoicePayload {
  blockId: string;
  scienceId: string;
  suitabilityBasis?: AssignmentBasis;
  suitabilityNote?: string;
}

export async function putElectiveChoice(
  distributionId: string,
  payload: ElectiveChoicePayload,
): Promise<ElectiveChoiceResult> {
  const res = await apiClient.put<{ data: BackendElectiveChoiceResult }>(
    `${ROOT}/${distributionId}/elective-choice`,
    {
      blockId: payload.blockId,
      scienceId: payload.scienceId,
      ...buildJustificationPayload(payload.suitabilityBasis ?? '', payload.suitabilityNote ?? ''),
    },
  );
  return mapElectiveChoiceResult(res.data.data);
}

export function useSetElectiveChoice(distributionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ElectiveChoicePayload) =>
      putElectiveChoice(distributionId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: [DISTRIBUTION_KEY, 'detail', distributionId],
      });
      void qc.invalidateQueries({
        queryKey: [DISTRIBUTION_KEY, 'elective-options', distributionId],
      });
    },
  });
}

export function useVacateTeacher(distributionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teacherEntryId, payload }: { teacherEntryId: string; payload: VacateTeacherPayload }) =>
      import('@/shared/api').then(({ apiClient }) =>
        apiClient
          .patch(`${ROOT}/${distributionId}/vacate/${teacherEntryId}`, payload)
          .then((r) => r.data),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: [DISTRIBUTION_KEY, 'detail', distributionId] }),
  });
}

export function useFillVacancy(distributionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teacherEntryId, payload }: { teacherEntryId: string; payload: FillVacancyPayload }) =>
      import('@/shared/api').then(({ apiClient }) =>
        apiClient
          .patch(`${ROOT}/${distributionId}/teachers/${teacherEntryId}/fill`, payload)
          .then((r) => r.data),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: [DISTRIBUTION_KEY, 'detail', distributionId] }),
  });
}

export function useSubmitDistribution() {
  const qc = useQueryClient();
  return useMutation<SubmitDistributionResult, unknown, string>({
    mutationFn: (id: string) =>
      import('@/shared/api').then(({ apiClient }) =>
        apiClient
          .patch<SubmitDistributionResult>(`${ROOT}/approve/${id}`, { signature: TEMP_ERI_SIGNATURE })
          .then((r) => r.data),
      ),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: [DISTRIBUTION_KEY, 'detail', id] });
      qc.invalidateQueries({ queryKey: [DISTRIBUTION_KEY] });
      qc.invalidateQueries({ queryKey: [APPROVAL_INBOX_KEY] });
    },
  });
}

export function useWithdrawDistribution() {
  const qc = useQueryClient();
  return useMutation<{ message: string; status?: string }, unknown, string>({
    mutationFn: (id: string) =>
      import('@/shared/api').then(({ apiClient }) =>
        apiClient.patch<{ message: string; status?: string }>(`${ROOT}/withdraw/${id}`).then((r) => r.data),
      ),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: [DISTRIBUTION_KEY, 'detail', id] });
      qc.invalidateQueries({ queryKey: [DISTRIBUTION_KEY] });
      qc.invalidateQueries({ queryKey: [APPROVAL_INBOX_KEY] });
    },
  });
}

export function useApproveDistribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      import('@/shared/api').then(({ apiClient }) =>
        apiClient.patch(`${ROOT}/approve/${id}`, { signature: TEMP_ERI_SIGNATURE }).then((r) => r.data),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [DISTRIBUTION_KEY] });
      qc.invalidateQueries({ queryKey: [APPROVAL_INBOX_KEY] });
    },
  });
}

export function useRejectDistribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      import('@/shared/api').then(({ apiClient }) =>
        apiClient.patch(`${ROOT}/reject/${id}`, { comment }).then((r) => r.data),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [DISTRIBUTION_KEY] });
      qc.invalidateQueries({ queryKey: [APPROVAL_INBOX_KEY] });
    },
  });
}

export function useVacancies() {
  return useQuery({
    queryKey: [DISTRIBUTION_KEY, 'vacancies'],
    queryFn: async () => {
      const docs = await fetchList<BackendVacancy>(`${ROOT}/vacancies`);
      return docs.map(mapVacancy);
    },
  });
}

export { getApiErrorMessage };
