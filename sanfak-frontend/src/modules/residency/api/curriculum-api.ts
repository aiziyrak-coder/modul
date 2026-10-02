import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchList, fetchOne, deleteData, uploadMultipart } from '@/shared/api';
import type {
  Curriculum,
  CurriculumFile,
  CurriculumProgram,
  EducationForm,
} from './curriculum-types';
import { codeOrSnapshot, titleOrSnapshot } from './ref-title';

type Q = Record<string, string | number | boolean | undefined | null>;
function qs(params: Q): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

interface RawFile {
  url?: string;
  name?: string | null;
  size?: number | null;
  uploadedAt?: string | null;
}
interface BackendCurriculum {
  _id: string;
  title: string;
  specialty?: string | { _id: string; title?: string; code?: string } | null;
  specialtyTitle?: string | null;
  specialtyCode?: string | null;
  program?: string | null;
  educationForm?: string | null;
  studyPeriod?: number | null;
  approvedYear?: number | null;
  academicYear?: string | null;
  academicYearRef?: string | null;
  processFile?: RawFile | null;
  planFile?: RawFile | null;
  note?: string | null;
  createdAt?: string | null;
  active?: boolean;
}

const mapFile = (f: RawFile | null | undefined): CurriculumFile | null =>
  f && f.url
    ? {
        url: f.url,
        name: f.name ?? null,
        size: f.size ?? null,
        uploadedAt: f.uploadedAt ?? null,
      }
    : null;

const mapCurriculum = (b: BackendCurriculum): Curriculum => {
  const processFile = mapFile(b.processFile);
  const planFile = mapFile(b.planFile);
  const stamps = [processFile?.uploadedAt, planFile?.uploadedAt].filter(
    (s): s is string => !!s,
  );
  const latest = stamps.sort().at(-1) ?? b.createdAt ?? null;

  return {
    id: b._id,
    title: b.title,
    specialtyId:
      b.specialty && typeof b.specialty === 'object' ? b.specialty._id : (b.specialty ?? null),
    specialtyTitle: titleOrSnapshot(b.specialty, b.specialtyTitle),
    specialtyCode: codeOrSnapshot(b.specialty, b.specialtyCode),
    program: b.program === 'ordinatura' ? 'ordinatura' : 'magistratura',
    educationForm: b.educationForm ?? '',
    studyPeriod: b.studyPeriod ?? null,
    approvedYear: b.approvedYear ?? null,
    academicYear: b.academicYear ?? null,
    academicYearRef: b.academicYearRef ?? null,
    processFile,
    planFile,
    note: b.note ?? null,
    createdAt: b.createdAt ?? null,
    uploadedAt: latest,
    active: b.active !== false,
  };
};

const ROOT = '/curriculums';
const KEY = 'residency-curriculums';

export interface CurriculumInput {
  title: string;
  specialty?: string | null;
  specialtyTitle?: string | null;
  specialtyCode?: string | null;
  program: CurriculumProgram;
  educationForm?: EducationForm;
  studyPeriod?: number;
  approvedYear?: number | null;
  academicYear?: string | null;
  academicYearRef?: string | null;
  note?: string | null;
  processFile?: File | null;
  planFile?: File | null;
}

function toFields(
  input: Partial<CurriculumInput>,
): Record<string, string | number | boolean | File | null | undefined> {
  const { processFile, planFile, specialty, ...rest } = input;
  return {
    ...rest,
    specialty: specialty ? specialty : undefined,
    file: processFile ?? undefined,
    planFile: planFile ?? undefined,
  };
}

export function useCurriculums(params: Q = {}) {
  return useQuery({
    queryKey: [KEY, 'list', params],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<Curriculum[]> =>
      (await fetchList<BackendCurriculum>(`${ROOT}${qs(params)}`)).map(mapCurriculum),
  });
}

export function useCurriculum(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, id],
    enabled: !!id,
    queryFn: async (): Promise<Curriculum> =>
      mapCurriculum(await fetchOne<BackendCurriculum>(`${ROOT}/${id}`)),
  });
}

export function useCreateCurriculum() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (input: CurriculumInput) => uploadMultipart(ROOT, 'POST', toFields(input)),
    onSuccess: () => q.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateCurriculum() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CurriculumInput> }) =>
      uploadMultipart(`${ROOT}/${id}`, 'PUT', toFields(data)),
    onSuccess: () => q.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteCurriculum() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => q.invalidateQueries({ queryKey: [KEY] }),
  });
}
