import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchList, fetchOne, deleteData, putJson, uploadMultipart } from '@/shared/api';
import type {
  TrialTest,
  TrialTestDetail,
  TrialTestResult,
  TrialTestResultsPage,
  TrialTestSummary,
} from './trial-test-types';

type Q = Record<string, string | number | boolean | undefined | null>;
function qs(params: Q): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

interface RawRef {
  _id: string;
  title?: string;
}
interface BackendTest {
  _id: string;
  title: string;
  science?: string | RawRef | null;
  scienceTitle?: string | null;
  specialty?: string | RawRef | null;
  specialtyTitle?: string | null;
  program?: string | null;
  courseNumber?: number | null;
  group?: string | RawRef | null;
  groupTitle?: string | null;
  academicYear?: string | null;
  academicYearRef?: string | null;
  date: string;
  maxScore?: number | null;
  questionCount?: number | null;
  desc?: string | null;
  fileUrl: string;
  fileName?: string | null;
  fileSize?: number | null;
  format?: string | null;
  createdAt?: string | null;
}
interface BackendResultRow {
  resident: {
    _id: string;
    fullName?: string | null;
    program?: string | null;
    specialtyTitle?: string | null;
    courseNumber?: number | null;
    groupTitle?: string | null;
  };
  assessmentId?: string | null;
  score?: number | null;
  maxScore?: number | null;
  gradedAt?: string | null;
}

const refId = (v: string | RawRef | null | undefined): string | null =>
  v && typeof v === 'object' ? v._id : (v ?? null);

const asProgram = (p: string | null | undefined): 'magistratura' | 'ordinatura' | null =>
  p === 'magistratura' || p === 'ordinatura' ? p : null;

const mapTest = (b: BackendTest): TrialTest => ({
  id: b._id,
  title: b.title,
  scienceId: refId(b.science),
  scienceTitle: b.scienceTitle ?? null,
  specialtyId: refId(b.specialty),
  specialtyTitle: b.specialtyTitle ?? null,
  program: asProgram(b.program),
  courseNumber: b.courseNumber ?? null,
  groupId: refId(b.group),
  groupTitle: b.groupTitle ?? null,
  academicYear: b.academicYear ?? null,
  academicYearRef: b.academicYearRef ?? null,
  date: b.date,
  maxScore: typeof b.maxScore === 'number' ? b.maxScore : 100,
  questionCount: b.questionCount ?? null,
  desc: b.desc ?? null,
  fileUrl: b.fileUrl,
  fileName: b.fileName ?? null,
  fileSize: b.fileSize ?? null,
  format: b.format ?? null,
  createdAt: b.createdAt ?? null,
});

const mapResult = (b: BackendResultRow): TrialTestResult => ({
  residentId: b.resident._id,
  fullName: b.resident.fullName ?? '',
  program: asProgram(b.resident.program),
  specialtyTitle: b.resident.specialtyTitle ?? null,
  courseNumber: b.resident.courseNumber ?? null,
  groupTitle: b.resident.groupTitle ?? null,
  assessmentId: b.assessmentId ?? null,
  score: typeof b.score === 'number' ? b.score : null,
  maxScore: typeof b.maxScore === 'number' ? b.maxScore : null,
  gradedAt: b.gradedAt ?? null,
});

const ROOT = '/residency-tests';
const KEY = 'residency-trial-tests';

export interface TrialTestInput {
  title: string;
  science?: string | null;
  scienceTitle?: string | null;
  specialty?: string | null;
  specialtyTitle?: string | null;
  program?: 'magistratura' | 'ordinatura' | '';
  courseNumber?: number | '';
  group?: string | null;
  groupTitle?: string | null;
  academicYear?: string | null;
  date: string;
  maxScore?: number | '';
  questionCount?: number | '';
  desc?: string | null;
  file?: File | null;
}

function toFields(
  input: Partial<TrialTestInput>,
): Record<string, string | number | boolean | File | null | undefined> {
  const { file, science, specialty, group, ...rest } = input;
  const clear = (v: string | null | undefined) => (v === undefined ? undefined : (v ?? ''));
  return {
    ...rest,
    science: clear(science),
    specialty: clear(specialty),
    group: clear(group),
    file: file ?? undefined,
  };
}

export function useTrialTests(params: Q = {}) {
  return useQuery({
    queryKey: [KEY, 'list', params],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<TrialTest[]> =>
      (await fetchList<BackendTest>(`${ROOT}${qs(params)}`)).map(mapTest),
  });
}

export function useTrialTest(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, id],
    enabled: !!id,
    queryFn: async (): Promise<TrialTestDetail> => {
      const res = await fetchOne<{ test: BackendTest; summary: TrialTestSummary }>(
        `${ROOT}/${id}`,
      );
      return { test: mapTest(res.test), summary: res.summary };
    },
  });
}

export function useTrialTestPreview(params: Q, enabled = true) {
  return useQuery({
    queryKey: [KEY, 'preview', params],
    enabled,
    queryFn: (): Promise<{ count: number }> =>
      fetchOne<{ count: number }>(`${ROOT}/preview${qs(params)}`),
  });
}

export function useCreateTrialTest() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (input: TrialTestInput) => uploadMultipart(ROOT, 'POST', toFields(input)),
    onSuccess: () => q.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateTrialTest() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TrialTestInput> }) =>
      uploadMultipart(`${ROOT}/${id}`, 'PUT', toFields(data)),
    onSuccess: () => q.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteTrialTest() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => q.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useTrialTestResults(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, id, 'results'],
    enabled: !!id,
    queryFn: async (): Promise<TrialTestResultsPage> => {
      const res = await fetchOne<{
        maxScore: number;
        results: BackendResultRow[];
        summary: TrialTestSummary;
      }>(`${ROOT}/${id}/results`);
      return {
        maxScore: res.maxScore,
        results: res.results.map(mapResult),
        summary: res.summary,
      };
    },
  });
}

export function useSaveTrialTestResults() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      results,
    }: {
      id: string;
      results: { resident: string; score: number | null }[];
    }) => putJson<{ updated: number }>(`${ROOT}/${id}/results`, { results }),
    onSuccess: () => q.invalidateQueries({ queryKey: [KEY] }),
  });
}
