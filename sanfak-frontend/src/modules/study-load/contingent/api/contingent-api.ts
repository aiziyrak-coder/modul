import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteData,
  fetchList,
  fetchPaginated,
  getApiErrorMessage,
  postJson,
  putJson,
  type Paginated,
} from '@/shared/api';
import { mapGroup, type BackendGroup } from './mapper';
import { fetchAllPages } from '../../lib/fetch-all-pages';
import type { Contingent, ContingentFormValues, RefOption } from '../model/types';

export const CONTINGENT_KEY = 'contingent';
const ROOT = '/groups';

export interface ContingentsFilter {
  page: number;
  limit: number;
  search?: string;
  direction?: string;
  course?: string;
  academicYear?: string;
}

interface BackendRef {
  _id: string;
  title: string;
}

function mapRef(b: BackendRef): RefOption {
  return { id: b._id, title: b.title };
}

async function fetchRefList(url: string): Promise<RefOption[]> {
  try {
    const docs = await fetchList<BackendRef>(url, { active: true });
    return docs.map(mapRef);
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[perm] reference so'rovi muvaffaqiyatsiz:", e);
    return [];
  }
}

function contingentFilterParams(filter: Omit<ContingentsFilter, 'page' | 'limit'>) {
  const params: Record<string, unknown> = {};
  if (filter.search) params['search'] = filter.search;
  if (filter.direction) params['direction'] = filter.direction;
  if (filter.course) params['course'] = filter.course;
  if (filter.academicYear) params['academicYear'] = filter.academicYear;
  return params;
}

export function fetchAllContingents(filter: Omit<ContingentsFilter, 'page' | 'limit'>) {
  return fetchAllPages(`${ROOT}/paginate`, contingentFilterParams(filter), mapGroup);
}

export function useContingents(filter: ContingentsFilter) {
  return useQuery({
    queryKey: [CONTINGENT_KEY, 'paginate', filter],
    queryFn: async () => {
      const res: Paginated<BackendGroup> = await fetchPaginated(`${ROOT}/paginate`, {
        page: filter.page,
        limit: filter.limit,
        ...contingentFilterParams(filter),
      });
      return {
        items: res.docs.map(mapGroup),
        meta: {
          page: res.page,
          limit: res.limit,
          total: res.totalDocs,
          totalPages: res.totalPages,
        },
      };
    },
  });
}

export function useCreateContingent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: ContingentFormValues) =>
      postJson<unknown>(ROOT, {
        title: values.title,
        desc: values.desc || undefined,
        direction: values.direction || undefined,
        course: values.course || undefined,
        lang: values.lang || undefined,
        academicYear: values.academicYear || undefined,
        studentNumber: values.studentNumber,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [CONTINGENT_KEY] }),
  });
}

export function useUpdateContingent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: ContingentFormValues }) =>
      putJson<unknown>(`${ROOT}/${id}`, {
        title: values.title,
        desc: values.desc || undefined,
        direction: values.direction || undefined,
        course: values.course || undefined,
        lang: values.lang || undefined,
        academicYear: values.academicYear || undefined,
        studentNumber: values.studentNumber,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [CONTINGENT_KEY] }),
  });
}

export function useDeleteContingent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [CONTINGENT_KEY] }),
  });
}

export function useDirectionsRef() {
  return useQuery({
    queryKey: ['directions', 'list-for-select'],
    queryFn: () => fetchRefList('/directions'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCoursesRef() {
  return useQuery({
    queryKey: ['courses', 'list-for-select'],
    queryFn: () => fetchRefList('/courses'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useLanguagesRef() {
  return useQuery({
    queryKey: ['languages', 'list-for-select'],
    queryFn: () => fetchRefList('/language-of-instruction'),
    staleTime: 5 * 60 * 1000,
  });
}

interface BackendAcademicYear {
  _id: string;
  title?: string | null;
}

export function useAcademicYearsForSelect() {
  return useQuery<RefOption[]>({
    queryKey: ['academicYears', 'list-for-select'],
    queryFn: async () => {
      try {
        const { apiClient } = await import('@/shared/api');
        const res = await apiClient.get<BackendAcademicYear[]>('/academic-years');
        const docs = Array.isArray(res.data) ? res.data : [];
        return docs.map((d) => ({ id: d._id, title: d.title ?? d._id }));
      } catch (e) {
        if (import.meta.env.DEV) console.warn("[perm] reference so'rovi muvaffaqiyatsiz:", e);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

export { getApiErrorMessage };

export type { Contingent };
