import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteData,
  fetchList,
  fetchPaginated,
  postJson,
  putJson,
  type Paginated,
} from '@/shared/api';
import type {
  AdmissionSeason,
  NamedRef,
  SeasonItem,
  SeasonName,
  SeasonStatus,
} from '../model/admission-types';

const ROOT = '/admission-seasons';
const KEY = ['foreign-admission', 'seasons'];

interface BackendRef {
  _id: string;
  titleUz?: string;
  titleRu?: string;
  titleEn?: string;
}

interface BackendSeasonItem {
  _id?: string;
  direction?: BackendRef | null;
  educationForms?: BackendRef[];
  educationLanguages?: BackendRef[];
}

interface BackendSeason {
  _id: string;
  titleUz: string;
  titleRu: string;
  titleEn: string;
  descriptionUz?: string;
  descriptionRu?: string;
  descriptionEn?: string;
  academicYear: string;
  season: SeasonName;
  items?: BackendSeasonItem[];
  openDate: string;
  closeDate: string;
  status: SeasonStatus;
  closedBy?: { firstName?: string; lastName?: string } | null;
  closedAt?: string;
  createdAt?: string;
}

const mapRef = (r: BackendRef | null | undefined): NamedRef | null =>
  r ? { id: r._id, titleUz: r.titleUz ?? '', titleRu: r.titleRu, titleEn: r.titleEn } : null;

const mapRefs = (list: BackendRef[] | undefined): NamedRef[] =>
  (list ?? []).map((r) => mapRef(r)).filter((r): r is NamedRef => r !== null);

const mapItem = (i: BackendSeasonItem): SeasonItem => ({
  id: i._id,
  direction: mapRef(i.direction),
  educationForms: mapRefs(i.educationForms),
  educationLanguages: mapRefs(i.educationLanguages),
});

export function mapSeason(b: BackendSeason): AdmissionSeason {
  const closer = b.closedBy;
  return {
    id: b._id,
    titleUz: b.titleUz,
    titleRu: b.titleRu,
    titleEn: b.titleEn,
    descriptionUz: b.descriptionUz,
    descriptionRu: b.descriptionRu,
    descriptionEn: b.descriptionEn,
    academicYear: b.academicYear,
    season: b.season,
    items: (b.items ?? []).map(mapItem),
    openDate: b.openDate,
    closeDate: b.closeDate,
    status: b.status,
    closedByName: closer
      ? [closer.lastName, closer.firstName].filter(Boolean).join(' ') || undefined
      : undefined,
    closedAt: b.closedAt,
    createdAt: b.createdAt,
  };
}

export interface SeasonListParams {
  page: number;
  limit: number;
  search?: string;
  academicYear?: string;
  season?: SeasonName;
  status?: SeasonStatus;
  [key: string]: unknown;
}

export function useSeasonsPaginated(params: SeasonListParams) {
  return useQuery({
    queryKey: [...KEY, 'paginate', params],
    queryFn: async () => {
      const res: Paginated<BackendSeason> = await fetchPaginated(`${ROOT}/paginate`, params);
      return {
        items: res.docs.map(mapSeason),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs, totalPages: res.totalPages },
      };
    },
  });
}

export function useAllSeasons() {
  return useQuery({
    queryKey: [...KEY, 'all'],
    queryFn: async () => (await fetchList<BackendSeason>(ROOT)).map(mapSeason),
  });
}

interface BackendAcademicYear {
  title: string;
  active?: boolean;
}

export function useAcademicYears() {
  return useQuery({
    queryKey: ['foreign-admission', 'academic-years'],
    queryFn: async () => {
      const rows = await fetchList<BackendAcademicYear>('/academic-years');
      return rows
        .filter((r) => r.active !== false)
        .map((r) => r.title)
        .sort((a, b) => b.localeCompare(a));
    },
  });
}

export interface SeasonInput {
  titleUz: string;
  titleRu: string;
  titleEn: string;
  descriptionUz?: string;
  descriptionRu?: string;
  descriptionEn?: string;
  academicYear: string;
  season: SeasonName;
  items: { direction: string; educationForms: string[]; educationLanguages: string[] }[];
  openDate: string;
  closeDate: string;
}

function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
}

export function useSaveSeason() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: SeasonInput }) =>
      id
        ? putJson<{ message: string }>(`${ROOT}/${id}`, input)
        : postJson<{ message: string }>(ROOT, input),
    onSuccess: () => void refresh(),
  });
}

export function useCloseSeason() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (id: string) => putJson<{ message: string }>(`${ROOT}/${id}/close`, {}),
    onSuccess: () => void refresh(),
  });
}

export function useDeleteSeason() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => void refresh(),
  });
}
