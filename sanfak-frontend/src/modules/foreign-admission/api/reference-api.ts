import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteData,
  fetchList,
  fetchPaginated,
  postJson,
  putJson,
  uploadMultipart,
  type Paginated,
} from '@/shared/api';
import type { LangRecord } from '../model/admission-types';

interface BackendRecord {
  _id: string;
  [field: string]: unknown;
}

export function mapLangRecord(b: BackendRecord): LangRecord {
  const out: LangRecord = { id: b._id };
  for (const [key, value] of Object.entries(b)) {
    if (key === '_id') continue;
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

export interface LangListParams {
  page: number;
  limit: number;
  search?: string;
  [key: string]: unknown;
}

const listKey = (root: string) => ['foreign-admission', 'ref', root];

export function useLangRecords(root: string, params: LangListParams) {
  return useQuery({
    queryKey: [...listKey(root), 'paginate', params],
    queryFn: async () => {
      const res: Paginated<BackendRecord> = await fetchPaginated(`${root}/paginate`, params);
      return {
        items: res.docs.map(mapLangRecord),
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

export function useAllLangRecords(root: string, enabled = true) {
  return useQuery({
    queryKey: [...listKey(root), 'all'],
    queryFn: async () => {
      const docs = await fetchList<BackendRecord>(root);
      return docs.map(mapLangRecord);
    },
    enabled,
  });
}

export type LangFormValues = Record<string, string | undefined>;

export interface SaveInput {
  id?: string;
  values: LangFormValues;
  file?: File;
}

function useRefreshList(root: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: listKey(root) });
}

export function useSaveLangRecord(root: string) {
  const refresh = useRefreshList(root);
  return useMutation({
    mutationFn: ({ id, values, file }: SaveInput) => {
      const url = id ? `${root}/${id}` : root;
      const method = id ? 'PUT' : 'POST';
      if (file) return uploadMultipart<unknown>(url, method, { ...values, files: [file] });
      return id ? putJson<unknown>(url, values) : postJson<unknown>(url, values);
    },
    onSuccess: () => void refresh(),
  });
}

export function useRemoveLangRecord(root: string) {
  const refresh = useRefreshList(root);
  return useMutation({
    mutationFn: (id: string) => deleteData(`${root}/${id}`),
    onSuccess: () => void refresh(),
  });
}

export const REF_ROOTS = {
  directions: '/admission-directions',
  educationForms: '/admission-education-forms',
  educationLanguages: '/admission-education-languages',
  countries: '/admission-countries',
} as const;
