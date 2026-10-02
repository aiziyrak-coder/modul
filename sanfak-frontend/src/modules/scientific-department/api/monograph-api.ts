import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  apiClient,
  fetchList,
  fetchOne,
  fetchPaginated,
  putJson,
  uploadMultipart,
} from '@/shared/api';
import type {
  ArticleStatus,
  BadgeStatus,
  Monograph,
  MonographFilters,
  MonographSlot,
} from '../model/types';

const ROOT = '/monographs';
const KEY = 'sci-monographs';

interface BackendRef {
  _id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  title?: string;
}

interface BackendMonograph {
  _id: string;
  author?: BackendRef | null;
  department?: BackendRef | null;
  faculty?: BackendRef | null;
  title?: string | null;
  isbn?: string | null;
  publisher?: string | null;
  ssvNumber?: string | null;
  ssvDate?: string | null;
  isbnFileUrl?: string | null;
  files?: Partial<Record<MonographSlot, string>>;
  status: ArticleStatus;
  ilmiyApprovedAt?: string | null;
  kotibSignedBy?: BackendRef | null;
  kotibSignedAt?: string | null;
  kotibEriSerial?: string | null;
  prorektorSignedBy?: BackendRef | null;
  prorektorSignedAt?: string | null;
  prorektorEriSerial?: string | null;
  ssvSentAt?: string | null;
  ssvReceivedAt?: string | null;
  ssvResponseFileUrl?: string | null;
  teacherConfirmedAt?: string | null;
  dataApprovedAt?: string | null;
  dataRejectionReason?: string | null;
  rejectionReason?: string | null;
  rejectedBy?: BackendRef | null;
  rejectedByRole?: string | null;
  createdAt?: string;
}

const personName = (p?: BackendRef | null): string =>
  p ? [p.lastName, p.firstName].filter(Boolean).join(' ') : '';

const day = (d?: string | null): string | null => (d ? d.slice(0, 10) : null);

function mapMonograph(doc: BackendMonograph): Monograph {
  return {
    id: doc._id,
    authorName: personName(doc.author),
    title: doc.title || null,
    isbn: doc.isbn || null,
    publisher: doc.publisher || null,
    ssvNumber: doc.ssvNumber || null,
    ssvDate: doc.ssvDate || null,
    isbnFileUrl: doc.isbnFileUrl || null,
    facultyName: doc.faculty?.title ?? null,
    departmentName: doc.department?.title ?? null,
    files: doc.files ?? {},
    status: doc.status,
    ilmiyApproved: !!doc.ilmiyApprovedAt,
    ilmiyApprovedAt: day(doc.ilmiyApprovedAt),
    kotibSigned: !!doc.kotibSignedAt,
    kotibSignedAt: day(doc.kotibSignedAt),
    kotibEriSerial: doc.kotibEriSerial ?? null,
    kotibSignedByName: personName(doc.kotibSignedBy) || null,
    prorektorSigned: !!doc.prorektorSignedAt,
    prorektorSignedAt: day(doc.prorektorSignedAt),
    prorektorEriSerial: doc.prorektorEriSerial ?? null,
    prorektorSignedByName: personName(doc.prorektorSignedBy) || null,
    ssvSent: !!doc.ssvSentAt,
    ssvSentAt: day(doc.ssvSentAt),
    ssvReceived: !!doc.ssvReceivedAt,
    ssvReceivedAt: day(doc.ssvReceivedAt),
    ssvResponseFileUrl: doc.ssvResponseFileUrl || null,
    teacherConfirmed: !!doc.teacherConfirmedAt,
    dataApproved: !!doc.dataApprovedAt,
    dataRejectionReason: doc.dataRejectionReason || null,
    rejectionReason: doc.rejectionReason ?? null,
    rejectedByName: personName(doc.rejectedBy) || null,
    rejectedByRole: doc.rejectedByRole ?? null,
    date: doc.createdAt ? doc.createdAt.slice(0, 10) : '',
  };
}

export interface MonographPayload {
  slotFiles: Partial<Record<MonographSlot, File>>;
}

