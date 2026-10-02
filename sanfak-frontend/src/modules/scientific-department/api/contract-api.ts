import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  apiClient,
  deleteData,
  fetchList,
  fetchOne,
  fetchPaginated,
  putJson,
  uploadMultipart,
} from '@/shared/api';
import type {
  ArticleStatus,
  ContractFilters,
  ContractSlot,
  EconomicContract,
} from '../model/types';

const ROOT = '/economic-contracts';
const KEY = 'sci-contracts';

interface BackendRef {
  _id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  title?: string;
}

interface BackendContract {
  _id: string;
  teacher?: BackendRef | null;
  department?: BackendRef | null;
  faculty?: BackendRef | null;
  createdBy?: BackendRef | null;
  title: string;
  partnerOrganization: string;
  contractDate?: string | null;
  amount: number;
  currentYearAmount?: number;
  files?: Partial<Record<ContractSlot, string>>;
  status: ArticleStatus;
  rejectionReason?: string | null;
  rejectedBy?: BackendRef | null;
  rejectedByRole?: string | null;
  academicYear?: BackendRef | null;
  createdAt?: string;
}

const personName = (p?: BackendRef | null): string =>
  p ? [p.lastName, p.firstName].filter(Boolean).join(' ') : '';

const day = (d?: string | null): string | null => (d ? d.slice(0, 10) : null);

function mapContract(doc: BackendContract): EconomicContract {
  return {
    id: doc._id,
    teacherName: personName(doc.teacher) || null,
    teacherId: doc.teacher?._id ?? null,
    departmentName: doc.department?.title ?? null,
    facultyName: doc.faculty?.title ?? null,
    title: doc.title,
    partnerOrganization: doc.partnerOrganization,
    contractDate: day(doc.contractDate),
    amount: doc.amount ?? 0,
    currentYearAmount: doc.currentYearAmount ?? 0,
    files: doc.files ?? {},
    status: doc.status,
    rejectionReason: doc.rejectionReason ?? null,
    rejectedByName: personName(doc.rejectedBy) || null,
    rejectedByRole: doc.rejectedByRole ?? null,
    academicYearId: doc.academicYear?._id ?? null,
    academicYearTitle: doc.academicYear?.title ?? null,
    createdByName: personName(doc.createdBy) || null,
    date: doc.createdAt ? doc.createdAt.slice(0, 10) : '',
  };
}

export interface ContractPayload {
  teacher?: string;
  title: string;
  partnerOrganization: string;
  contractDate: string;
  amount: number;
  currentYearAmount?: number;
  academicYear?: string;
  slotFiles: Partial<Record<ContractSlot, File>>;
}

const toMultipart = (v: ContractPayload) => {
  const entries = Object.entries(v.slotFiles).filter(([, f]) => !!f) as [
    ContractSlot,
    File,
  ][];
  return {
    teacher: v.teacher || undefined,
    title: v.title,
    partnerOrganization: v.partnerOrganization,
    contractDate: v.contractDate,
    amount: v.amount,
    currentYearAmount: v.currentYearAmount,
    academicYear: v.academicYear || undefined,
    files: entries.map(([, f]) => f),
    fileSlots: entries.length ? JSON.stringify(entries.map(([slot]) => slot)) : undefined,
  };
};

export function useContractsPaginate(
  page: number,
  limit: number,
  filters: ContractFilters,
) {
  return useQuery({
    queryKey: [KEY, { page, limit, ...filters }],
    queryFn: async () => {
      const res = await fetchPaginated<BackendContract>(`${ROOT}/paginate`, {
        page,
        limit,
        status: filters.status || undefined,
        department: filters.department || undefined,
        search: filters.search || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });
      return { ...res, docs: res.docs.map(mapContract) };
    },
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export async function fetchContractsForExport(
  filters: ContractFilters,
): Promise<EconomicContract[]> {
  const docs = await fetchList<BackendContract>(ROOT, {
    status: filters.status || undefined,
    department: filters.department || undefined,
    search: filters.search || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  });
  return docs.map(mapContract);
}

export function useContract(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'one', id],
    enabled: !!id,
    queryFn: async (): Promise<EconomicContract> => {
      const doc = await fetchOne<BackendContract>(`${ROOT}/${id}`);
      return mapContract(doc);
    },
    refetchOnWindowFocus: false,
  });
}

export function useCreateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: ContractPayload) => uploadMultipart(ROOT, 'POST', toMultipart(v)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string } & ContractPayload) => {
      const { id, ...rest } = v;
      return uploadMultipart(`${ROOT}/${id}`, 'PUT', toMultipart(rest));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useApproveContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => putJson(`${ROOT}/${id}/approve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useRejectContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; reason: string }) =>
      putJson(`${ROOT}/${v.id}/reject`, { reason: v.reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
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

export async function downloadContractArchive(
  id: string,
  teacherName?: string | null,
  contractDate?: string | null,
): Promise<void> {
  let res;
  try {
    res = await apiClient.get(`${ROOT}/${id}/archive`, { responseType: 'blob' });
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
  const base = [teacherName, contractDate].filter(Boolean).join(' ') || 'shartnoma';
  a.download = `${base.replace(/[\\/:*?"<>|]/g, ' ').trim()}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
