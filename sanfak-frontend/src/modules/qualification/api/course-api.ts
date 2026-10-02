import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteData,
  fetchList,
  fetchOne,
  fetchPaginated,
  postJson,
  putJson,
  type Paginated,
} from '@/shared/api';
import type {
  CourseFormDefaults,
  CourseInput,
  CourseStatus,
  EduForm,
  Option,
} from '../model/course.types';
import { mapCourse, type BackendCourse } from './course-mapper';

const USE_MOCK = false;

const KEY = 'qual-course';
const ROOT = '/qualification-courses';

export interface CourseFilter {
  page: number;
  limit: number;
  search?: string;
  status?: number;
  form?: number;
  startDate?: string;
  endDate?: string;
  [key: string]: unknown;
}

export function useCoursesPaginated(filter: CourseFilter) {
  return useQuery({
    staleTime: 0,
    refetchOnWindowFocus: false,
    queryKey: [KEY, 'paginate', filter],
    queryFn: async () => {
      const res: Paginated<BackendCourse> = await fetchPaginated(`${ROOT}/paginate`, filter);
      return {
        items: res.docs.map(mapCourse),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs, totalPages: res.totalPages },
      };
    },
    enabled: !USE_MOCK,
  });
}

interface BackendCourseDetail {
  _id: string;
  title: string;
  form: number;
  status?: number;
  courseType?: { _id: string; title: string } | string | null;
}

export function useCourse(id: string | undefined) {
  return useQuery({
    staleTime: 0,
    queryKey: [KEY, 'detail', id],
    queryFn: async () => {
      const b = await fetchOne<BackendCourseDetail>(`${ROOT}/${id}`);
      return {
        id: b._id,
        title: b.title,
        form: (b.form === 2 ? 2 : 1) as EduForm,
        status: (b.status === 2 ? 2 : b.status === 3 ? 3 : 1) as CourseStatus,
        courseTypeTitle:
          typeof b.courseType === 'object' && b.courseType ? b.courseType.title : undefined,
      };
    },
    enabled: !!id,
  });
}

interface BackendCourseFull {
  _id: string;
  courseType?: { _id: string } | string | null;
  title: string;
  creditHours: number;
  price: number;
  form: number;
  listenersLimit: number;
  startDate?: string;
  endDate?: string;
  address?: string;
  location?: { lat?: string; lng?: string } | null;
  teachers?: Array<{ _id: string } | string>;
}

export function useCourseDetail(id: string | undefined) {
  return useQuery({
    staleTime: 0,
    queryKey: [KEY, 'edit-detail', id],
    queryFn: async (): Promise<CourseFormDefaults> => {
      const b = await fetchOne<BackendCourseFull>(`${ROOT}/${id}`);
      const courseType =
        typeof b.courseType === 'object' && b.courseType ? b.courseType._id : (b.courseType ?? '');
      const teachers = (b.teachers ?? []).map((tt) =>
        typeof tt === 'object' && tt ? tt._id : tt,
      );
      return {
        courseType,
        form: (b.form === 2 ? 2 : 1) as EduForm,
        title: b.title,
        creditHours: b.creditHours,
        price: b.price,
        listenersLimit: b.listenersLimit,
        startDate: b.startDate ?? '',
        endDate: b.endDate ?? '',
        address: b.address,
        lat: b.location?.lat,
        lng: b.location?.lng,
        teachers,
      };
    },
    enabled: !!id,
  });
}

export function useCreateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CourseInput) => postJson(ROOT, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; input: CourseInput }) => putJson(`${ROOT}/${v.id}`, v.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

interface BackendCourseTypeOption {
  _id: string;
  title: string;
}

export function useCourseTypeOptions() {
  return useQuery({
    staleTime: 0,
    queryKey: [KEY, 'course-type-options'],
    queryFn: async (): Promise<Option[]> => {
      const docs = await fetchList<BackendCourseTypeOption>('/qualification-course-types');
      return docs.map((d) => ({ value: d._id, label: d.title }));
    },
  });
}

interface BackendTeacherOption {
  _id: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
}

export function useTeacherOptions() {
  return useQuery({
    staleTime: 0,
    queryKey: [KEY, 'teacher-options'],
    queryFn: async (): Promise<Option[]> => {
      const docs = await fetchList<BackendTeacherOption>('/qualification-teachers');
      return docs.map((d) => ({
        value: d._id,
        label: [d.lastName, d.firstName, d.middleName].filter(Boolean).join(' ').trim(),
      }));
    },
  });
}

interface BackendCourseOption {
  _id: string;
  title: string;
}

export function useCourseOptions(form?: number) {
  return useQuery({
    staleTime: 0,
    queryKey: [KEY, 'course-options', form ?? 'all'],
    queryFn: async (): Promise<Option[]> => {
      const docs = await fetchList<BackendCourseOption>(ROOT, form ? { form } : undefined);
      return docs.map((d) => ({ value: d._id, label: d.title }));
    },
  });
}
