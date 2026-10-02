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
  uploadMultipart,
} from '@/shared/api';
import type { Startup, StartupFileSlot, StartupFilters } from '../model/types';

const ROOT = '/startups';
const KEY = 'sci-startups';

interface BackendRef {
  _id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  title?: string;
}

interface BackendStartup {
  _id: string;
  author?: BackendRef | null;
  department?: BackendRef | null;
  faculty?: BackendRef | null;
  type?: BackendRef | null;
  title: string;
  files?: Partial<Record<StartupFileSlot, string>> | null;
  createdAt?: string;
}

const personName = (p?: BackendRef | null): string =>
  p ? [p.lastName, p.firstName].filter(Boolean).join(' ') : '';

export function mapStartup(doc: BackendStartup): Startup {
  return {
    id: doc._id,
    authorName: personName(doc.author),
    typeId: doc.type?._id ?? null,
    typeName: doc.type?.name ?? '',
    title: doc.title,
    facultyName: doc.faculty?.title ?? null,
    departmentName: doc.department?.title ?? null,
    files: doc.files ?? {},
    date: doc.createdAt ? doc.createdAt.slice(0, 10) : '',
  };
}

export interface StartupPayload {
  type: string;
  title: string;
  files: Partial<Record<StartupFileSlot, File>>;
}

const toMultipart = (v: StartupPayload) => {
  const entries = Object.entries(v.files).filter(([, f]) => f) as [StartupFileSlot, File][];
  return {
    type: v.type,
    title: v.title,
    files: entries.map(([, f]) => f),
    fileSlots: entries.length ? JSON.stringify(entries.map(([slot]) => slot)) : undefined,
  };
};

export function useStartupsPaginate(page: number, limit: number, filters: StartupFilters) {
  return useQuery({
    queryKey: [KEY, { page, limit, ...filters }],
    queryFn: async () => {
      const res = await fetchPaginated<BackendStartup>(`${ROOT}/paginate`, {
        page,
        limit,
        search: filters.search || undefined,
        type: filters.type || undefined,
        faculty: filters.faculty || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });
      return { ...res, docs: res.docs.map(mapStartup) };
    },
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useStartup(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'one', id],
    enabled: !!id,
    queryFn: async (): Promise<Startup> => {
      const doc = await fetchOne<BackendStartup>(`${ROOT}/${id}`);
      return mapStartup(doc);
    },
    refetchOnWindowFocus: false,
  });
}

export async function fetchStartupsForExport(filters: StartupFilters): Promise<Startup[]> {
  const docs = await fetchList<BackendStartup>(ROOT, {
    search: filters.search || undefined,
    type: filters.type || undefined,
    faculty: filters.faculty || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  });
  return docs.map(mapStartup);
}

export async function downloadStartupArchive(
  id: string,
  authorName?: string | null,
  title?: string | null,
): Promise<void> {
  let res;
  try {
    res = await apiClient.get(`${ROOT}/${id}/archive`, { responseType: 'blob' });
  } catch (err) {
    const body = (err as { response?: { data?: unknown } })?.response?.data;
    if (body instanceof Blob) {
      const text = await body.text();
      try {
        const parsed = JSON.parse(text) as { message?: string };
        if (parsed.message) throw new Error(parsed.message);
      } catch {}
    }
    throw err;
  }

  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  const base = [authorName, title].filter(Boolean).join(' — ') || 'startap';
  a.download = `${base.replace(/[\\/:*?"<>|]/g, ' ').trim()}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function useCreateStartup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: StartupPayload) => uploadMultipart(ROOT, 'POST', toMultipart(v)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateStartup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string } & StartupPayload) => {
      const { id, ...rest } = v;
      return uploadMultipart(`${ROOT}/${id}`, 'PUT', toMultipart(rest));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteStartup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
