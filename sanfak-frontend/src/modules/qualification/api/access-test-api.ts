import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteData,
  fetchOne,
  fetchPaginated,
  postJson,
  putJson,
  type Paginated,
} from '@/shared/api';
import type {
  AccessTestInput,
  AccessTestQuestion,
  ReorderItem,
  TestConfig,
} from '../model/access-test.types';
import { mapAccessTest, type BackendAccessTest } from './access-test-mapper';

const KEY = 'qual-access-test';
const ROOT = '/qualification-access-tests';

export function useAccessTestQuestions(
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

export function useCreateAccessTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AccessTestInput) => postJson<BackendAccessTest>(ROOT, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useBulkCreateAccessTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { course: string; items: Omit<AccessTestInput, 'course'>[] }) =>
      postJson(`${ROOT}/bulk`, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export async function fetchAllAccessTests(courseId: string): Promise<AccessTestQuestion[]> {
  const res: Paginated<BackendAccessTest> = await fetchPaginated(`${ROOT}/paginate`, {
    course: courseId,
    page: 1,
    limit: 10000,
  });
  return res.docs.map(mapAccessTest);
}

export function useUpdateAccessTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; input: Omit<AccessTestInput, 'course'> }) =>
      putJson(`${ROOT}/${v.id}`, v.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteAccessTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useReorderAccessTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: ReorderItem[]) => putJson(`${ROOT}/reorder`, { items }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

const CONFIG_ROOT = '/qualification-test-configs';

interface BackendTestConfig {
  timeLimit?: number;
  randomCount?: number;
  passPercentage?: number;
}

export function useTestConfig(
  courseId: string | undefined,
  kind: number,
  enabled = true,
  topic?: string,
) {
  return useQuery({
    staleTime: 0,
    queryKey: [KEY, 'config', courseId, kind, topic ?? null],
    queryFn: async (): Promise<TestConfig> => {
      const url = topic
        ? `${CONFIG_ROOT}?course=${courseId}&kind=${kind}&topic=${topic}`
        : `${CONFIG_ROOT}?course=${courseId}&kind=${kind}`;
      const b = await fetchOne<BackendTestConfig>(url);
      return {
        timeLimit: b.timeLimit ?? 0,
        randomCount: b.randomCount ?? 0,
        passPercentage: b.passPercentage ?? 60,
      };
    },
    enabled: enabled && !!courseId,
  });
}

export function useSaveTestConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { course: string; kind: number; topic?: string } & TestConfig) =>
      putJson(CONFIG_ROOT, v),
    onSuccess: (_data, v) =>
      qc.invalidateQueries({ queryKey: [KEY, 'config', v.course, v.kind, v.topic ?? null] }),
  });
}
