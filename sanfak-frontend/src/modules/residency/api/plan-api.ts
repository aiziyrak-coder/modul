import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchList, fetchOne, postJson, putJson, deleteData, uploadMultipart } from '@/shared/api';
import type { AppNotification, PlanStats, WorkPlan, WorkPlanTask } from './plan-types';
import {
  mapNotification,
  mapWorkPlan,
  toWorkPlanPayload,
  type BackendNotification,
  type BackendWorkPlan,
} from './plan-mapper';

type Q = Record<string, string | number | boolean | undefined | null>;
function qs(params: Q): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export function makePlanHooks(root: string, key: string) {
  return {
    usePlans(params: Q = {}) {
      return useQuery({
        queryKey: [key, 'list', params],
        placeholderData: keepPreviousData,
        queryFn: async (): Promise<WorkPlan[]> =>
          (await fetchList<BackendWorkPlan>(`${root}${qs(params)}`)).map(mapWorkPlan),
      });
    },
    usePlan(id: string | undefined) {
      return useQuery({
        queryKey: [key, id],
        enabled: !!id,
        queryFn: async (): Promise<WorkPlan> =>
          mapWorkPlan(await fetchOne<BackendWorkPlan>(`${root}/${id}`)),
      });
    },
    useStats() {
      return useQuery({
        queryKey: [key, 'stats'],
        queryFn: (): Promise<PlanStats> => fetchOne<PlanStats>(`${root}/stats`),
      });
    },
    useCreate() {
      const q = useQueryClient();
      return useMutation({
        mutationFn: (p: { title: string; academicYear?: string; tasks?: WorkPlanTask[] }) =>
          postJson(root, toWorkPlanPayload(p)),
        onSuccess: () => q.invalidateQueries({ queryKey: [key] }),
      });
    },
    useUpdate() {
      const q = useQueryClient();
      return useMutation({
        mutationFn: ({ id, data }: { id: string; data: { title?: string; academicYear?: string; tasks?: WorkPlanTask[] } }) =>
          putJson(`${root}/${id}`, toWorkPlanPayload(data)),
        onSuccess: () => q.invalidateQueries({ queryKey: [key] }),
      });
    },
    useSubmit() {
      const q = useQueryClient();
      return useMutation({
        mutationFn: (id: string) => putJson(`${root}/${id}/submit`, {}),
        onSuccess: () => q.invalidateQueries({ queryKey: [key] }),
      });
    },
    useApprove() {
      const q = useQueryClient();
      return useMutation({
        mutationFn: ({ id, eriKey }: { id: string; eriKey?: string }) =>
          putJson(`${root}/${id}/approve`, { eriKey }),
        onSuccess: () => q.invalidateQueries({ queryKey: [key] }),
      });
    },
    useReject() {
      const q = useQueryClient();
      return useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) =>
          putJson(`${root}/${id}/reject`, { reason }),
        onSuccess: () => q.invalidateQueries({ queryKey: [key] }),
      });
    },
    useAddProof() {
      const q = useQueryClient();
      return useMutation({
        mutationFn: ({
          id,
          taskIndex,
          data,
        }: {
          id: string;
          taskIndex: number;
          data: {
            file?: File | null;
            url?: string;
            comment?: string;
            workDate?: string;
          };
        }) =>
          uploadMultipart(`${root}/${id}/tasks/${taskIndex}/proofs`, 'POST', {
            file: data.file ?? null,
            url: data.url ?? null,
            comment: data.comment ?? null,
            workDate: data.workDate ?? null,
          }),
        onSuccess: () => q.invalidateQueries({ queryKey: [key] }),
      });
    },
    useReviewProof() {
      const q = useQueryClient();
      return useMutation({
        mutationFn: ({ id, taskIndex, proofIndex, decision, comment }: {
          id: string; taskIndex: number; proofIndex: number; decision: 'approved' | 'rejected'; comment?: string;
        }) =>
          putJson(`${root}/${id}/tasks/${taskIndex}/proofs/${proofIndex}/review`, { decision, comment }),
        onSuccess: () => q.invalidateQueries({ queryKey: [key] }),
      });
    },
    useDelete() {
      const q = useQueryClient();
      return useMutation({
        mutationFn: (id: string) => deleteData(`${root}/${id}`),
        onSuccess: () => q.invalidateQueries({ queryKey: [key] }),
      });
    },
  };
}

export type PlanHooks = ReturnType<typeof makePlanHooks>;

export const activityPlanHooks = makePlanHooks('/activity-plans', 'residency-activity-plans');
export const dissertationPlanHooks = makePlanHooks('/dissertation-plans', 'residency-dissertation-plans');

const NOTIF = '/notifications';
const NOTIF_KEY = 'residency-notifications';

export function useNotifications() {
  return useQuery({
    queryKey: [NOTIF_KEY],
    refetchInterval: 15000,
    queryFn: async (): Promise<AppNotification[]> => {
      const res = await fetchOne<unknown>(`${NOTIF}?page=1&limit=50`);
      const arr: BackendNotification[] = Array.isArray(res)
        ? (res as BackendNotification[])
        : ((res as { docs?: BackendNotification[] })?.docs ?? []);
      return arr.map(mapNotification);
    },
  });
}
export function useMarkNotificationRead() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => putJson(`${NOTIF}/${id}/read`, {}),
    onSuccess: () => q.invalidateQueries({ queryKey: [NOTIF_KEY] }),
  });
}
