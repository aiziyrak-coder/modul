import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteData, fetchList, fetchPaginated, uploadMultipart, type Paginated } from '@/shared/api';
import type { SourceInput } from '../model/source.types';
import { mapSource, type BackendSource } from './source-mapper';

const KEY = 'qual-source';
const ROOT = '/qualification-sources';

export interface SourceFilter {
  page: number;
  limit: number;
  [key: string]: unknown;
}

export function useSourcesPaginated(filter: SourceFilter, enabled = true) {
  return useQuery({
    staleTime: 0,
    queryKey: [KEY, 'paginate', filter],
    queryFn: async () => {
      const res: Paginated<BackendSource> = await fetchPaginated(`${ROOT}/paginate`, filter);
      return {
        items: res.docs.map(mapSource),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs, totalPages: res.totalPages },
      };
    },
    enabled,
  });
}

export function useSourcesByCourse(courseId: string | undefined) {
  return useQuery({
    staleTime: 0,
    queryKey: [KEY, 'by-course-name', courseId],
    queryFn: async () => {
      const docs = await fetchList<BackendSource>(`${ROOT}/by-course-name`, { course: courseId });
      return docs.map(mapSource);
    },
    enabled: !!courseId,
  });
}

export function useCreateSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SourceInput) => {
      const payload: Record<string, string | File> = {
        title: input.title,
        course: input.course,
        file: input.file,
      };
      if (input.link) payload.link = input.link;
      return uploadMultipart(ROOT, 'POST', payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
