import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { deleteData, fetchList, fetchPaginated, postJson, putJson } from '@/shared/api';
import type { Journal, JournalType } from '../model/types';

const ROOT = '/oak-journals';
const KEY = 'sci-journals';

interface BackendJournal {
  _id: string;
  name: string;
  type: JournalType;
  createdAt?: string;
}

function mapJournal(doc: BackendJournal): Journal {
  return {
    id: doc._id,
    name: doc.name,
    type: doc.type,
    addedDate: doc.createdAt ? doc.createdAt.slice(0, 10) : '',
  };
}

export function useJournals(
  type?: JournalType,
  enabled = true,
) {
  return useQuery({
    enabled,
    queryKey: [KEY, { type: type ?? null }],
    queryFn: async (): Promise<Journal[]> => {
      const docs = await fetchList<BackendJournal>(ROOT, type ? { type } : undefined);
      return docs.map(mapJournal);
    },
    refetchOnWindowFocus: false,
  });
}

export function useJournalsPaginate(page: number, limit: number, type?: JournalType) {
  return useQuery({
    queryKey: [KEY, 'paginate', { page, limit, type: type ?? null }],
    queryFn: async () => {
      const res = await fetchPaginated<BackendJournal>(`${ROOT}/paginate`, {
        page,
        limit,
        type: type || undefined,
      });
      return { ...res, docs: res.docs.map(mapJournal) };
    },
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useCreateJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { name: string; type: JournalType }) => postJson(ROOT, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; name?: string; type?: JournalType }) =>
      putJson(`${ROOT}/${v.id}`, { name: v.name, type: v.type }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