const toMultipart = (v: MonographPayload) => {
  const entries = Object.entries(v.slotFiles).filter(([, f]) => !!f) as [
    MonographSlot,
    File,
  ][];
  return {
    files: entries.map(([, f]) => f),
    fileSlots: JSON.stringify(entries.map(([slot]) => slot)),
  };
};

const toBackendStatus = (s?: BadgeStatus): ArticleStatus | undefined =>
  s && ['new', 'approved', 'rejected'].includes(s)
    ? (s as ArticleStatus)
    : s
      ? 'pending'
      : undefined;

export function useMonographsPaginate(
  page: number,
  limit: number,
  filters: MonographFilters,
) {
  return useQuery({
    queryKey: [KEY, { page, limit, ...filters }],
    queryFn: async () => {
      const res = await fetchPaginated<BackendMonograph>(`${ROOT}/paginate`, {
        page,
        limit,
        status: toBackendStatus(filters.status),
        faculty: filters.faculty || undefined,
        department: filters.department || undefined,
        search: filters.search || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });
      return { ...res, docs: res.docs.map(mapMonograph) };
    },
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export async function fetchMonographsForExport(
  filters: MonographFilters,
): Promise<Monograph[]> {
  const docs = await fetchList<BackendMonograph>(ROOT, {
    status: toBackendStatus(filters.status),
    faculty: filters.faculty || undefined,
    department: filters.department || undefined,
    search: filters.search || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  });
  return docs.map(mapMonograph);
}

export function useMonograph(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'one', id],
    enabled: !!id,
    queryFn: async (): Promise<Monograph> => {
      const doc = await fetchOne<BackendMonograph>(`${ROOT}/${id}`);
      return mapMonograph(doc);
    },
    refetchOnWindowFocus: false,
  });
}

export function useCreateMonograph() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: MonographPayload) => uploadMultipart(ROOT, 'POST', toMultipart(v)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateMonograph() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string } & MonographPayload) => {
      const { id, ...rest } = v;
      return uploadMultipart(`${ROOT}/${id}`, 'PUT', toMultipart(rest));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useApproveMonograph() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => putJson(`${ROOT}/${id}/approve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useSignMonograph() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; eriKey: string }) =>
      putJson(`${ROOT}/${v.id}/sign`, { eriKey: v.eriKey }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useRejectMonograph() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; reason: string }) =>
      putJson(`${ROOT}/${v.id}/reject`, { reason: v.reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useSsvSendMonograph() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => putJson(`${ROOT}/${id}/ssv-send`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useSsvDecisionMonograph() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      id: string;
      decision: 'approve' | 'reject';
      reason?: string;
      file: File;
    }) =>
      uploadMultipart(`${ROOT}/${v.id}/ssv-response`, 'PUT', {
        decision: v.decision,
        reason: v.reason || undefined,
        file: v.file,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export interface FillDataPayload {
  id: string;
  title: string;
  ssvNumber: string;
  ssvDate: string;
  isbn: string;
  publisher: string;
  isbnFile?: File | null;
}

export function useFillDataMonograph() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: FillDataPayload) =>
      uploadMultipart(`${ROOT}/${v.id}/fill-data`, 'PUT', {
        title: v.title,
        ssvNumber: v.ssvNumber,
        ssvDate: v.ssvDate,
        isbn: v.isbn,
        publisher: v.publisher,
        file: v.isbnFile ?? undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDataApproveMonograph() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => putJson(`${ROOT}/${id}/data-approve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDataRejectMonograph() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; reason: string }) =>
      putJson(`${ROOT}/${v.id}/data-reject`, { reason: v.reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

function parseBlobErrorMessage(text: string): string | undefined {
  try {
    return (JSON.parse(text) as { message?: string }).message;
  } catch {
    return undefined;
  }
}

export async function downloadMonographArchive(
  id: string,
  title?: string | null,
): Promise<void> {
  let res;
  try {
    res = await apiClient.get(`/monographs/${id}/archive`, { responseType: 'blob' });
  } catch (err) {
    const body = (err as { response?: { data?: unknown } })?.response?.data;
    if (body instanceof Blob) {
      const message = parseBlobErrorMessage(await body.text());
      if (message) throw new Error(message);
    }
    throw err;
  }

  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(title || 'monografiya').replace(/[\\/:*?"<>|]/g, ' ').trim()}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
