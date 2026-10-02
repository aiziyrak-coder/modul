import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchList, postJson, putJson, deleteData } from '@/shared/api';
import type { Lesson, LessonGroup } from './lesson-types';
import { nameOrSnapshot, titleOrSnapshot } from './ref-title';

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
interface RawUser {
  _id: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
}
interface RawGroup {
  group?: string | RawRef | null;
  title?: string | null;
}
interface BackendLesson {
  _id: string;
  academicYear?: string | null;
  academicYearRef?: string | null;
  courseNumber?: number | null;
  science?: string | RawRef | null;
  scienceTitle?: string | null;
  department?: string | RawRef | null;
  departmentTitle?: string | null;
  teacher?: string | RawUser | null;
  teacherName?: string | null;
  groups?: RawGroup[];
  startDate?: string | null;
  endDate?: string | null;
  active?: boolean;
}

const refId = (v: string | { _id: string } | null | undefined): string | null =>
  v && typeof v === 'object' ? v._id : (v ?? null);

const userName = (u: string | RawUser | null | undefined): string | null => {
  if (!u || typeof u !== 'object') return null;
  const parts = [u.lastName, u.firstName, u.middleName].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
};

export const mapGroup = (g: RawGroup): LessonGroup => ({
  id: refId(g.group) ?? '',
  title: titleOrSnapshot(g.group, g.title) ?? '',
});

const mapLesson = (b: BackendLesson): Lesson => ({
  id: b._id,
  academicYear: b.academicYear ?? null,
  academicYearRef: b.academicYearRef ?? null,
  courseNumber: b.courseNumber ?? null,
  scienceId: refId(b.science),
  scienceTitle: titleOrSnapshot(b.science, b.scienceTitle),
  departmentId: refId(b.department),
  departmentTitle: titleOrSnapshot(b.department, b.departmentTitle),
  teacherId: refId(b.teacher),
  teacherName: nameOrSnapshot(userName(b.teacher), b.teacherName),
  groups: (b.groups ?? []).map(mapGroup).filter((g) => !!g.id),
  startDate: b.startDate ?? null,
  endDate: b.endDate ?? null,
  active: b.active !== false,
});

const ROOT = '/lessons';
const KEY = 'residency-lessons';

export interface LessonInput {
  academicYear?: string | null;
  academicYearRef?: string | null;
  courseNumber?: number | null;
  science: string;
  scienceTitle?: string | null;
  department?: string | null;
  departmentTitle?: string | null;
  teacher?: string | null;
  teacherName?: string | null;
  groups?: Array<{ group: string; title?: string | null }>;
  startDate: string;
  endDate: string;
}

export function useLessons(params: Q = {}) {
  return useQuery({
    queryKey: [KEY, 'list', params],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<Lesson[]> =>
      (await fetchList<BackendLesson>(`${ROOT}${qs(params)}`)).map(mapLesson),
  });
}

export function useCreateLesson() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (input: LessonInput) => postJson(ROOT, input),
    onSuccess: () => q.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateLesson() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<LessonInput> }) =>
      putJson(`${ROOT}/${id}`, data),
    onSuccess: () => q.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteLesson() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => q.invalidateQueries({ queryKey: [KEY] }),
  });
}
