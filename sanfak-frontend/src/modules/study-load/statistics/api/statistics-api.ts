import { useQuery } from '@tanstack/react-query';
import { fetchList, fetchOne } from '@/shared/api';
import type { OubFaculties, OubOverview, OubTeachers, RefOption, StatisticsFilters } from '../model/types';
import {
  mapFaculties,
  mapOverview,
  mapTeachers,
  type BackendOubFaculties,
  type BackendOubTeachers,
  type BackendOverview,
} from './mapper';
import { mockFaculties, mockOverview, mockTeachers } from './mock-store';

const ROOT = '/study-load-statistics';
export const STATISTICS_KEY = 'studyLoadOubStatistics';

export const USE_MOCK = false;

function toParams(f: StatisticsFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (f.academicYear) params.academicYear = f.academicYear;
  if (f.faculty) params.faculty = f.faculty;
  return params;
}

async function backendOverview(f: StatisticsFilters): Promise<OubOverview> {
  return mapOverview(await fetchOne<BackendOverview>(`${ROOT}/oub-overview`, toParams(f)));
}

async function backendFaculties(f: StatisticsFilters): Promise<OubFaculties> {
  return mapFaculties(await fetchOne<BackendOubFaculties>(`${ROOT}/oub-faculties`, toParams(f)));
}

async function backendTeachers(f: StatisticsFilters): Promise<OubTeachers> {
  return mapTeachers(await fetchOne<BackendOubTeachers>(`${ROOT}/oub-teachers`, toParams(f)));
}

async function overviewSource(f: StatisticsFilters): Promise<OubOverview> {
  return USE_MOCK ? mapOverview(await mockOverview(f)) : backendOverview(f);
}
async function facultiesSource(f: StatisticsFilters): Promise<OubFaculties> {
  return USE_MOCK ? mapFaculties(await mockFaculties(f)) : backendFaculties(f);
}
async function teachersSource(f: StatisticsFilters): Promise<OubTeachers> {
  return USE_MOCK ? mapTeachers(await mockTeachers(f)) : backendTeachers(f);
}

export function useOubOverview(filters: StatisticsFilters, enabled: boolean) {
  return useQuery<OubOverview>({
    queryKey: [STATISTICS_KEY, 'overview', filters.academicYear ?? 'all', filters.faculty ?? 'all'],
    queryFn: () => overviewSource(filters),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useOubFaculties(filters: StatisticsFilters, enabled: boolean) {
  return useQuery<OubFaculties>({
    queryKey: [STATISTICS_KEY, 'faculties', filters.academicYear ?? 'all', filters.faculty ?? 'all'],
    queryFn: () => facultiesSource(filters),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useOubTeachers(filters: StatisticsFilters, enabled: boolean) {
  return useQuery<OubTeachers>({
    queryKey: [STATISTICS_KEY, 'teachers', filters.academicYear ?? 'all', filters.faculty ?? 'all'],
    queryFn: () => teachersSource(filters),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

interface BackendRefRow {
  _id: string;
  title: string;
}

export function useAcademicYearsForStatistics() {
  return useQuery<RefOption[]>({
    queryKey: ['academicYears', 'study-load-statistics-select'],
    queryFn: async () => {
      const docs = await fetchList<BackendRefRow>('/academic-years', { active: true });
      return docs.map((d) => ({ id: d._id, title: d.title }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useFacultiesForStatistics() {
  return useQuery<RefOption[]>({
    queryKey: ['faculties', 'study-load-statistics-select'],
    queryFn: async () => {
      const docs = await fetchList<BackendRefRow>('/faculties', { active: true });
      return docs.map((d) => ({ id: d._id, title: d.title }));
    },
    staleTime: 5 * 60 * 1000,
  });
}
