import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchList,
  fetchOne,
  fetchPaginated,
  putJson,
  uploadMultipart,
  type Paginated,
} from '@/shared/api';
import {
  mapPetition,
  mapPetitionDetail,
  type BackendPetition,
  type BackendPetitionDetail,
} from './petition-mapper';

const KEY = 'qual-petition';
const ROOT = '/qualification-petitions';

export interface PetitionFilter {
  page: number;
  limit: number;
  search?: string;
  status?: number;
  course?: string;
  [key: string]: unknown;
}

export function usePetitionsPaginated(filter: PetitionFilter) {
  return useQuery({
    staleTime: 0,
    queryKey: [KEY, 'paginate', filter],
    queryFn: async () => {
      const res: Paginated<BackendPetition> = await fetchPaginated(`${ROOT}/paginate`, filter);
      return {
        items: res.docs.map(mapPetition),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs, totalPages: res.totalPages },
      };
    },
  });
}

export async function fetchPetitionsExport(filter: {
  search?: string;
  status?: number;
  course?: string;
}) {
  const docs = await fetchList<BackendPetition>(ROOT, filter);
  return docs.map(mapPetition);
}

export function usePetition(id: string | undefined) {
  return useQuery({
    staleTime: 0,
    queryKey: [KEY, 'detail', id],
    queryFn: async () => mapPetitionDetail(await fetchOne<BackendPetitionDetail>(`${ROOT}/${id}`)),
    enabled: !!id,
  });
}

export interface PetitionInput {
  fullName?: string;
  passport?: string;
  course: string;
  province: string;
  region: string;
  institution?: string;
  phone?: string;
  bachelorDiploma: File;
  mastersDiploma?: File;
  moCertificate?: File;
}

export function useCreatePetition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PetitionInput) => {
      const payload: Record<string, string | File> = {
        course: input.course,
        province: input.province,
        region: input.region,
        bachelorDiploma: input.bachelorDiploma,
      };
      if (input.fullName) payload.fullName = input.fullName;
      if (input.passport) payload.passport = input.passport;
      if (input.institution) payload.institution = input.institution;
      if (input.phone) payload.phone = input.phone;
      if (input.mastersDiploma) payload.mastersDiploma = input.mastersDiploma;
      if (input.moCertificate) payload.moCertificate = input.moCertificate;
      return uploadMultipart(ROOT, 'POST', payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useMyPetitions() {
  return useQuery({
    staleTime: 0,
    queryKey: [KEY, 'my'],
    queryFn: async (): Promise<Map<string, number>> => {
      const docs = await fetchList<{ course: string; status: number }>(`${ROOT}/my`);
      const map = new Map<string, number>();
      docs
        .filter((d) => d.status === 1 || d.status === 2)
        .forEach((d) => map.set(d.course, d.status));
      return map;
    },
  });
}

export interface MyOneIdProfile {
  fullName: string;
  passport: string;
}

export function useMyOneIdProfile() {
  return useQuery({
    staleTime: 0,
    queryKey: [KEY, 'my-profile'],
    queryFn: async (): Promise<MyOneIdProfile> => {
      const d = await fetchOne<Partial<MyOneIdProfile>>(`${ROOT}/my/profile`);
      return { fullName: d.fullName ?? '', passport: d.passport ?? '' };
    },
  });
}

export function useAcceptPetition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => putJson(`${ROOT}/accept/${id}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useRejectPetition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => putJson(`${ROOT}/reject/${id}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
