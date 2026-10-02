import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  apiClient,
  deleteData,
  fetchPaginated,
  getApiErrorMessage,
  type Paginated,
} from '@/shared/api';
import {
  mapWorkingPlan,
  mapWorkingPlanDetail,
  mapElectiveUsageInfo,
  mapElectiveSwapResult,
  mapElectiveAlternativesResult,
  mapScienceOption,
  type BackendWorkingPlan,
  type BackendWorkingPlanDetail,
  type BackendElectiveUsageInfo,
  type BackendElectiveSwapResult,
  type BackendElectiveAlternativesResult,
  type BackendScienceOption,
} from './mapper';
import type { ElectiveAlternativesResult, ElectiveSwapResult, UnfilledSlot } from '../model/types';

export const WORKING_PLAN_KEY = 'working-plan';
const ROOT = '/working-plans';

export interface WorkingPlansFilter {
  page: number;
  limit: number;
  search?: string;
  workingSchedule?: string;
}

export function useWorkingPlans(filter: WorkingPlansFilter) {
  return useQuery({
    queryKey: [WORKING_PLAN_KEY, 'paginate', filter],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        page: filter.page,
        limit: filter.limit,
      };
      if (filter.search) params['search'] = filter.search;
      if (filter.workingSchedule) params['workingSchedule'] = filter.workingSchedule;

      const res: Paginated<BackendWorkingPlan> = await fetchPaginated(
        `${ROOT}/paginate`,
        params as { page: number; limit: number; [key: string]: unknown },
      );
      return {
        items: res.docs.map(mapWorkingPlan),
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

export function useWorkingPlan(id: string | undefined) {
  return useQuery({
    queryKey: [WORKING_PLAN_KEY, 'detail', id],
    queryFn: async () => {
      if (!id) throw new Error('id kerak');
      const res = await apiClient.get<BackendWorkingPlanDetail>(`${ROOT}/${id}`);
      return mapWorkingPlanDetail(res.data);
    },
    enabled: Boolean(id),
  });
}

const gridQueryKey = (workingScheduleId: string | undefined) =>
  [WORKING_PLAN_KEY, 'grid', workingScheduleId] as const;

async function fetchGrid(workingScheduleId: string | undefined) {
  if (!workingScheduleId) throw new Error('workingSchedule ID kerak');
  const res = await apiClient.get<BackendWorkingPlanDetail>(`${ROOT}/plan`, {
    params: { workingSchedule: workingScheduleId },
  });
  return mapWorkingPlanDetail(res.data);
}

export function useWorkingPlanGrid(workingScheduleId: string | undefined) {
  return useQuery({
    queryKey: gridQueryKey(workingScheduleId),
    queryFn: () => fetchGrid(workingScheduleId),
    enabled: Boolean(workingScheduleId),
  });
}

export async function fetchUnfilledSlots(
  qc: QueryClient,
  workingScheduleId: string,
): Promise<UnfilledSlot[]> {
  try {
    const grid = await qc.fetchQuery({
      queryKey: gridQueryKey(workingScheduleId),
      queryFn: () => fetchGrid(workingScheduleId),
      staleTime: 0,
    });
    return grid.unfilledSlots;
  } catch {
    return [];
  }
}

export function useWorkingPlanSciences(workingScheduleId: string | undefined) {
  return useQuery({
    queryKey: [WORKING_PLAN_KEY, 'sciences', workingScheduleId],
    queryFn: async () => {
      if (!workingScheduleId) throw new Error('workingSchedule ID kerak');
      const res = await apiClient.get<unknown>(`${ROOT}/science`, {
        params: { workingSchedule: workingScheduleId },
      });
      return res.data;
    },
    enabled: Boolean(workingScheduleId),
  });
}

export function useDeleteWorkingPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [WORKING_PLAN_KEY] }),
  });
}

export interface UpdateWorkingPlanSciencePayload {
  planDocId: string;
  semKey: string;
  parentId: string;
  _id: string;
  particle: { _id: string; [slug: string]: number | string }[];
  title: string | null;
  code: string | null;
  serialNumber: string | null;
  totalCredit: number;
  evaluationType?: string | null;
}

