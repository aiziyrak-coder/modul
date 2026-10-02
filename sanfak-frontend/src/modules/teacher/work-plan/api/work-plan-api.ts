import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiErrorMessage, deleteData, postJson, putJson, patchJson } from '@/shared/api';
import { useSessionStore } from '@/app/session';
import {
  mapPersonalPlan,
  mapPersonalPlanDetail,
  type BackendPersonalPlanList,
  type BackendPersonalPlanDetail,
} from './mapper';
import type {
  ActivitySection,
  PersonalPlan,
  PersonalPlanDetail,
  PersonalPlanStatus,
} from '../model/types';

export const PERSONAL_PLAN_KEY = 'personalWorkPlan';
const ROOT = '/personal-work-plans';

export interface PersonalPlansFilter {
  academicYear?: string;
  status?: PersonalPlanStatus | '';
}

interface BackendAcademicYear {
  _id: string;
  title?: string | null;
}
export interface AcademicYearOption {
  id: string;
  title: string;
}

export function useAcademicYearsForSelect() {
  return useQuery<AcademicYearOption[]>({
    queryKey: ['academicYears', 'list-for-select'],
    queryFn: async () => {
      try {
        const { apiClient } = await import('@/shared/api');
        const res = await apiClient.get<BackendAcademicYear[]>('/academic-years');
        const docs = Array.isArray(res.data) ? res.data : [];
        return docs.map((d) => ({ id: d._id, title: d.title ?? d._id }));
      } catch (e) {
        if (import.meta.env.DEV) console.warn("[perm] reference so'rovi muvaffaqiyatsiz:", e);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function usePersonalPlans(filter: PersonalPlansFilter = {}) {
  const userId = useSessionStore((s) => s.user?.id);

  return useQuery<PersonalPlan[]>({
    queryKey: [PERSONAL_PLAN_KEY, 'list', userId, filter],
    queryFn: async () => {
      const { apiClient } = await import('@/shared/api');
      const params: Record<string, string> = {};
      if (userId && userId !== 'dev-user') {
        params['teacher'] = userId;
      }
      if (filter.academicYear) params['academicYear'] = filter.academicYear;
      if (filter.status) params['status'] = filter.status;

      const res = await apiClient.get<BackendPersonalPlanList[]>(ROOT, { params });
      const docs = Array.isArray(res.data) ? res.data : [];
      return docs.map(mapPersonalPlan);
    },
    enabled: true,
  });
}

export function usePersonalPlan(id: string | undefined) {
  return useQuery<PersonalPlanDetail>({
    queryKey: [PERSONAL_PLAN_KEY, 'detail', id],
    queryFn: async () => {
      if (!id) throw new Error('id kerak');
      const { apiClient } = await import('@/shared/api');
      const res = await apiClient.get<BackendPersonalPlanDetail>(`${ROOT}/${id}`);
      return mapPersonalPlanDetail(res.data);
    },
    enabled: Boolean(id),
  });
}

export function useGeneratePersonalPlan() {
  const qc = useQueryClient();
  const userId = useSessionStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async ({ academicYear }: { academicYear: string }) => {
      const { apiClient } = await import('@/shared/api');
      const res = await apiClient.post<{ message: string; _id: string; plannedHour: number; scienceCount: number }>(
        `${ROOT}/generate`,
        {
          teacher: userId,
          academicYear,
        },
      );
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [PERSONAL_PLAN_KEY] }),
  });
}

export function useDeletePersonalPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [PERSONAL_PLAN_KEY] }),
  });
}

function invalidatePlan(qc: ReturnType<typeof useQueryClient>, id: string) {
  void qc.invalidateQueries({ queryKey: [PERSONAL_PLAN_KEY, 'detail', id] });
  void qc.invalidateQueries({ queryKey: [PERSONAL_PLAN_KEY, 'list'] });
}

export function useAddActivity(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      section,
      payload,
    }: {
      section: ActivitySection;
      payload: Record<string, unknown>;
    }) => postJson<{ message: string }>(`${ROOT}/${planId}/activity`, { section, item: payload }),
    onSuccess: () => invalidatePlan(qc, planId),
  });
}

export function useUpdateActivity(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      activityId,
      section,
      payload,
    }: {
      activityId: string;
      section: ActivitySection;
      payload: Record<string, unknown>;
    }) =>
      putJson<{ message: string }>(`${ROOT}/${planId}/activity/${activityId}`, {
        section,
        ...payload,
      }),
    onSuccess: () => invalidatePlan(qc, planId),
  });
}

export function useDeleteActivity(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ activityId, section }: { activityId: string; section: ActivitySection }) => {
      const { apiClient } = await import('@/shared/api');
      const res = await apiClient.delete<{ message: string }>(
        `${ROOT}/${planId}/activity/${activityId}`,
        { data: { section } },
      );
      return res.data;
    },
    onSuccess: () => invalidatePlan(qc, planId),
  });
}

export function useCompleteActivity(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      activityId,
      section,
      fileUrl,
      link,
      actualCount,
    }: {
      activityId: string;
      section: ActivitySection;
      fileUrl?: string;
      link?: string;
      actualCount?: number;
    }) =>
      patchJson<{ message: string }>(`${ROOT}/${planId}/activity/${activityId}/complete`, {
        section,
        fileUrl: fileUrl || undefined,
        link: link || undefined,
        actualCount,
      }),
    onSuccess: () => invalidatePlan(qc, planId),
  });
}

export function useSubmitWorkPlan(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postJson<{ message: string; status: string }>(`${ROOT}/${planId}/submit`, {}),
    onSuccess: () => invalidatePlan(qc, planId),
  });
}

export function useApproveWorkPlan(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (comment?: string) =>
      patchJson<{ message: string; status: string }>(`${ROOT}/${planId}/approve`, {
        comment: comment || undefined,
      }),
    onSuccess: () => invalidatePlan(qc, planId),
  });
}

export function useRejectWorkPlan(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (comment: string) =>
      patchJson<{ message: string; status: string }>(`${ROOT}/${planId}/reject`, { comment }),
    onSuccess: () => invalidatePlan(qc, planId),
  });
}

export function useReopenWorkPlan(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => patchJson<{ message: string; status: string }>(`${ROOT}/${planId}/reopen`, {}),
    onSuccess: () => invalidatePlan(qc, planId),
  });
}

export function useCompleteWorkPlan(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => patchJson<{ message: string; status: string }>(`${ROOT}/${planId}/complete`, {}),
    onSuccess: () => invalidatePlan(qc, planId),
  });
}

export function useUpdatePersonalPlanName(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      putJson<{ message: string }>(`${ROOT}/${planId}`, { name }),
    onSuccess: () => invalidatePlan(qc, planId),
  });
}

export async function downloadPersonalPlanPdf(id: string, filename: string): Promise<void> {
  const { apiClient } = await import('@/shared/api');
  const res = await apiClient.get(`${ROOT}/${id}/pdf`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export { getApiErrorMessage };
