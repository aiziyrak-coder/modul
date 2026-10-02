import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchPaginated,
  fetchList,
  fetchOne,
  postJson,
  putJson,
  deleteData,
  uploadMultipart,
  type Paginated,
} from '@/shared/api';
import {
  mapReference,
  type BackendReference,
  type ReferenceListResult,
} from './reference-types';

export interface ReferenceListFilter {
  page: number;
  limit: number;
  search?: string;
  [key: string]: unknown;
}

export type ReferencePayload = Record<
  string,
  string | number | boolean | File | string[] | number[] | null | undefined
>;

type MultipartFields = Record<string, string | number | boolean | File | File[] | null | undefined>;

const keyOf = (root: string) => ['reference', root] as const;

export function useReferenceList(root: string, filter: ReferenceListFilter) {
  return useQuery<ReferenceListResult>({
    queryKey: [...keyOf(root), 'list', filter],
    queryFn: async () => {
      const res: Paginated<BackendReference> = await fetchPaginated(
        `${root}/paginate`,
        filter,
      );
      return {
        items: res.docs.map(mapReference),
        meta: {
          page: res.page,
          limit: res.limit,
          total: res.totalDocs,
          totalPages: res.totalPages,
        },
      };
    },
  });
}

export function useReferenceOptions(root: string | undefined) {
  return useQuery({
    queryKey: ['reference', root, 'options'],
    queryFn: async () => {
      const docs = await fetchList<BackendReference>(root as string, { active: true });
      return docs.map((d) => ({ value: d._id, label: String(d.title ?? d._id) }));
    },
    enabled: !!root,
    staleTime: 5 * 60 * 1000,
  });
}

export function useReferenceOne(root: string, id: string | undefined) {
  return useQuery({
    queryKey: [...keyOf(root), 'detail', id],
    queryFn: async () => mapReference(await fetchOne<BackendReference>(`${root}/${id}`)),
    enabled: !!id,
  });
}

export function useReferenceCreate(root: string, multipart = false) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReferencePayload) =>
      multipart
        ? uploadMultipart<{ _id: string }>(root, 'POST', payload as MultipartFields)
        : postJson<{ _id: string }>(root, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: keyOf(root) }),
  });
}

export function useReferenceUpdate(root: string, multipart = false) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReferencePayload }) =>
      multipart
        ? uploadMultipart<{ message: string }>(`${root}/${id}`, 'PUT', payload as MultipartFields)
        : putJson<{ message: string }>(`${root}/${id}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: keyOf(root) }),
  });
}

export function useReferenceRemove(root: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${root}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keyOf(root) }),
  });
}
