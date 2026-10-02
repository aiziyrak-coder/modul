import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { fetchList, fetchOne, fetchPaginated, putJson, uploadMultipart } from '@/shared/api';
import type {
  ArticleStatus,
  Methodical,
  MethodicalFilters,
  MethodicalSlot,
} from '../model/types';

const ROOT = '/methodical-recommendations';
const KEY = 'sci-methodical';

interface BackendRef {
  _id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  title?: string;
}

interface BackendMethodical {
  _id: string;
  author?: BackendRef | null;
  department?: BackendRef | null;
  faculty?: BackendRef | null;
  title: string;
  direction?: string;
  specialty?: { _id: string; code?: string; name?: string } | null;
  academicYear?: string | null;
  files?: Partial<Record<MethodicalSlot, string>>;
  status: ArticleStatus;
  ilmiyApprovedAt?: string | null;
  kotibSignedBy?: BackendRef | null;
  kotibSignedAt?: string | null;
  kotibEriSerial?: string | null;
  rektorSignedBy?: BackendRef | null;
  rektorSignedAt?: string | null;
  rektorEriSerial?: string | null;
  registrationNumber?: string | null;
  rejectionReason?: string | null;
  rejectedBy?: BackendRef | null;
  rejectedByRole?: string | null;
  source?: 'internal' | 'public';
  submitterName?: string;
  submitterPhone?: string;
  submitterEmail?: string;
  submitterOrganization?: string;
  submitterDepartment?: string;
  createdAt?: string;
}

const personName = (p?: BackendRef | null): string =>
  p ? [p.lastName, p.firstName].filter(Boolean).join(' ') : '';

const day = (d?: string | null): string | null => (d ? d.slice(0, 10) : null);

function mapMethodical(doc: BackendMethodical): Methodical {
  return {
    id: doc._id,
    authorName: personName(doc.author) || doc.submitterName || '',
    source: doc.source === 'public' ? 'public' : 'internal',
    submitterPhone: doc.submitterPhone || null,
    submitterEmail: doc.submitterEmail || null,
    submitterOrganization: doc.submitterOrganization || null,
    submitterDepartment: doc.submitterDepartment || null,
    title: doc.title,
    specialtyId: doc.specialty?._id ?? null,
    specialtyLabel: doc.specialty
      ? `${doc.specialty.code ?? ''} — ${doc.specialty.name ?? ''}`.trim()
      : null,
    direction: doc.direction ?? '',
    academicYear: doc.academicYear ?? null,
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
    rektorSigned: !!doc.rektorSignedAt,
    rektorSignedAt: day(doc.rektorSignedAt),
    rektorEriSerial: doc.rektorEriSerial ?? null,
    rektorSignedByName: personName(doc.rektorSignedBy) || null,
    registrationNumber: doc.registrationNumber ?? null,
    rejectionReason: doc.rejectionReason ?? null,
    rejectedByName: personName(doc.rejectedBy) || null,
    rejectedByRole: doc.rejectedByRole ?? null,
    date: doc.createdAt ? doc.createdAt.slice(0, 10) : '',
  };
}

export interface MethodicalPayload {
  title: string;
  specialty: string;
  academicYear: string;
  slotFiles: Partial<Record<MethodicalSlot, File>>;
}

const toMultipart = (v: MethodicalPayload) => {
  const entries = Object.entries(v.slotFiles).filter(([, f]) => !!f) as [
    MethodicalSlot,
    File,
  ][];
  return {
    title: v.title,
    specialty: v.specialty,
    academicYear: v.academicYear,
    files: entries.map(([, f]) => f),
    fileSlots: JSON.stringify(entries.map(([slot]) => slot)),
  };
};

export function useMethodicalsPaginate(
  page: number,
  limit: number,
  filters: MethodicalFilters,
) {
  return useQuery({
    queryKey: [KEY, { page, limit, ...filters }],
    queryFn: async () => {
      const res = await fetchPaginated<BackendMethodical>(`${ROOT}/paginate`, {
        page,
        limit,
        status: filters.status || undefined,
        academicYear: filters.academicYear || undefined,
        faculty: filters.faculty || undefined,
        department: filters.department || undefined,
        search: filters.search || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });
      return { ...res, docs: res.docs.map(mapMethodical) };
    },
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export async function fetchMethodicalForExport(
  filters: MethodicalFilters,
): Promise<Methodical[]> {
  const docs = await fetchList<BackendMethodical>(ROOT, {
    status: filters.status || undefined,
    academicYear: filters.academicYear || undefined,
    faculty: filters.faculty || undefined,
    department: filters.department || undefined,
    search: filters.search || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  });
  return docs.map(mapMethodical);
}

export function useMethodical(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'one', id],
    enabled: !!id,
    queryFn: async (): Promise<Methodical> => {
      const doc = await fetchOne<BackendMethodical>(`${ROOT}/${id}`);
      return mapMethodical(doc);
    },
    refetchOnWindowFocus: false,
  });
}

export function useCreateMethodical() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: MethodicalPayload) => uploadMultipart(ROOT, 'POST', toMultipart(v)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateMethodical() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string } & MethodicalPayload) => {
      const { id, ...rest } = v;
      return uploadMultipart(`${ROOT}/${id}`, 'PUT', toMultipart(rest));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useApproveMethodical() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => putJson(`${ROOT}/${id}/approve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export interface SignMethodicalPayload {
  id: string;
  eriKey: string;
  registrationNumber?: string;
  academicYear?: string;
}

export function useSignMethodical() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: SignMethodicalPayload) =>
      putJson(`${ROOT}/${v.id}/sign`, {
        eriKey: v.eriKey,
        registrationNumber: v.registrationNumber || undefined,
        academicYear: v.academicYear || undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useRejectMethodical() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; reason: string }) =>
      putJson(`${ROOT}/${v.id}/reject`, { reason: v.reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
