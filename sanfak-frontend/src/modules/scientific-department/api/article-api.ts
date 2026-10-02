import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { fetchList, fetchOne, fetchPaginated, putJson, uploadMultipart } from '@/shared/api';
import type { Article, ArticleFilters, ArticleStatus, JournalType } from '../model/types';

const ROOT = '/articles';
const KEY = 'sci-articles';

interface BackendRef {
  _id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  title?: string;
  type?: JournalType;
}

export interface BackendArticle {
  _id: string;
  author?: BackendRef | null;
  department?: BackendRef | null;
  faculty?: BackendRef | null;
  journal?: BackendRef | null;
  journalName: string;
  title?: string | null;
  academicYear?: string | null;
  publishedDate?: string | null;
  year?: number | null;
  pages?: string | null;
  url?: string | null;
  authorCount?: number | null;
  fileUrl?: string | null;
  type: JournalType;
  status: ArticleStatus;
  rejectionReason?: string | null;
  rejectedBy?: BackendRef | null;
  rejectedByRole?: string | null;
  createdAt?: string;
}

const personName = (p?: BackendRef | null): string =>
  p ? [p.lastName, p.firstName].filter(Boolean).join(' ') : '';

export function mapArticle(doc: BackendArticle): Article {
  return {
    id: doc._id,
    authorName: personName(doc.author),
    title: doc.title ?? null,
    journalId: doc.journal?._id ?? null,
    journalName: doc.journalName,
    type: doc.type,
    academicYear: doc.academicYear ?? null,
    publishYear: doc.year ?? null,
    publishedDate: doc.publishedDate ?? '',
    pages: doc.pages ?? null,
    url: doc.url ?? null,
    authorCount: doc.authorCount ?? null,
    facultyName: doc.faculty?.title ?? null,
    departmentName: doc.department?.title ?? null,
    status: doc.status,
    rejectionReason: doc.rejectionReason ?? null,
    rejectedByName: personName(doc.rejectedBy) || null,
    rejectedByRole: doc.rejectedByRole ?? null,
    fileUrl: doc.fileUrl ?? null,
    date: doc.createdAt ? doc.createdAt.slice(0, 10) : '',
  };
}

export interface ArticlePayload {
  type: JournalType;
  journal: string;
  title?: string;
  academicYear: string;
  publishedDate: string;
  pages: string;
  authorCount: number;
  url: string;
  file?: File | null;
}

const toMultipart = (v: ArticlePayload) => ({
  type: v.type,
  journal: v.journal,
  title: v.title || undefined,
  academicYear: v.academicYear,
  publishedDate: v.publishedDate,
  pages: v.pages,
  authorCount: v.authorCount,
  url: v.url,
  files: v.file ?? undefined,
});

export function useArticlesPaginate(
  page: number,
  limit: number,
  filters: ArticleFilters,
) {
  return useQuery({
    queryKey: [KEY, { page, limit, ...filters }],
    queryFn: async () => {
      const res = await fetchPaginated<BackendArticle>(`${ROOT}/paginate`, {
        page,
        limit,
        status: filters.status || undefined,
        type: filters.type || undefined,
        academicYear: filters.academicYear || undefined,
        faculty: filters.faculty || undefined,
        search: filters.search || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });
      return { ...res, docs: res.docs.map(mapArticle) };
    },
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export async function fetchArticlesForExport(
  filters: ArticleFilters,
): Promise<Article[]> {
  const docs = await fetchList<BackendArticle>(ROOT, {
    status: filters.status || undefined,
    type: filters.type || undefined,
    academicYear: filters.academicYear || undefined,
    faculty: filters.faculty || undefined,
    search: filters.search || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  });
  return docs.map(mapArticle);
}

export function useArticle(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'one', id],
    enabled: !!id,
    queryFn: async (): Promise<Article> => {
      const doc = await fetchOne<BackendArticle>(`${ROOT}/${id}`);
      return mapArticle(doc);
    },
    refetchOnWindowFocus: false,
  });
}

export function useCreateArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: ArticlePayload) => uploadMultipart(ROOT, 'POST', toMultipart(v)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string } & ArticlePayload) => {
      const { id, ...rest } = v;
      return uploadMultipart(`${ROOT}/${id}`, 'PUT', toMultipart(rest));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useApproveArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => putJson(`${ROOT}/${id}/approve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useRejectArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; reason: string }) =>
      putJson(`${ROOT}/${v.id}/reject`, { reason: v.reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
