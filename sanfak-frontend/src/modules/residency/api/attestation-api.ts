import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchList, fetchOne, postJson, putJson, deleteData } from '@/shared/api';
import type { ResidentBrief } from './types';
import type {
  Attestation,
  AttestationDetail,
  AttestationResult,
  AttestationSummary,
} from './attestation-types';

type Q = Record<string, string | number | boolean | undefined | null>;
function qs(params: Q): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

interface BackendAttestation {
  _id: string;
  scienceTitle: string;
  specialty?: string | { _id: string } | null;
  specialtyTitle?: string | null;
  program?: string | null;
  courseNumber?: number | null;
  groupTitle?: string | null;
  academicYear?: string | null;
  academicYearRef?: string | null;
  date: string;
}
interface RawResident {
  _id: string;
  fullName?: string;
  program?: string;
  specialtyTitle?: string | null;
  departmentTitle?: string | null;
  courseNumber?: number | null;
  group?: string | { _id: string } | null;
  groupTitle?: string | null;
}
interface BackendResult {
  _id: string;
  resident?: string | RawResident | null;
  residentName?: string | null;
  score?: number | null;
  included?: boolean;
  excludeReason?: string | null;
}

const mapAttestation = (b: BackendAttestation): Attestation => ({
  id: b._id,
  scienceTitle: b.scienceTitle,
  specialtyId: b.specialty && typeof b.specialty === 'object' ? b.specialty._id : (b.specialty ?? null),
  specialtyTitle: b.specialtyTitle ?? null,
  program: b.program === 'magistratura' || b.program === 'ordinatura' ? b.program : null,
  courseNumber: b.courseNumber ?? null,
  groupTitle: b.groupTitle ?? null,
  academicYear: b.academicYear ?? null,
  academicYearRef: b.academicYearRef ?? null,
  date: b.date,
});

const mapBrief = (r: string | RawResident | null | undefined): ResidentBrief | null => {
  if (!r || typeof r !== 'object') return null;
  return {
    id: r._id,
    fullName: r.fullName ?? '',
    program: r.program === 'magistratura' ? 'magistratura' : 'ordinatura',
    specialtyTitle: r.specialtyTitle ?? null,
    departmentTitle: r.departmentTitle ?? null,
    courseNumber: r.courseNumber ?? null,
    groupId: typeof r.group === 'string' ? r.group : (r.group?._id ?? null),
    groupTitle: r.groupTitle ?? null,
  };
};

const mapResult = (b: BackendResult): AttestationResult => ({
  id: b._id,
  residentId: b.resident && typeof b.resident === 'object' ? b.resident._id : (typeof b.resident === 'string' ? b.resident : ''),
  residentName: b.residentName ?? null,
  resident: mapBrief(b.resident),
  score: b.score ?? null,
  included: b.included !== false,
  excludeReason: b.excludeReason ?? null,
});

const ROOT = '/attestations';
const KEY = 'residency-attestations';

export interface AttestationInput {
  science?: string;
  scienceTitle: string;
  specialty?: string;
  specialtyTitle?: string | null;
  program?: 'magistratura' | 'ordinatura';
  courseNumber?: number;
  group?: string;
  groupTitle?: string | null;
  academicYear?: string;
  academicYearRef?: string | null;
  date: string;
}

export function useAttestations(params: Q = {}) {
  return useQuery({
    queryKey: [KEY, 'list', params],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<Attestation[]> =>
      (await fetchList<BackendAttestation>(`${ROOT}${qs(params)}`)).map(mapAttestation),
  });
}

export function useAttestation(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, id],
    enabled: !!id,
    queryFn: async (): Promise<AttestationDetail> => {
      const res = await fetchOne<{ attestation: BackendAttestation; summary: AttestationSummary }>(
        `${ROOT}/${id}`,
      );
      return { attestation: mapAttestation(res.attestation), summary: res.summary };
    },
  });
}

export function useAttestationPreview(params: Q, enabled = true) {
  return useQuery({
    queryKey: [KEY, 'preview', params],
    enabled,
    queryFn: (): Promise<{ count: number }> => fetchOne<{ count: number }>(`${ROOT}/preview${qs(params)}`),
  });
}

export function useCreateAttestation() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (a: AttestationInput) => postJson(ROOT, a),
    onSuccess: () => q.invalidateQueries({ queryKey: [KEY] }),
  });
}
export function useUpdateAttestation() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AttestationInput> }) =>
      putJson(`${ROOT}/${id}`, data),
    onSuccess: () => q.invalidateQueries({ queryKey: [KEY] }),
  });
}
export function useDeleteAttestation() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => q.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useAttestationResults(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, id, 'results'],
    enabled: !!id,
    queryFn: async (): Promise<AttestationResult[]> =>
      (await fetchList<BackendResult>(`${ROOT}/${id}/results`)).map(mapResult),
  });
}
export function useUpdateAttestationResult() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      resultId,
      data,
    }: {
      id: string;
      resultId: string;
      data: { score?: number | null; included?: boolean; excludeReason?: string | null };
    }) => putJson(`${ROOT}/${id}/results/${resultId}`, data),
    onSuccess: () => q.invalidateQueries({ queryKey: [KEY] }),
  });
}
export function useDeleteAttestationResult() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resultId }: { id: string; resultId: string }) =>
      deleteData(`${ROOT}/${id}/results/${resultId}`),
    onSuccess: () => q.invalidateQueries({ queryKey: [KEY] }),
  });
}
