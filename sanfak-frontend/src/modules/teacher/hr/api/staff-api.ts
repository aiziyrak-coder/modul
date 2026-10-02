import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  apiClient,
  deleteData,
  fetchList,
  fetchPaginated,
  getApiErrorMessage,
  patchJson,
  uploadMultipart,
  type Paginated,
} from '@/shared/api';
import { mapStaffDetail, mapStaffListItem, type BackendStaffUser } from './staff-mapper';
import type { RefOption, StaffDetail, StaffFormValues } from '../model/staff-types';

const STAFF_KEY = 'hrStaff';
const ROOT = '/staff';

export interface StaffFilter {
  page: number;
  limit: number;
  search?: string;
  faculty?: string;
  department?: string;
  position?: string;
  active?: boolean;
}

export function useStaffPaginated(filter: StaffFilter) {
  return useQuery({
    queryKey: [STAFF_KEY, 'paginate', filter],
    queryFn: async () => {
      const params: { page: number; limit: number; [key: string]: unknown } = {
        page: filter.page,
        limit: filter.limit,
      };
      if (filter.search) params.search = filter.search;
      if (filter.faculty) params.faculty = filter.faculty;
      if (filter.department) params.department = filter.department;
      if (filter.position) params.position = filter.position;
      if (filter.active !== undefined) params.active = filter.active;

      const res: Paginated<BackendStaffUser> = await fetchPaginated(`${ROOT}/paginate`, params);
      return {
        items: res.docs.map(mapStaffListItem),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs },
      };
    },
  });
}

export function useStaffById(id: string | undefined) {
  return useQuery<StaffDetail>({
    queryKey: [STAFF_KEY, 'detail', id],
    queryFn: async () => {
      if (!id) throw new Error('id kerak');
      const res = await apiClient.get<BackendStaffUser>(`${ROOT}/${id}`);
      return mapStaffDetail(res.data);
    },
    enabled: Boolean(id),
  });
}

export type StaffMultipartFields = Record<
  string,
  string | number | boolean | File | File[] | null | undefined
>;

export function buildStaffFormData(values: StaffFormValues): StaffMultipartFields {
  return {
    firstName: values.firstName,
    lastName: values.lastName,
    middleName: values.middleName || undefined,
    email: values.email || undefined,
    phone: values.phone || undefined,
    jshshir: values.jshshir || undefined,
    passportSeria: values.passportSeries || undefined,
    passportNumber: values.passportNumber || undefined,
    googleScholar: values.googleScholarUrl || undefined,
    scopus: values.scopusUrl || undefined,
    department: values.department ?? undefined,
    position: values.position ?? undefined,
    academicTitle: values.academicTitle ?? undefined,
    photo: values.photo ?? undefined,
    bachelorDegree: values.bachelorDegreeNew.length ? values.bachelorDegreeNew : undefined,
    masterDegree: values.masterDegreeNew.length ? values.masterDegreeNew : undefined,
    scientificDegree: values.scientificDegreeNew.length ? values.scientificDegreeNew : undefined,
    scientificTitle: values.scientificTitleNew.length ? values.scientificTitleNew : undefined,
    teachingSpecialtyName: values.teachingSpecialtyName || undefined,
    teachingSpecialtyCode: values.teachingSpecialtyCode || undefined,
    teachingSpecialtyBasis: values.teachingSpecialtyBasis ?? undefined,
    teachingSpecialtyNote: values.teachingSpecialtyNote || undefined,
  };
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: StaffFormValues) =>
      uploadMultipart<{ message: string; _id: string }>(ROOT, 'POST', buildStaffFormData(values)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [STAFF_KEY] }),
  });
}

export function useUpdateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: StaffFormValues }) =>
      uploadMultipart<{ message: string }>(`${ROOT}/${id}`, 'PUT', buildStaffFormData(values)),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: [STAFF_KEY] });
      void qc.invalidateQueries({ queryKey: [STAFF_KEY, 'detail', id] });
    },
  });
}

export function useDeleteStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [STAFF_KEY] }),
  });
}

export function useRestoreStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => patchJson<{ message: string }>(`${ROOT}/${id}/restore`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [STAFF_KEY] }),
  });
}

export async function downloadStaffExport(
  filter: Omit<StaffFilter, 'page' | 'limit'>,
): Promise<void> {
  const params: Record<string, unknown> = {};
  if (filter.search) params.search = filter.search;
  if (filter.faculty) params.faculty = filter.faculty;
  if (filter.department) params.department = filter.department;
  if (filter.position) params.position = filter.position;

  const res = await apiClient.get(`${ROOT}/export`, { params, responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'xodimlar.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function fetchProfileIdByUser(userId: string): Promise<string | null> {
  const res = await apiClient.get<{ _id: string }[]>('/teachers', { params: { user: userId } });
  const first = Array.isArray(res.data) ? res.data[0] : undefined;
  return first?._id ?? null;
}

async function fetchRefOptions(url: string, params?: Record<string, unknown>): Promise<RefOption[]> {
  try {
    const docs = await fetchList<{ _id: string; title: string }>(url, { active: true, ...params });
    return docs.map((d) => ({ id: d._id, title: d.title }));
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[perm] reference so'rovi muvaffaqiyatsiz:", e);
    return [];
  }
}

export function useFacultiesForSelect() {
  return useQuery({
    queryKey: ['hrStaff-faculties', 'list-for-select'],
    queryFn: () => fetchRefOptions('/faculties'),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePositionsForSelect() {
  return useQuery({
    queryKey: ['hrStaff-positions', 'list-for-select'],
    queryFn: () => fetchRefOptions('/positions'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAcademicTitlesForSelect() {
  return useQuery({
    queryKey: ['hrStaff-academic-titles', 'list-for-select'],
    queryFn: () => fetchRefOptions('/academic-titles'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDepartmentsForSelect(facultyId?: string | null) {
  return useQuery({
    queryKey: ['hrStaff-departments', 'list-for-select', facultyId ?? null],
    queryFn: () => fetchRefOptions('/departments', facultyId ? { faculty: facultyId } : undefined),
    staleTime: 5 * 60 * 1000,
  });
}

export { getApiErrorMessage };