export interface UpdateWorkingPlanScienceResult {
  evaluationTypeWriteThrough?: { persisted: boolean; persistError?: string };
}

export function useUpdateWorkingPlanScience(workingScheduleId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planDocId, semKey, parentId, _id, particle, title, code, serialNumber, totalCredit, evaluationType }: UpdateWorkingPlanSciencePayload) =>
      apiClient
        .put<UpdateWorkingPlanScienceResult>(`${ROOT}/study-plan/${planDocId}`, {
          semKey,
          parentId,
          _id,
          particle,
          title,
          code,
          serialNumber,
          totalCredit,
          ...(evaluationType !== undefined ? { evaluationType } : {}),
        })
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: [WORKING_PLAN_KEY, 'grid', workingScheduleId],
      });
    },
  });
}

export interface ElectiveRowRef {
  planDocId: string;
  semKey: string;
  blockId: string;
  scienceRowId: string;
}

export interface SwapElectiveSciencePayload extends ElectiveRowRef {
  scienceId: string;
}

export function useElectiveUsage(ref: ElectiveRowRef | null) {
  return useQuery({
    queryKey: [
      WORKING_PLAN_KEY,
      'elective-usage',
      ref?.planDocId,
      ref?.semKey,
      ref?.blockId,
      ref?.scienceRowId,
    ],
    queryFn: async () => {
      if (!ref) throw new Error('elective row ref kerak');
      const res = await apiClient.get<{ data: BackendElectiveUsageInfo }>(
        `${ROOT}/${ref.planDocId}/elective-usage`,
        { params: { semKey: ref.semKey, parentId: ref.blockId, _id: ref.scienceRowId } },
      );
      return mapElectiveUsageInfo(res.data.data);
    },
    enabled: Boolean(ref),
    staleTime: 0,
  });
}

export async function putElectiveScience(
  payload: SwapElectiveSciencePayload,
): Promise<ElectiveSwapResult> {
  const res = await apiClient.put<{ data: BackendElectiveSwapResult }>(
    `${ROOT}/${payload.planDocId}/elective-science`,
    {
      semKey: payload.semKey,
      parentId: payload.blockId,
      _id: payload.scienceRowId,
      scienceId: payload.scienceId,
    },
  );
  return mapElectiveSwapResult(res.data.data);
}

export function useSwapElectiveScience(workingScheduleId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: putElectiveScience,
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: [WORKING_PLAN_KEY, 'grid', workingScheduleId],
      });
      void qc.invalidateQueries({
        queryKey: [WORKING_PLAN_KEY, 'elective-usage'],
      });
    },
  });
}

export interface SetElectiveAlternativesPayload extends ElectiveRowRef {
  scienceIds: string[];
}

export async function putElectiveAlternatives(
  payload: SetElectiveAlternativesPayload,
): Promise<ElectiveAlternativesResult> {
  const res = await apiClient.put<{ data: BackendElectiveAlternativesResult }>(
    `${ROOT}/${payload.planDocId}/elective-alternatives`,
    {
      semKey: payload.semKey,
      blockId: payload.blockId,
      scienceRowId: payload.scienceRowId,
      alternatives: payload.scienceIds.map((scienceId) => ({ scienceId })),
    },
  );
  return mapElectiveAlternativesResult(res.data.data);
}

export function useSetElectiveAlternatives(workingScheduleId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: putElectiveAlternatives,
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: [WORKING_PLAN_KEY, 'grid', workingScheduleId],
      });
    },
  });
}

const SCIENCE_PAGE_LIMIT = 50;

export function useScienceCatalog(search: string, enabled: boolean) {
  return useQuery({
    queryKey: ['study-load', 'science-catalog', 'elective', search],
    queryFn: async () => {
      const params: { page: number; limit: number; [key: string]: unknown } = {
        page: 1,
        limit: SCIENCE_PAGE_LIMIT,
        active: true,
        isElective: true,
      };
      if (search.trim()) params['search'] = search.trim();
      const res = await fetchPaginated<BackendScienceOption>('/sciences/paginate', params);
      return res.docs.map(mapScienceOption);
    },
    enabled,
    staleTime: 60_000,
  });
}

export { getApiErrorMessage };
