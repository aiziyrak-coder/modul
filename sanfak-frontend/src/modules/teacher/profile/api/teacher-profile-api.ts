import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteData, fetchList, getApiErrorMessage, uploadMultipart } from '@/shared/api';
import { useSessionStore } from '@/app/session';
import {
  mapTeacherProfile,
  toCreatePayload,
  toUpdatePayload,
  type BackendDegrees,
  type BackendTeacherProfile,
} from './mapper';
import type { EducationTabKey, ProfileFormValues, TeacherProfile } from '../model/types';

const PROFILE_KEY = 'teacherProfile';
const ROOT = '/teachers';

export function useMyTeacherProfile() {
  const userId = useSessionStore((s) => s.user?.id);

  return useQuery<TeacherProfile | null>({
    queryKey: [PROFILE_KEY, 'mine', userId],
    queryFn: async () => {
      const { apiClient } = await import('@/shared/api');
      const res = await apiClient.get<BackendTeacherProfile[]>(ROOT, {
        params: { user: userId },
      });
      const docs = Array.isArray(res.data) ? res.data : [];
      const ownerId = (d: BackendTeacherProfile) =>
        typeof d.user === 'string' ? d.user : (d.user?._id ?? null);
      const mine = docs.find((d) => String(ownerId(d)) === String(userId));
      return mine ? mapTeacherProfile(mine) : null;
    },
    enabled: Boolean(userId),
  });
}

export interface AccountDefaults {
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  facultyId: string | null;
  departmentId: string | null;
}

interface BackendAuthProfile {
  firstName?: string | null;
  lastName?: string | null;
  middleName?: string | null;
  faculty?: string | { _id: string } | null;
  department?: string | { _id: string; faculty?: string | { _id: string } | null } | null;
}

export function mapAccountDefaults(b: BackendAuthProfile): AccountDefaults {
  const idOf = (v: string | { _id: string } | null | undefined): string | null =>
    !v ? null : typeof v === 'string' ? v : (v._id ?? null);
  const dept = b.department && typeof b.department === 'object' ? b.department : null;
  return {
    firstName: b.firstName ?? null,
    lastName: b.lastName ?? null,
    middleName: b.middleName ?? null,
    facultyId: idOf(b.faculty) ?? idOf(dept?.faculty),
    departmentId: idOf(b.department),
  };
}

export function useAccountDefaults(enabled: boolean) {
  return useQuery<AccountDefaults>({
    queryKey: [PROFILE_KEY, 'account-defaults'],
    queryFn: async () => {
      const { apiClient } = await import('@/shared/api');
      const res = await apiClient.get<BackendAuthProfile>('/auth/profile');
      return mapAccountDefaults(res.data ?? {});
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateTeacherProfile() {
  const qc = useQueryClient();
  const userId = useSessionStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      if (!userId) throw new Error('Foydalanuvchi aniqlanmadi');
      const { apiClient } = await import('@/shared/api');
      const res = await apiClient.post<{ message: string; _id: string }>(
        ROOT,
        toCreatePayload(values),
      );
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [PROFILE_KEY] }),
  });
}

export function useUpdateTeacherProfile() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: ProfileFormValues }) => {
      const { apiClient } = await import('@/shared/api');
      const res = await apiClient.put<{ message: string }>(`${ROOT}/${id}`, toUpdatePayload(values));
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [PROFILE_KEY] }),
  });
}

export function useUploadMyDegrees() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, files }: { type: EducationTabKey; files: File[] }) =>
      uploadMultipart<{ message: string; data: BackendDegrees }>(`${ROOT}/me/degrees`, 'POST', {
        [type]: files,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [PROFILE_KEY] }),
  });
}

export function useDeleteMyDegree() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, fileId }: { type: EducationTabKey; fileId: string }) =>
      deleteData(`${ROOT}/me/degrees/${type}/${fileId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [PROFILE_KEY] }),
  });
}

interface BackendRefOption {
  _id: string;
  title: string;
}
export interface RefOption {
  id: string;
  title: string;
}

async function fetchRefOptions(url: string, params?: Record<string, unknown>): Promise<RefOption[]> {
  try {
    const docs = await fetchList<BackendRefOption>(url, { active: true, ...params });
    return docs.map((d) => ({ id: d._id, title: d.title }));
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[perm] reference so'rovi muvaffaqiyatsiz:", e);
    return [];
  }
}

export function useFacultiesForSelect() {
  return useQuery({
    queryKey: ['teacherProfile-faculties', 'list-for-select'],
    queryFn: () => fetchRefOptions('/faculties'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDepartmentsForSelect(facultyId?: string | null) {
  return useQuery({
    queryKey: ['teacherProfile-departments', 'list-for-select', facultyId ?? null],
    queryFn: () => fetchRefOptions('/departments', facultyId ? { faculty: facultyId } : undefined),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePositionsForSelect() {
  return useQuery({
    queryKey: ['teacherProfile-positions', 'list-for-select'],
    queryFn: () => fetchRefOptions('/positions'),
    staleTime: 5 * 60 * 1000,
  });
}

export { getApiErrorMessage };
