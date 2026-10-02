import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { deleteData, fetchList, fetchPaginated, postJson, putJson } from '@/shared/api';
import type { MethodicalSpecialty } from '../model/types';

const ROOT = '/methodical-specialties';
const KEY = 'sci-methodical-specialty';

interface BackendSpecialty {
  _id: string;
  code: string;
  name: string;
  active?: boolean;
}

const map = (d: BackendSpecialty): MethodicalSpecialty => ({
  id: d._id,
  code: d.code,
  name: d.name,
  active: d.active !== false,
  label: `${d.code} — ${d.name}`,
});

export interface MethodicalSpecialtyPayload {
  code: string;
  name: string;
  active?: boolean;
}

export function useMethodicalSpecialtiesPaginate(
  page: number,
  limit: number,
  search: string,
) {
  return useQuery({
    queryKey: [KEY, { page, limit, search }],
    queryFn: async () => {
      const res = await fetchPaginated<BackendSpecialty>(`${ROOT}/paginate`, {
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

export function useActiveMethodicalSpecialties(enabled = true) {
  return useQuery({
    enabled,
    queryKey: [KEY, 'active'],
    queryFn: async () => {
      const docs = await fetchList<BackendSpecialty>(ROOT, { active: true });
      return docs.map(map);
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateMethodicalSpecialty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: MethodicalSpecialtyPayload) => postJson(ROOT, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateMethodicalSpecialty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string } & Partial<MethodicalSpecialtyPayload>) => {
      const { id, ...body } = v;
      return putJson(`${ROOT}/${id}`, body);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteMethodicalSpecialty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
