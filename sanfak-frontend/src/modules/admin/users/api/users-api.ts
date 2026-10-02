import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteData,
  fetchPaginated,
  fetchOne,
  postJson,
  putJson,
  type Paginated,
} from '@/shared/api';
import type { AdminUserInput } from '../model/types';
import { mapUser, type BackendUser } from './mapper';

const KEY = 'admin-users';
const ROOT = '/users';

export interface UsersFilter {
  page: number;
  limit: number;
  search?: string;
  role?: string;
  active?: boolean;
  [key: string]: unknown;
}

export function useAdminUsers(filter: UsersFilter) {
  return useQuery({
    queryKey: [KEY, filter],
    queryFn: async () => {
      const res: Paginated<BackendUser> = await fetchPaginated(`${ROOT}/paginate`, filter);
      return {
        items: res.docs.map(mapUser),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs, totalPages: res.totalPages },
      };
    },
  });
}

export function useAdminUser(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'detail', id],
    queryFn: async () => {
      const doc = await fetchOne<BackendUser>(`${ROOT}/${id}`);
      return mapUser(doc);
    },
    enabled: !!id,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminUserInput) => postJson<{ _id: string }>(ROOT, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<AdminUserInput> }) =>
      putJson<{ message: string }>(`${ROOT}/${id}`, body),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: [KEY, 'detail', id] });
    },
  });
}

export function useToggleUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => putJson<{ message: string }>(`${ROOT}/active/${id}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
