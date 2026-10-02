import { useQuery } from '@tanstack/react-query';
import { fetchList } from '@/shared/api';
import {
  toAcademicYearOptions,
  toCourseOptions,
  toEducationFormOptions,
  toRoomOptions,
  type BackendRefRow,
  type BackendRoomRow,
} from './reference-options';

export type {
  AcademicYearOption,
  CourseOption,
  EducationFormOption,
  RoomOption,
} from './reference-options';
import type { AcademicYearOption } from './reference-options';

export function useAcademicYears() {
  return useQuery({
    queryKey: ['residency', 'reference', 'academic-years'],
    queryFn: async (): Promise<AcademicYearOption[]> =>
      toAcademicYearOptions(await fetchList<BackendRefRow>('/academic-years')),
    staleTime: 5 * 60 * 1000,
  });
}

export function withCurrent(
  options: AcademicYearOption[],
  current?: string | null,
): AcademicYearOption[] {
  if (!current) return options;
  if (options.some((o) => o.id === current || o.title === current)) return options;
  return [{ id: current, title: current }, ...options];
}

export function academicYearValue(record?: {
  academicYearRef?: string | null;
  academicYear?: string | null;
} | null): string {
  return record?.academicYearRef || record?.academicYear || '';
}

export function useCourses() {
  return useQuery({
    queryKey: ['residency', 'reference', 'courses'],
    queryFn: async () => toCourseOptions(await fetchList<BackendRefRow>('/courses')),
    staleTime: 5 * 60 * 1000,
  });
}

export function useEducationForms() {
  return useQuery({
    queryKey: ['residency', 'reference', 'education-forms'],
    queryFn: async () => toEducationFormOptions(await fetchList<BackendRefRow>('/education-forms')),
    staleTime: 5 * 60 * 1000,
  });
}

export function academicYearWindow(title?: string | null): { from: string; to: string } | null {
  const m = /^(\d{4})\s*[-/]\s*(\d{4})$/.exec(String(title ?? '').trim());
  if (!m) return null;
  return { from: `${m[1]}-09-01`, to: `${m[2]}-08-31` };
}

export function useRooms(enabled = true) {
  return useQuery({
    queryKey: ['residency', 'reference', 'rooms'],
    enabled,
    queryFn: async () => toRoomOptions(await fetchList<BackendRoomRow>('/rooms')),
    staleTime: 5 * 60 * 1000,
  });
}
