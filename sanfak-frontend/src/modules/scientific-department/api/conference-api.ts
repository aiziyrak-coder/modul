import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  deleteData,
  fetchList,
  fetchOne,
  fetchPaginated,
  postJson,
  putJson,
  uploadMultipart,
} from '@/shared/api';
import type {
  ConfDocSlot,
  ConfRequiredDoc,
  ConfUploadedDoc,
  Conference,
  ConferenceFilters,
  ConferenceType,
  KafedraStatus,
} from '../model/types';

const ROOT = '/conferences';
const KEY = 'sci-conferences';

interface BackendRef {
  _id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  title?: string;
}

interface BackendKafedra {
  department?: BackendRef | null;
  status: 'pending' | 'accepted';
  acceptedBy?: BackendRef | null;
  acceptedAt?: string | null;
  docs?: ConfUploadedDoc[];
  documents?: Partial<Record<ConfDocSlot, string>>;
}

interface BackendConference {
  _id: string;
  title: string;
  type: ConferenceType;
  description?: string;
  deadline?: string | null;
  beforeDeadline?: string | null;
  afterDeadline?: string | null;
  requiredDocs?: ConfRequiredDoc[];
  requiredInfo?: string[];
  status: 'active' | 'closed';
  kafedras?: BackendKafedra[];
  myKafedra?: BackendKafedra | null;
  createdBy?: BackendRef | null;
  createdAt?: string;
  acceptedByMe?: boolean;
}

const personName = (p?: BackendRef | null): string =>
  p ? [p.lastName, p.firstName].filter(Boolean).join(' ') : '';

const day = (d?: string | null): string | null => (d ? d.slice(0, 10) : null);

const mapKafedra = (k: BackendKafedra): KafedraStatus => ({
  departmentId: k.department?._id ?? null,
  departmentName: k.department?.title ?? null,
  status: k.status,
  acceptedByName: personName(k.acceptedBy) || null,
  acceptedAt: day(k.acceptedAt),
  docs: k.docs ?? [],
  documents: k.documents ?? {},
});

function mapConference(doc: BackendConference): Conference {
  return {
    id: doc._id,
    title: doc.title,
    type: doc.type,
    description: doc.description ?? '',
    deadline: day(doc.deadline),
    beforeDeadline: day(doc.beforeDeadline),
    afterDeadline: day(doc.afterDeadline),
    requiredDocs: doc.requiredDocs ?? [],
    requiredInfo: doc.requiredInfo ?? [],
    status: doc.status,
    kafedras: (doc.kafedras ?? []).map(mapKafedra),
    myKafedra: doc.myKafedra ? mapKafedra(doc.myKafedra) : null,
    createdByName: personName(doc.createdBy) || null,
    date: doc.createdAt ? doc.createdAt.slice(0, 10) : '',
    acceptedByMe: doc.acceptedByMe ?? false,
  };
}

export interface ConferencePayload {
  title: string;
  type: ConferenceType;
  description?: string;
  deadline: string;
  beforeDeadline?: string;
  afterDeadline?: string;
  requiredDocs: ConfRequiredDoc[];
  kafedras: string[];
}

export function useConferencesPaginate(
  page: number,
  limit: number,
  filters: ConferenceFilters,
) {
  return useQuery({
    queryKey: [KEY, { page, limit, ...filters }],
    queryFn: async () => {
      const res = await fetchPaginated<BackendConference>(`${ROOT}/paginate`, {
        page,
        limit,
        type: filters.type || undefined,
        status: filters.status || undefined,
        search: filters.search || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });
      return { ...res, docs: res.docs.map(mapConference) };
    },
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export async function fetchConferencesForExport(
  filters: ConferenceFilters,
): Promise<Conference[]> {
  const docs = await fetchList<BackendConference>(ROOT, {
    type: filters.type || undefined,
    status: filters.status || undefined,
    search: filters.search || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  });
  return docs.map(mapConference);
}

export function useConference(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'one', id],
    enabled: !!id,
    queryFn: async (): Promise<Conference> => {
      const doc = await fetchOne<BackendConference>(`${ROOT}/${id}`);
      return mapConference(doc);
    },
    refetchOnWindowFocus: false,
  });
}

export function useCreateConference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: ConferencePayload) => postJson(ROOT, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateConference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string } & ConferencePayload) => {
      const { id, ...rest } = v;
      return putJson(`${ROOT}/${id}`, rest);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useAcceptConference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; slotFiles: Record<string, File | undefined> }) => {
      const entries = Object.entries(v.slotFiles).filter(([, f]) => !!f) as [
        string,
        File,
      ][];
      return uploadMultipart(`${ROOT}/${v.id}/accept`, 'PUT', {
        files: entries.map(([, f]) => f),
        fileSlots: JSON.stringify(entries.map(([slot]) => slot)),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteConference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
