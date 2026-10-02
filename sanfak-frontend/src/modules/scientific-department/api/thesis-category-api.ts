import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { deleteData, fetchList, fetchPaginated, postJson, putJson } from '@/shared/api';
import type { ThesisCategory, ThesisType } from '../model/types';

const ROOT = '/thesis-categories';
const KEY = 'sci-thesis-categories';

interface BackendCategory {
  _id: string;
  name: string;
  type: ThesisType;
  createdAt?: string;
}

function mapCategory(doc: BackendCategory): ThesisCategory {
  return {
    id: doc._id,
    name: doc.name,
    type: doc.type,
    addedDate: doc.createdAt ? doc.createdAt.slice(0, 10) : '',
  };
}

export function useThesisCategories(type?: ThesisType) {
  return useQuery({
    queryKey: [KEY, { type: type ?? null }],
    queryFn: async (): Promise<ThesisCategory[]> => {
      const docs = await fetchList<BackendCategory>(ROOT, type ? { type } : undefined);
      return docs.map(mapCategory);
    },
    refetchOnWindowFocus: false,
  });
}

export function useThesisCategoriesPaginate(
  page: number,
  limit: number,
  type?: ThesisType,
) {
  return useQuery({
    queryKey: [KEY, 'paginate', { page, limit, type: type ?? null }],
    queryFn: async () => {
      const res = await fetchPaginated<BackendCategory>(`${ROOT}/paginate`, {
        page,
        limit,
        type: type || undefined,
      });
      return { ...res, docs: res.docs.map(mapCategory) };
    },
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useCreateThesisCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { name: string; type: ThesisType }) => postJson(ROOT, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateThesisCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; name?: string; type?: ThesisType }) =>
      putJson(`${ROOT}/${v.id}`, { name: v.name, type: v.type }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteThesisCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
