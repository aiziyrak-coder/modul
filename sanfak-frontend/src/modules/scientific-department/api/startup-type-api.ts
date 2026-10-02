import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { deleteData, fetchList, fetchPaginated, postJson, putJson } from '@/shared/api';
import type { StartupType } from '../model/types';

const ROOT = '/startup-types';
const KEY = 'sci-startup-type';

interface BackendStartupType {
  _id: string;
  name: string;
  active?: boolean;
}

const map = (d: BackendStartupType): StartupType => ({
  id: d._id,
  name: d.name,
  active: d.active !== false,
});

export interface StartupTypePayload {
  name: string;
  active?: boolean;
}

export function useStartupTypesPaginate(page: number, limit: number, search: string) {
  return useQuery({
    queryKey: [KEY, { page, limit, search }],
    queryFn: async () => {
      const res = await fetchPaginated<BackendStartupType>(`${ROOT}/paginate`, {
        page,
        limit,
        search: search || undefined,
      });
      return { ...res, docs: res.docs.map(map) };
    },
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useActiveStartupTypes(enabled = true) {
  return useQuery({
    enabled,
    queryKey: [KEY, 'active'],
    queryFn: async () => {
      const docs = await fetchList<BackendStartupType>(ROOT, { active: true });
      return docs.map(map);
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateStartupType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: StartupTypePayload) => postJson(ROOT, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateStartupType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string } & Partial<StartupTypePayload>) => {
      const { id, ...body } = v;
      return putJson(`${ROOT}/${id}`, body);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteStartupType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
