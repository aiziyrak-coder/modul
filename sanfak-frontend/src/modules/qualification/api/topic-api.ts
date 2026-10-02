import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteData, fetchPaginated, postJson, putJson, type Paginated } from '@/shared/api';
import type { TopicInput } from '../model/topic.types';
import { mapTopic, type BackendTopic } from './topic-mapper';

const KEY = 'qual-topic';
const ROOT = '/qualification-topics';

export interface TopicFilter {
  course: string;
  page: number;
  limit: number;
  [key: string]: unknown;
}

export function useTopicsByCoursePaginated(filter: TopicFilter) {
  return useQuery({
    staleTime: 0,
    queryKey: [KEY, 'paginate', filter],
    queryFn: async () => {
      const res: Paginated<BackendTopic> = await fetchPaginated(`${ROOT}/paginate`, filter);
      return {
        items: res.docs.map(mapTopic),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs, totalPages: res.totalPages },
      };
    },
    enabled: !!filter.course,
  });
}

export function useCreateTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TopicInput) => postJson(ROOT, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; input: Omit<TopicInput, 'course'> }) =>
      putJson(`${ROOT}/${v.id}`, v.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
