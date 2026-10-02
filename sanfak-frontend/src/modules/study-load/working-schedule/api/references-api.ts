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

export function useDirectionsRef() {
  return useQuery({
    queryKey: ['ws-directions', 'list-for-filter'],
    queryFn: () => fetchRefList('/directions'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCourseRefsRef() {
  return useQuery({
    queryKey: ['ws-course-refs', 'list-for-filter'],
    queryFn: () => fetchRefList('/courses'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAcademicYearsRef() {
  return useQuery({
    queryKey: ['ws-academic-years', 'list-for-filter'],
    queryFn: () => fetchRefList('/academic-years'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAssessmentTypesRef() {
  return useQuery({
    queryKey: ['ws-assessment-types', 'list-for-select'],
    queryFn: () => fetchRefList('/assessment-types'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDepartmentsRef() {
  return useQuery({
    queryKey: ['ws-departments', 'list-for-filter'],
    queryFn: () => fetchRefList('/departments'),
    staleTime: 5 * 60 * 1000,
  });
}
