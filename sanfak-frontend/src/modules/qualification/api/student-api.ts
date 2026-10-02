import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPaginated, putJson, type Paginated } from '@/shared/api';
import type { EduType } from '../model/student.types';
import { mapStudent, type BackendSubscription } from './student-mapper';

const KEY = 'qual-course-subscription';
const ROOT = '/qualification-course-subscriptions';

export interface StudentFilter {
  course: string;
  page: number;
  limit: number;
  search?: string;
  [key: string]: unknown;
}

export function useCourseStudentsPaginated(filter: StudentFilter) {
  return useQuery({
    staleTime: 0,
    queryKey: [KEY, 'paginate', filter],
    queryFn: async () => {
      const res: Paginated<BackendSubscription> = await fetchPaginated(`${ROOT}/paginate`, filter);
      return {
        items: res.docs.map(mapStudent),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs, totalPages: res.totalPages },
      };
    },
    enabled: !!filter.course,
  });
}

export function useChangeEducationType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; educationType: EduType }) =>
      putJson(`${ROOT}/${v.id}`, { educationType: v.educationType }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
