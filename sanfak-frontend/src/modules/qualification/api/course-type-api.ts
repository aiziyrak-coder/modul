import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteData, fetchPaginated, uploadMultipart, type Paginated } from '@/shared/api';
import type { CourseTypeInput } from '../model/course-type.types';
import { DOC_TO_KIND } from '../model/course-type.types';
import { mapCourseType, type BackendCourseType } from './course-type-mapper';
import { courseTypeMock } from './course-type-mock';

const USE_MOCK = false;

const KEY = 'qual-course-type';
const ROOT = '/qualification-course-types';

export interface CourseTypeFilter {
  page: number;
  limit: number;
  kind?: number;
  [key: string]: unknown;
}

export function useCourseTypesPaginated(filter: CourseTypeFilter) {
  return useQuery({
    staleTime: 0,
    queryKey: [KEY, 'paginate', filter],
    queryFn: async () => {
      const res: Paginated<BackendCourseType> = USE_MOCK
        ? await courseTypeMock.paginate(filter)
        : await fetchPaginated(`${ROOT}/paginate`, filter);
      return {
        items: res.docs.map(mapCourseType),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs, totalPages: res.totalPages },
      };
    },
  });
}

export function useCreateCourseType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CourseTypeInput) =>
      USE_MOCK
        ? courseTypeMock.create(input)
        : uploadMultipart(ROOT, 'POST', {
            title: input.title,
            kind: String(DOC_TO_KIND[input.docKind]),
            template: String(input.template),
          }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteCourseType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      USE_MOCK ? courseTypeMock.remove(id) : deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
