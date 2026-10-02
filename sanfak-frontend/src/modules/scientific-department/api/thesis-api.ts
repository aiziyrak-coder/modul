import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { fetchList, fetchOne, fetchPaginated, putJson, uploadMultipart } from '@/shared/api';
import type { ArticleStatus, Thesis, ThesisFilters, ThesisType } from '../model/types';

const ROOT = '/theses';
const KEY = 'sci-theses';

interface BackendRef {
  _id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  title?: string;
}

interface BackendThesis {
  _id: string;
  author?: BackendRef | null;
  department?: BackendRef | null;
  faculty?: BackendRef | null;
  conferenceName: string;
  title: string;
  type: ThesisType;
  academicYear?: string | null;
  publishedDate?: string | null;
  year?: number | null;
  pages?: string | null;
  url?: string | null;
  authorCount?: number | null;
  fileUrl?: string | null;
  status: ArticleStatus;
  rejectionReason?: string | null;
  rejectedBy?: BackendRef | null;
  rejectedByRole?: string | null;
  createdAt?: string;
}

const personName = (p?: BackendRef | null): string =>
  p ? [p.lastName, p.firstName].filter(Boolean).join(' ') : '';

function mapThesis(doc: BackendThesis): Thesis {
  return {
    id: doc._id,
    authorName: personName(doc.author),
    title: doc.title,
    conferenceName: doc.conferenceName,
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

export interface ThesisPayload {
  type: ThesisType;
  conferenceName: string;
  title: string;
  academicYear: string;
  publishedDate: string;
  pages: string;
  authorCount: number;
  url?: string;
  file?: File | null;
}

const toMultipart = (v: ThesisPayload) => ({
  type: v.type,
  conferenceName: v.conferenceName,
  title: v.title,
  academicYear: v.academicYear,
  publishedDate: v.publishedDate,
  pages: v.pages,
  authorCount: v.authorCount,
  url: v.url || undefined,
  files: v.file ?? undefined,
});

export function useThesesPaginate(page: number, limit: number, filters: ThesisFilters) {
  return useQuery({
    queryKey: [KEY, { page, limit, ...filters }],
    queryFn: async () => {
      const res = await fetchPaginated<BackendThesis>(`${ROOT}/paginate`, {
        page,
        limit,
        status: filters.status || undefined,
        type: filters.type || undefined,
        academicYear: filters.academicYear || undefined,
        search: filters.search || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });
      return { ...res, docs: res.docs.map(mapThesis) };
    },
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export async function fetchThesesForExport(
  filters: ThesisFilters,
): Promise<Thesis[]> {
  const docs = await fetchList<BackendThesis>(ROOT, {
    status: filters.status || undefined,
    type: filters.type || undefined,
    academicYear: filters.academicYear || undefined,
    search: filters.search || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  });
  return docs.map(mapThesis);
}

export function useThesis(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'one', id],
    enabled: !!id,
    queryFn: async (): Promise<Thesis> => {
      const doc = await fetchOne<BackendThesis>(`${ROOT}/${id}`);
      return mapThesis(doc);
    },
    refetchOnWindowFocus: false,
  });
}

export function useCreateThesis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: ThesisPayload) => uploadMultipart(ROOT, 'POST', toMultipart(v)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateThesis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string } & ThesisPayload) => {
      const { id, ...rest } = v;
      return uploadMultipart(`${ROOT}/${id}`, 'PUT', toMultipart(rest));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useReviewThesis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => putJson(`${ROOT}/${id}/review`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useApproveThesis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => putJson(`${ROOT}/${id}/approve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useRejectThesis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; reason: string }) =>
      putJson(`${ROOT}/${v.id}/reject`, { reason: v.reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
