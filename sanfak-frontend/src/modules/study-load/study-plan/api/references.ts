import { useQuery } from '@tanstack/react-query';
import { fetchList } from '@/shared/api';

interface BackendRef {
  _id: string;
  title: string;
}

export interface RefOption {
  id: string;
  title: string;
}

function mapRef(b: BackendRef): RefOption {
  return { id: b._id, title: b.title };
}

async function fetchRefList(url: string): Promise<RefOption[]> {
  try {
    const docs = await fetchList<BackendRef>(url, { active: true });
    return docs.map(mapRef);
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[perm] reference so'rovi muvaffaqiyatsiz:", e);
    return [];
  }
}

export interface ScienceOption {
  id: string;
  title: string;
  code: string | null;
}

export function useSciences() {
  return useQuery({
    queryKey: ['sciences', 'list-for-link'],
    queryFn: async (): Promise<ScienceOption[]> => {
      try {
        const docs = await fetchList<{
          _id: string;
          title: string;
          scienceCode?: string | null;
        }>('/sciences', { active: true });
        return docs.map((d) => ({
          id: d._id,
          title: d.title,
          code: d.scienceCode ?? null,
        }));
      } catch (e) {
        if (import.meta.env.DEV) console.warn("[perm] reference so'rovi muvaffaqiyatsiz:", e);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useElectiveSciences() {
  return useQuery({
    queryKey: ['sciences', 'list-electives'],
    queryFn: async (): Promise<ScienceOption[]> => {
      try {
        const docs = await fetchList<{
          _id: string;
          title: string;
          scienceCode?: string | null;
        }>('/sciences', { active: true, isElective: true });
        return docs.map((d) => ({
          id: d._id,
          title: d.title,
          code: d.scienceCode ?? null,
        }));
      } catch (e) {
        if (import.meta.env.DEV) console.warn("[perm] reference so'rovi muvaffaqiyatsiz:", e);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAcademicLevels() {
  return useQuery({
    queryKey: ['academicLevels', 'list-for-select'],
    queryFn: () => fetchRefList('/academic-levels'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useEducationForms() {
  return useQuery({
    queryKey: ['educationForms', 'list-for-select'],
    queryFn: () => fetchRefList('/education-forms'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useReadingForms() {
  return useQuery({
    queryKey: ['readingForms', 'list-for-select'],
    queryFn: () => fetchRefList('/reading-forms'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSpecializations() {
  return useQuery({
    queryKey: ['specializations', 'list-for-select'],
    queryFn: () => fetchRefList('/specializations'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useStudyPeriods() {
  return useQuery({
    queryKey: ['studyPeriods', 'list-for-select'],
    queryFn: () => fetchRefList('/studyPeriods'),
    staleTime: 5 * 60 * 1000,
  });
}
