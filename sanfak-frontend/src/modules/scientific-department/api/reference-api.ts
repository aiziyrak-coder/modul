import { useQuery } from '@tanstack/react-query';
import { fetchList, fetchOne } from '@/shared/api';
import type { RefOption } from '../model/types';

interface BackendRef {
  _id: string;
  name: string;
  faculty?: string | null;
}

const mapRef = (d: BackendRef): RefOption => ({ id: d._id, name: d.name });

export function useDepartments() {
  return useQuery({
    queryKey: ['sci-departments'],
    queryFn: async (): Promise<RefOption[]> => {
      const docs = await fetchList<BackendRef>('/scientific-references/departments');
      return docs.map((d) => ({ ...mapRef(d), facultyId: d.faculty ?? null }));
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export const departmentsOfFaculty = (
  departments: RefOption[],
  facultyId?: string,
): RefOption[] =>
  facultyId ? departments.filter((d) => d.facultyId === facultyId) : departments;

export function useFaculties() {
  return useQuery({
    queryKey: ['sci-faculties'],
    queryFn: async (): Promise<RefOption[]> => {
      const docs = await fetchList<BackendRef>('/scientific-references/faculties');
      return docs.map(mapRef);
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useTeachers() {
  return useQuery({
    queryKey: ['sci-teachers-lookup'],
    queryFn: async (): Promise<RefOption[]> => {
      const docs = await fetchList<BackendRef>('/scientific-references/teachers');
      return docs.map(mapRef);
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export interface Signers {
  kotib: string | null;
  rektor: string | null;
  prorektor: string | null;
}

export function useSigners() {
  return useQuery({
    queryKey: ['sci-signers'],
    queryFn: async (): Promise<Signers> => {
      const d = await fetchOne<Record<keyof Signers, BackendRef[] | undefined>>(
        '/scientific-references/signers',
      );
      const join = (list: BackendRef[] | undefined): string | null =>
        list && list.length ? list.map((x) => x.name).filter(Boolean).join(', ') : null;
      return { kotib: join(d.kotib), rektor: join(d.rektor), prorektor: join(d.prorektor) };
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export interface AcademicYearOption {
  value: string;
  label: string;
  active: boolean;
}

interface BackendAcademicYear {
  _id: string;
  title: string;
  active?: boolean;
}

export function useAcademicYears() {
  return useQuery({
    queryKey: ['sci-academic-years-lookup'],
    queryFn: async (): Promise<AcademicYearOption[]> => {
      const docs = await fetchList<BackendAcademicYear>('/academic-years');
      return docs
        .map((d) => ({ value: d.title, label: d.title, active: !!d.active }))
        .sort((a, b) => b.value.localeCompare(a.value));
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export interface CourseOption {
  value: number;
  label: string;
}

interface BackendCourse {
  _id: string;
  title: string;
  active?: boolean;
}

export function useCourses() {
  return useQuery({
    queryKey: ['sci-courses-lookup'],
    queryFn: async (): Promise<CourseOption[]> => {
      const docs = await fetchList<BackendCourse>('/courses?active=true');
      return docs
        .map((d) => ({ value: parseInt(d.title, 10), label: d.title }))
        .filter((o) => Number.isFinite(o.value))
        .sort((a, b) => a.value - b.value);
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

interface BackendTitleRef {
  _id: string;
  title: string;
  code?: string;
}

export interface RefChoice {
  value: string;
  label: string;
}

const asChoices = (docs: BackendTitleRef[]): RefChoice[] =>
  docs.filter((d) => d.title).map((d) => ({ value: d.title, label: d.title }));

export function useAcademicLevels() {
  return useQuery({
    queryKey: ['sci-academic-levels-lookup'],
    queryFn: async (): Promise<RefChoice[]> => asChoices(await fetchList<BackendTitleRef>('/academic-levels')),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useScienceBranches() {
  return useQuery({
    queryKey: ['sci-science-branches-lookup'],
    queryFn: async (): Promise<RefChoice[]> => asChoices(await fetchList<BackendTitleRef>('/science-branches')),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

interface BackendSpecialtyChoice {
  _id: string;
  code?: string;
  name?: string;
}

export function useSpecialties() {
  return useQuery({
    queryKey: ['sci-specialties-lookup'],
    queryFn: async (): Promise<RefChoice[]> => {
      const docs = await fetchList<BackendSpecialtyChoice>('/methodical-specialties', {
        active: true,
      });
      return docs
        .filter((d) => d.name)
        .map((d) => ({
          value: String(d.name),
          label: d.code ? `${d.code} — ${d.name}` : String(d.name),
        }));
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useAcademicTitles() {
  return useQuery({
    queryKey: ['sci-academic-titles-lookup'],
    queryFn: async (): Promise<RefChoice[]> => asChoices(await fetchList<BackendTitleRef>('/academic-titles')),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
