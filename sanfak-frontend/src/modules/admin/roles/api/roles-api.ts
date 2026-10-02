import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteData,
  fetchOne,
  fetchPaginated,
  postJson,
  putJson,
  type Paginated,
} from '@/shared/api';
import { apiClient } from '@/shared/api';
import type { AdminRoleInput, SectionsGroupedResponse } from '../model/types';
import { mapRole, type BackendRole } from './mapper';

const KEY = 'admin-roles';
const ROOT = '/roles';

export function useAdminRoles(page = 1, limit = 20, search?: string) {
  return useQuery({
    queryKey: [KEY, page, limit, search],
    queryFn: async () => {
      const res: Paginated<BackendRole> = await fetchPaginated(`${ROOT}/paginate`, {
        page,
        limit,
        ...(search ? { search } : {}),
      });
      return {
        items: res.docs.map(mapRole),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs, totalPages: res.totalPages },
      };
    },
  });
}

export function useAdminRole(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'detail', id],
    queryFn: async () => {
      const doc = await fetchOne<BackendRole>(`${ROOT}/${id}`);
      return mapRole(doc);
    },
    enabled: !!id,
  });
}

export function useSectionsGrouped() {
  return useQuery({
    queryKey: [KEY, 'sections-grouped'],
    queryFn: async () => {
      const res = await apiClient.get<SectionsGroupedResponse>(`${ROOT}/sections-grouped`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminRoleInput) => postJson<{ _id: string }>(ROOT, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<AdminRoleInput> }) =>
      putJson<{ message: string }>(`${ROOT}/${id}`, body),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: [KEY, 'detail', id] });
    },
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
