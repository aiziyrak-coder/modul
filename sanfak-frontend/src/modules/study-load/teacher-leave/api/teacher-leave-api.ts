import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePermission } from '@/app/session';
import {
  fetchPaginated,
  fetchOne,
  deleteData,
  patchJson,
  postJson,
  getApiErrorMessage,
  apiClient,
  type Paginated,
} from '@/shared/api';
import { mapTeacherLeave, type BackendTeacherLeave } from './mapper';
import { isSelectableDistribution } from '../model/distribution-select';
import { TEMP_ERI_SIGNATURE } from '../../lib/eri';

export const TEACHER_LEAVE_KEY = 'teacherLeave';
const ROOT = '/teacher-leaves';

export interface TeacherOption {
  id: string;
  fullName: string;
}

export interface DistributionOption {
  id: string;
  title: string | null;
  year: string | null;
  course: number | null;
}

export interface ReassignmentSuggestion {
  teacherId: string;
  teacherName: string;
  score?: number;
}

export interface CreateTeacherLeaveBody {
  type: 'leave' | 'resignation' | 'transfer';
  teacher?: string;
  reason: string;
  distribution?: string;
  fromDate: string;
  toDate?: string;
}

export interface TeacherLeaveFilter {
  page: number;
  limit: number;
  search?: string;
  status?: string;
}

export function useTeacherLeaves(filter: TeacherLeaveFilter) {
  return useQuery({
    queryKey: [TEACHER_LEAVE_KEY, 'paginate', filter],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        page: filter.page,
        limit: filter.limit,
      };
      if (filter.search) params['search'] = filter.search;
      if (filter.status) params['status'] = filter.status;

      const res: Paginated<BackendTeacherLeave> = await fetchPaginated(
        `${ROOT}/paginate`,
        params as { page: number; limit: number; [key: string]: unknown },
      );
      return {
        items: res.docs.map(mapTeacherLeave),
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

export function useTeacherLeave(id: string) {
  return useQuery({
    queryKey: [TEACHER_LEAVE_KEY, 'detail', id],
    queryFn: async () => {
      const data: BackendTeacherLeave = await fetchOne(`${ROOT}/${id}`);
      return mapTeacherLeave(data);
    },
    enabled: !!id,
  });
}

export function useApproveTeacherLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) =>
      patchJson(`${ROOT}/${id}/approve`, {
        signature: TEMP_ERI_SIGNATURE,
        ...(comment ? { comment } : {}),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [TEACHER_LEAVE_KEY] }),
  });
}

export function useRejectTeacherLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      patchJson(`${ROOT}/${id}/reject`, { comment }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [TEACHER_LEAVE_KEY] }),
  });
}

export function useDeleteTeacherLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [TEACHER_LEAVE_KEY] }),
  });
}

export function useCreateTeacherLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTeacherLeaveBody) =>
      postJson<unknown>(ROOT, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [TEACHER_LEAVE_KEY] }),
  });
}

export function useReassignmentSuggestions(id: string | null | undefined) {
  return useQuery({
    queryKey: [TEACHER_LEAVE_KEY, 'suggestions', id],
    queryFn: async () => {
      const res = await apiClient
        .get<{
          leaveId: string;
          suggestions: {
            teacher?: {
              _id: string;
              firstName?: string | null;
              lastName?: string | null;
            } | null;
            score?: number;
          }[];
        }>(`${ROOT}/${id}/suggestions`, { params: { limit: 5 } })
        .then((r) => r.data);

      return (res.suggestions ?? []).map(
        (s): ReassignmentSuggestion => ({
          teacherId: s.teacher?._id ?? '',
          teacherName:
            [s.teacher?.lastName, s.teacher?.firstName].filter(Boolean).join(' ') ||
            (s.teacher?._id ?? ''),
          score: s.score,
        }),
      );
    },
    enabled: Boolean(id),
  });
}

export function useReassignVacancy(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (newTeacherId: string) =>
      postJson<unknown>(`${ROOT}/${id}/reassign`, { newTeacherId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [TEACHER_LEAVE_KEY] }),
  });
}

export function useTeachersForSelect() {
  return useQuery({
    queryKey: ['teacherLeave', 'teachers-for-select'],
    queryFn: async () => {
      const docs = await apiClient
        .get<
          Array<{
            _id: string;
            user?: {
              _id: string;
              firstName?: string | null;
              lastName?: string | null;
            } | null;
          }>
        >('/teachers')
        .then((r) => r.data);
      if (!Array.isArray(docs)) return [] as TeacherOption[];
      return docs.reduce<TeacherOption[]>((acc, t) => {
        if (!t.user?._id) return acc;
        const fullName = [t.user.lastName, t.user.firstName]
          .filter(Boolean)
          .join(' ')
          .trim();
        acc.push({ id: t.user._id, fullName: fullName || 'Ismi kiritilmagan' });
        return acc;
      }, []);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useDistributionsForSelect() {
  const can = usePermission();
  const canReadAll = can('workloadDistribution:readAll');

  return useQuery({
    queryKey: ['teacherLeave', 'distributions-for-select', canReadAll],
    queryFn: async () => {
      if (canReadAll) {
        const res = await apiClient
          .get<{
            docs: Array<{
              _id: string;
              title?: string | null;
              status?: string | null;
              active?: boolean | null;
            }>;
          }>('/distributions/paginate', { params: { page: 1, limit: 100 } })
          .then((r) => r.data);
        return (res.docs ?? [])
          .filter(isSelectableDistribution)
          .map(
            (d): DistributionOption => ({ id: d._id, title: d.title ?? null, year: null, course: null }),
          );
      }

      const rows = await apiClient
        .get<
          Array<{
            _id: string;
            academicYear?: { title?: string | null } | string | null;
            course?: number | null;
            status?: string | null;
            active?: boolean | null;
          }>
        >('/distributions/my')
        .then((r) => (Array.isArray(r.data) ? r.data : []));

      return rows.filter(isSelectableDistribution).map((d): DistributionOption => {
        const year =
          d.academicYear && typeof d.academicYear === 'object'
            ? (d.academicYear.title ?? null)
            : null;
        return { id: d._id, title: null, year, course: d.course ?? null };
      });
    },
    staleTime: 5 * 60 * 1000,
  });
}

export { getApiErrorMessage };
