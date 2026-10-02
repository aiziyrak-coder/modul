import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { deleteData, fetchList, fetchPaginated, uploadMultipart } from '@/shared/api';
import type { ScientificTemplate, TemplateCategory } from '../model/types';

const ROOT = '/scientific-templates';
const KEY = 'sci-templates';

interface BackendTemplate {
  _id: string;
  name: string;
  description?: string;
  category: TemplateCategory;
  fileUrl: string;
  fileName?: string;
  fileSize?: string;
  updatedAt?: string;
}

function mapTemplate(doc: BackendTemplate): ScientificTemplate {
  return {
    id: doc._id,
    name: doc.name,
    description: doc.description ?? '',
    category: doc.category,
    fileUrl: doc.fileUrl,
    fileName: doc.fileName ?? '',
    fileSize: doc.fileSize ?? '',
    updatedDate: doc.updatedAt ? doc.updatedAt.slice(0, 10) : '',
  };
}

export function useTemplates(category: TemplateCategory) {
  return useQuery({
    queryKey: [KEY, category],
    queryFn: async (): Promise<ScientificTemplate[]> => {
      const docs = await fetchList<BackendTemplate>(ROOT, { category });
      return docs.map(mapTemplate);
    },
    refetchOnWindowFocus: false,
  });
}

export function useTemplatesPaginate(
  page: number,
  limit: number,
  category: TemplateCategory,
) {
  return useQuery({
    queryKey: [KEY, 'paginate', { page, limit, category }],
    queryFn: async () => {
      const res = await fetchPaginated<BackendTemplate>(`${ROOT}/paginate`, {
        page,
        limit,
        category,
      });
      return { ...res, docs: res.docs.map(mapTemplate) };
    },
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export interface TemplatePayload {
  name: string;
  description: string;
  category: TemplateCategory;
  file?: File | null;
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: TemplatePayload) =>
      uploadMultipart(ROOT, 'POST', {
        name: v.name,
        description: v.description,
        category: v.category,
        file: v.file ?? undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string } & TemplatePayload) =>
      uploadMultipart(`${ROOT}/${v.id}`, 'PUT', {
        name: v.name,
        description: v.description,
        category: v.category,
        file: v.file ?? undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
