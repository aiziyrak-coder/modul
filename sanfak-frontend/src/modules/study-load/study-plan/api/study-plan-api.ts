import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  apiClient,
  deleteData,
  fetchList,
  fetchPaginated,
  getApiErrorMessage,
  type Paginated,
} from '@/shared/api';
import { mapStudyPlan, type BackendStudyPlan } from './mapper';
import type { DirectionRef } from '../model/types';

export const STUDY_PLAN_KEY = 'study-plan';
const KEY = STUDY_PLAN_KEY;
const ROOT = '/study-plans';

interface BackendDirection {
  _id: string;
  title: string;
  knowledgeArea?: string | null;
  educationArea?: string | null;
}

export interface StudyPlansFilter {
  page: number;
  limit: number;
  search?: string;
  direction?: string;
  academicYear?: string;
  active?: string;
}

export function useStudyPlans(filter: StudyPlansFilter) {
  return useQuery({
    queryKey: [KEY, 'paginate', filter],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        page: filter.page,
        limit: filter.limit,
      };
      if (filter.search) params['search'] = filter.search;
      if (filter.direction) params['direction'] = filter.direction;
      if (filter.academicYear) params['academicYear'] = filter.academicYear;
      if (filter.active) params['active'] = filter.active;

      const res: Paginated<BackendStudyPlan> = await fetchPaginated(
        `${ROOT}/paginate`,
        params as { page: number; limit: number; [key: string]: unknown },
      );
      return {
        items: res.docs.map(mapStudyPlan),
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

export interface StudyPlanImportReport {
  total: number;
  linked: number;
  unlinkedCount: number;
  unlinkedDistinct: number;
  unlinked: { code: string | null; title: string | null }[];
}

interface CreateStudyPlanResponse {
  message?: string;
  import?: StudyPlanImportReport;
}

export function useCreateStudyPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      apiClient
        .post<CreateStudyPlanResponse>('/learning-process', formData)
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteStudyPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDirections() {
  return useQuery({
    queryKey: ['directions', 'list-for-filter'],
    queryFn: async (): Promise<DirectionRef[]> => {
      try {
        const docs = await fetchList<BackendDirection>('/directions', { active: true });
        return docs.map((d) => ({
          id: d._id,
          title: d.title,
          knowledgeArea: d.knowledgeArea ?? undefined,
          educationArea: d.educationArea ?? undefined,
        }));
      } catch (e) {
        if (import.meta.env.DEV) console.warn("[perm] reference so'rovi muvaffaqiyatsiz:", e);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

export { getApiErrorMessage };
