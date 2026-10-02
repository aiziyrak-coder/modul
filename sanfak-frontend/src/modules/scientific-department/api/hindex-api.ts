import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { apiClient, fetchOne, fetchPaginated, putJson } from '@/shared/api';
import type { HIndexFilters, HIndexProfile } from '../model/types';

const ROOT = '/h-index-profiles';
const KEY = 'sci-hindex';

interface BackendRef {
  _id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  title?: string;
}

interface BackendProfile {
  _id: string;
  teacher?: BackendRef | null;
  department?: BackendRef | null;
  faculty?: BackendRef | null;
  scopusUrl?: string;
  scopusHIndex?: number;
  scopusCitations?: number;
  scopusDocuments?: number;
  scopusSyncedAt?: string | null;
  scopusSyncError?: string;
  scholarUrl?: string;
  scholarHIndex?: number;
  scholarCitations?: number;
  scholarI10Index?: number;
  scholarSyncedAt?: string | null;
  scholarSyncError?: string;
  updatedAt?: string;
}

const personName = (p?: BackendRef | null): string =>
  p ? [p.lastName, p.firstName].filter(Boolean).join(' ') : '';

function mapProfile(doc: BackendProfile): HIndexProfile {
  return {
    id: doc._id,
    teacherName: personName(doc.teacher) || null,
    departmentName: doc.department?.title ?? null,
    facultyName: doc.faculty?.title ?? null,
    scopusUrl: doc.scopusUrl ?? '',
    scopusHIndex: doc.scopusHIndex ?? 0,
    scopusCitations: doc.scopusCitations ?? 0,
    scopusDocuments: doc.scopusDocuments ?? 0,
    scopusSyncedDate: doc.scopusSyncedAt ? doc.scopusSyncedAt.slice(0, 10) : '',
    scopusSyncError: doc.scopusSyncError ?? '',
    scholarUrl: doc.scholarUrl ?? '',
    scholarHIndex: doc.scholarHIndex ?? 0,
    scholarCitations: doc.scholarCitations ?? 0,
    scholarI10Index: doc.scholarI10Index ?? 0,
    scholarSyncedDate: doc.scholarSyncedAt ? doc.scholarSyncedAt.slice(0, 10) : '',
    scholarSyncError: doc.scholarSyncError ?? '',
    updatedDate: doc.updatedAt ? doc.updatedAt.slice(0, 10) : '',
  };
}

export function useHIndexProfilesPaginate(
  page: number,
  limit: number,
  filters: HIndexFilters,
) {
  return useQuery({
    queryKey: [KEY, { page, limit, ...filters }],
    queryFn: async () => {
      const res = await fetchPaginated<BackendProfile>(`${ROOT}/paginate`, {
        page,
        limit,
        faculty: filters.faculty || undefined,
        search: filters.search || undefined,
      });
      return { ...res, docs: res.docs.map(mapProfile) };
    },
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useHIndexProfile(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'one', id],
    enabled: !!id,
    queryFn: async (): Promise<HIndexProfile> => {
      const doc = await fetchOne<BackendProfile>(`${ROOT}/${id}`);
      return mapProfile(doc);
    },
    refetchOnWindowFocus: false,
  });
}

export function useMyHIndex() {
  return useQuery({
    queryKey: [KEY, 'mine'],
    queryFn: async (): Promise<HIndexProfile | null> => {
      const doc = await fetchOne<BackendProfile | null>(`${ROOT}/mine`);
      return doc ? mapProfile(doc) : null;
    },
    refetchOnWindowFocus: false,
  });
}

export interface HIndexUpsertPayload {
  scopusUrl?: string;
  scholarUrl?: string;
  scholarHIndex?: number;
  scholarCitations?: number;
}

export function useUpsertMyHIndex() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: HIndexUpsertPayload) => putJson(`${ROOT}/mine`, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useRefreshMyScopus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => putJson(`${ROOT}/mine/refresh`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useRefreshScopus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => putJson(`${ROOT}/${id}/refresh`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export async function downloadHIndexExcel(filters: HIndexFilters): Promise<void> {
  const params: Record<string, unknown> = {};
  if (filters.search) params.search = filters.search;
  if (filters.faculty) params.faculty = filters.faculty;

  const res = await apiClient.get(`${ROOT}/export`, { params, responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'h-indeks.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
