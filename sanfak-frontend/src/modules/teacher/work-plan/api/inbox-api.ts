import { useQuery } from '@tanstack/react-query';
import { fetchPaginated, getApiErrorMessage } from '@/shared/api';
import { mapPersonalPlan, type BackendPersonalPlanList } from './mapper';
import { PERSONAL_PLAN_KEY } from './work-plan-api';
import type { PersonalPlan } from '../model/types';

const ROOT = '/personal-work-plans';

export const INBOX_SCAN_LIMIT = 100;

export interface WorkPlanInboxData {
  plans: PersonalPlan[];
  totalSubmitted: number;
  isTruncated: boolean;
}

export function useWorkPlanApprovalInbox() {
  return useQuery<WorkPlanInboxData>({
    queryKey: [PERSONAL_PLAN_KEY, 'inbox'],
    queryFn: async () => {
      const res = await fetchPaginated<BackendPersonalPlanList>(`${ROOT}/paginate`, {
        page: 1,
        limit: INBOX_SCAN_LIMIT,
        status: 'submitted',
      });
      const docs = Array.isArray(res.docs) ? res.docs : [];
      const totalSubmitted = res.totalDocs ?? docs.length;

      return {
        plans: docs.map(mapPersonalPlan),
        totalSubmitted,
        isTruncated: totalSubmitted > docs.length,
      };
    },
    staleTime: 0,
    gcTime: 0,
  });
}

export interface AwaitingCompletionData {
  plans: PersonalPlan[];
  total: number;
  isTruncated: boolean;
}

export function useWorkPlansAwaitingCompletion(enabled: boolean) {
  return useQuery<AwaitingCompletionData>({
    queryKey: [PERSONAL_PLAN_KEY, 'awaiting-completion'],
    enabled,
    queryFn: async () => {
      const res = await fetchPaginated<BackendPersonalPlanList>(`${ROOT}/paginate`, {
        page: 1,
        limit: INBOX_SCAN_LIMIT,
        status: 'approved',
      });
      const docs = Array.isArray(res.docs) ? res.docs : [];
      const total = res.totalDocs ?? docs.length;
      return { plans: docs.map(mapPersonalPlan), total, isTruncated: total > docs.length };
    },
    staleTime: 0,
    gcTime: 0,
  });
}

export { getApiErrorMessage };
