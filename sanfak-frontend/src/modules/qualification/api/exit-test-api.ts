import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteData, fetchPaginated, postJson, putJson, type Paginated } from '@/shared/api';
import type { AccessTestInput, AccessTestQuestion, ReorderItem } from '../model/access-test.types';
import { mapAccessTest, type BackendAccessTest } from './access-test-mapper';

const KEY = 'qual-exit-test';
const ROOT = '/qualification-exit-tests';

export function useExitTestQuestions(
  courseId: string | undefined,
  page: number,
  limit: number,
) {
  return useQuery({
    staleTime: 0,
    refetchOnWindowFocus: false,
    queryKey: [KEY, 'paginate', courseId, page, limit],
    queryFn: async () => {
      const res: Paginated<BackendAccessTest> = await fetchPaginated(`${ROOT}/paginate`, {
        course: courseId,
        page,
        limit,
      });
      return {
        items: res.docs.map(mapAccessTest),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs, totalPages: res.totalPages },
      };
    },
    enabled: !!courseId,
  });
}

export function useCreateExitTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AccessTestInput) => postJson<BackendAccessTest>(ROOT, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useBulkCreateExitTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { course: string; items: Omit<AccessTestInput, 'course'>[] }) =>
      postJson(`${ROOT}/bulk`, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export async function fetchAllExitTests(courseId: string): Promise<AccessTestQuestion[]> {
  const res: Paginated<BackendAccessTest> = await fetchPaginated(`${ROOT}/paginate`, {
    course: courseId,
    page: 1,
    limit: 10000,
  });
  return res.docs.map(mapAccessTest);
}

export function useUpdateExitTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; input: Omit<AccessTestInput, 'course'> }) =>
      putJson(`${ROOT}/${v.id}`, v.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteExitTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useReorderExitTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: ReorderItem[]) => putJson(`${ROOT}/reorder`, { items }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
