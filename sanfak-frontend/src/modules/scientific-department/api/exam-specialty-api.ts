import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { deleteData, fetchList, fetchPaginated, postJson, putJson } from '@/shared/api';
import type {
  EffectiveSpecialtyStatus,
  ExamSpecialty,
  ExamSpecialtyFilters,
  ExamSpecialtyStatus,
} from '../model/types';

const ROOT = '/exam-specialties';
const KEY = 'sci-exam-specialty';

interface BackendSpecialty {
  _id: string;
  code: string;
  name?: string;
  regStart?: string | null;
  regEnd?: string | null;
  status: ExamSpecialtyStatus;
  effectiveStatus?: EffectiveSpecialtyStatus;
  isOpen?: boolean;
}

const day = (d?: string | null): string | null => (d ? d.slice(0, 10) : null);

const mapSpecialty = (d: BackendSpecialty): ExamSpecialty => ({
  id: d._id,
  code: d.code,
  name: d.name ?? '',
  regStart: day(d.regStart),
  regEnd: day(d.regEnd),
  status: d.status,
  effectiveStatus: d.effectiveStatus ?? d.status,
  isOpen: d.isOpen ?? d.status === 'open',
});

export interface SpecialtyPayload {
  code: string;
  name?: string;
  regStart?: string;
  regEnd?: string;
  status?: ExamSpecialtyStatus;
}

export function useSpecialtiesPaginate(
  page: number,
  limit: number,
  filters: ExamSpecialtyFilters,
) {
  return useQuery({
    queryKey: [KEY, { page, limit, ...filters }],
    queryFn: async () => {
      const res = await fetchPaginated<BackendSpecialty>(`${ROOT}/paginate`, {
        page,
        limit,
        status: filters.status || undefined,
        search: filters.search || undefined,
      });
      return { ...res, docs: res.docs.map(mapSpecialty) };
    },
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useOpenSpecialties() {
  return useQuery({
    queryKey: [KEY, 'open'],
    queryFn: async () => {
      const docs = await fetchList<BackendSpecialty>(ROOT, { openNow: true });
      return docs.map(mapSpecialty);
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useAllSpecialties() {
  return useQuery({
    queryKey: [KEY, 'all'],
    queryFn: async () => {
      const docs = await fetchList<BackendSpecialty>(ROOT);
      return docs.map(mapSpecialty);
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateSpecialty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: SpecialtyPayload) => postJson(ROOT, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateSpecialty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string } & Partial<SpecialtyPayload>) => {
      const { id, ...body } = v;
      return putJson(`${ROOT}/${id}`, body);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteSpecialty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
