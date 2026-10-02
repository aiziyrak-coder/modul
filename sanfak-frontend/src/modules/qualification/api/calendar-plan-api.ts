import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteData,
  fetchList,
  fetchPaginated,
  uploadMultipart,
  type Paginated,
} from '@/shared/api';
import type { CalendarPlanInput } from '../model/calendar-plan.types';
import { mapCalendarPlan, type BackendCalendarPlan } from './calendar-plan-mapper';

const KEY = 'qual-calendar-plan';
const ROOT = '/qualification-calendar-plans';

export interface CalendarPlanFilter {
  page: number;
  limit: number;
  [key: string]: unknown;
}

export function useCalendarPlansPaginated(filter: CalendarPlanFilter) {
  return useQuery({
    staleTime: 0,
    queryKey: [KEY, 'paginate', filter],
    queryFn: async () => {
      const res: Paginated<BackendCalendarPlan> = await fetchPaginated(`${ROOT}/paginate`, filter);
      return {
        items: res.docs.map(mapCalendarPlan),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs, totalPages: res.totalPages },
      };
    },
  });
}

export function useCalendarPlans() {
  return useQuery({
    staleTime: 0,
    queryKey: [KEY, 'all'],
    queryFn: async () => (await fetchList<BackendCalendarPlan>(ROOT)).map(mapCalendarPlan),
  });
}

export function useCreateCalendarPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CalendarPlanInput) =>
      uploadMultipart(ROOT, 'POST', { title: input.title, file: input.file }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteCalendarPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
