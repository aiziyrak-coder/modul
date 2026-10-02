import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  apiClient,
  deleteData,
  fetchPaginated,
  getApiErrorMessage,
  type Paginated,
} from '@/shared/api';
import { mapWorkingSchedule, type BackendWorkingSchedule } from './mapper';
import { fetchAllPages } from '../../lib/fetch-all-pages';
import type { WorkingScheduleStatus } from '../model/types';
import { TEMP_ERI_SIGNATURE } from '../../lib/eri';
import { APPROVAL_INBOX_KEY } from '../../approval-inbox/api/approval-inbox-api';

export const WORKING_SCHEDULE_KEY = 'working-schedule';
const ROOT = '/working-schedules';

export interface WorkingSchedulesFilter {
  page: number;
  limit: number;
  search?: string;
  status?: WorkingScheduleStatus | '';
  direction?: string;
  courseRef?: string;
  academicYear?: string;
}

function workingScheduleFilterParams(filter: Omit<WorkingSchedulesFilter, 'page' | 'limit'>) {
  const params: Record<string, unknown> = {};
  if (filter.search) params['search'] = filter.search;
  if (filter.status) params['status'] = filter.status;
  if (filter.direction) params['direction'] = filter.direction;
  if (filter.courseRef) params['courseRef'] = filter.courseRef;
  if (filter.academicYear) params['academicYear'] = filter.academicYear;
  return params;
}

export function fetchAllWorkingSchedules(filter: Omit<WorkingSchedulesFilter, 'page' | 'limit'>) {
  return fetchAllPages(`${ROOT}/paginate`, workingScheduleFilterParams(filter), mapWorkingSchedule);
}

export function useWorkingSchedules(filter: WorkingSchedulesFilter) {
  return useQuery({
    queryKey: [WORKING_SCHEDULE_KEY, 'paginate', filter],
    queryFn: async () => {
      const res: Paginated<BackendWorkingSchedule> = await fetchPaginated(`${ROOT}/paginate`, {
        page: filter.page,
        limit: filter.limit,
        ...workingScheduleFilterParams(filter),
      });
      return {
        items: res.docs.map(mapWorkingSchedule),
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

export function useDeleteWorkingSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [WORKING_SCHEDULE_KEY] }),
  });
}

export function useWorkingSchedule(id: string | undefined) {
  return useQuery({
    queryKey: [WORKING_SCHEDULE_KEY, 'detail', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await apiClient.get<BackendWorkingSchedule | { data: BackendWorkingSchedule }>(
        `${ROOT}/${id}`,
      );
      const raw = res.data;
      const doc = (raw as { data?: BackendWorkingSchedule }).data ?? (raw as BackendWorkingSchedule);
      return mapWorkingSchedule(doc);
    },
  });
}

export interface ApproveWorkingScheduleResponse {
  message?: string;
  action?: string;
  status?: string;
  unfilledSlots?: number | null;
  warning?: string | null;
}

export function useApproveWorkingSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient
        .patch<ApproveWorkingScheduleResponse>(`${ROOT}/approve/${id}`, { signature: TEMP_ERI_SIGNATURE })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [WORKING_SCHEDULE_KEY] });
      qc.invalidateQueries({ queryKey: [APPROVAL_INBOX_KEY] });
    },
  });
}

export function useRejectWorkingSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      apiClient.patch(`${ROOT}/reject/${id}`, { comment }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [WORKING_SCHEDULE_KEY] });
      qc.invalidateQueries({ queryKey: [APPROVAL_INBOX_KEY] });
    },
  });
}

export interface SupersedePreviewCourse {
  courseNum: number;
  existing: number;
  locked: number;
}

export interface SupersedePreview {
  affected: SupersedePreviewCourse[];
  totalExisting: number;
  totalLocked: number;
}

export function useSupersedePreview(learningProcessId: string | undefined) {
  return useQuery({
    queryKey: [WORKING_SCHEDULE_KEY, 'supersede-preview', learningProcessId],
    enabled: Boolean(learningProcessId),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    queryFn: async (): Promise<SupersedePreview> => {
      const res = await apiClient.get<SupersedePreview | { data: SupersedePreview }>(
        `${ROOT}/supersede-preview`,
        { params: { learningProcess: learningProcessId } },
      );
      const raw = res.data;
      const payload =
        (raw as { data?: SupersedePreview }).data ?? (raw as SupersedePreview);
      return {
        affected: payload.affected ?? [],
        totalExisting: payload.totalExisting ?? 0,
        totalLocked: payload.totalLocked ?? 0,
      };
    },
  });
}

export { getApiErrorMessage };
