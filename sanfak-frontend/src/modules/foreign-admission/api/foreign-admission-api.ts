import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteData,
  fetchList,
  fetchOne,
  fetchPaginated,
  putJson,
  type Paginated,
} from '@/shared/api';
import { mapApplicant, type BackendApplicant } from './mapper';

const KEY = 'foreign-admission';
const ROOT = '/international-admission';

export interface ApplicantsFilter {
  page: number;
  limit: number;
  search?: string;
  country?: string;
  status?: string;
  academicYear?: string;
  direction?: string;
  dateFrom?: string;
  dateTo?: string;
  [key: string]: unknown;
}

export function useApplicantsPaginated(filter: ApplicantsFilter) {
  return useQuery({
    queryKey: [KEY, 'paginate', filter],
    queryFn: async () => {
      const res: Paginated<BackendApplicant> = await fetchPaginated(`${ROOT}/paginate`, filter);
      return {
        items: res.docs.map(mapApplicant),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs, totalPages: res.totalPages },
      };
    },
  });
}

export function useAllApplicants(search?: string) {
  return useQuery({
    queryKey: [KEY, 'all', search ?? null],
    queryFn: async () => {
      const docs = await fetchList<BackendApplicant>(ROOT, search ? { search } : undefined);
      return docs.map(mapApplicant);
    },
  });
}

export function useApplicant(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'detail', id],
    queryFn: async () => mapApplicant(await fetchOne<BackendApplicant>(`${ROOT}/${id}`)),
    enabled: !!id,
  });
}

export interface DirectionStat {
  id: string;
  titleUz: string;
  titleRu?: string;
  titleEn?: string;
  count: number;
}

export interface ApplicantStats {
  total: number;
  byStatus: { new: number; approved: number; rejected: number };
  byCountry: { country: string; count: number }[];
  byDirection: DirectionStat[];
  byMonth: { month: string; count: number }[];
}

export function useApplicantStats(filter?: {
  from?: string;
  to?: string;
  academicYear?: string;
}) {
  const params = {
    ...(filter?.from ? { from: filter.from } : {}),
    ...(filter?.to ? { to: filter.to } : {}),
    ...(filter?.academicYear ? { academicYear: filter.academicYear } : {}),
  };
  return useQuery({
    queryKey: [KEY, 'stats', params],
    queryFn: () => fetchOne<ApplicantStats>(`${ROOT}/stats`, params),
  });
}

export function useApplicantCountries() {
  return useQuery({
    queryKey: [KEY, 'countries'],
    queryFn: () => fetchList<string>(`${ROOT}/countries`),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return (id: string) => {
    qc.invalidateQueries({ queryKey: [KEY] });
    qc.invalidateQueries({ queryKey: [KEY, 'detail', id] });
  };
}

export function useApproveApplicant() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => putJson<{ message: string }>(`${ROOT}/${id}/approve`, {}),
    onSuccess: (_d, id) => invalidate(id),
  });
}

export function useRejectApplicant() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { id: string; reason: string }) =>
      putJson<{ message: string }>(`${ROOT}/${input.id}/reject`, { reason: input.reason }),
    onSuccess: (_d, { id }) => invalidate(id),
  });
}

export function useDeleteApplicant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
