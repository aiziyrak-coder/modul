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
  putJson,
  uploadMultipart,
} from '@/shared/api';
import type {
  ApplicantDocSlot,
  ApplicantFilters,
  ApplicantStatus,
  QualifyingApplicant,
  ResearcherType,
} from '../model/types';

const ROOT = '/qualifying-applicants';
const KEY = 'sci-applicant';

interface BackendRef {
  _id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  title?: string;
}

interface BackendApplicant {
  _id: string;
  name: string;
  source?: 'internal' | 'public';
  researcherType: ResearcherType;
  course?: number | null;
  specialization: string;
  university: string;
  phone: string;
  documents?: Partial<Record<ApplicantDocSlot, string>>;
  status: ApplicantStatus;
  examDate?: string | null;
  certificateFileUrl?: string;
  rejectionReason?: string;
  addedBy?: BackendRef | null;
  department?: BackendRef | null;
  faculty?: BackendRef | null;
  reviewedBy?: BackendRef | null;
  resultBy?: BackendRef | null;
  createdAt?: string;
}

const personName = (p?: BackendRef | null): string =>
  p ? [p.lastName, p.firstName].filter(Boolean).join(' ') : '';

const day = (d?: string | null): string | null => (d ? d.slice(0, 10) : null);

function mapApplicant(doc: BackendApplicant): QualifyingApplicant {
  return {
    id: doc._id,
    name: doc.name,
    source: doc.source === 'public' ? 'public' : 'internal',
    researcherType: doc.researcherType,
    course: doc.course ?? null,
    specialization: doc.specialization,
    university: doc.university,
    phone: doc.phone,
    documents: doc.documents ?? {},
    status: doc.status,
    examDate: day(doc.examDate),
    certificateFileUrl: doc.certificateFileUrl ?? '',
    rejectionReason: doc.rejectionReason ?? '',
    addedById: doc.addedBy?._id ?? null,
    addedByName: personName(doc.addedBy),
    departmentName: doc.department?.title ?? null,
    facultyName: doc.faculty?.title ?? null,
    reviewedByName: personName(doc.reviewedBy),
    resultByName: personName(doc.resultBy),
    date: day(doc.createdAt) ?? '',
  };
}

export interface ApplicantPayload {
  name: string;
  course?: number | null;
  specialization: string;
  university: string;
  phone: string;
  slotFiles: Partial<Record<ApplicantDocSlot, File>>;
}

type MultipartFields = Record<
  string,
  string | number | boolean | File | File[] | null | undefined
>;

const toMultipart = (v: ApplicantPayload): MultipartFields => {
  const entries = Object.entries(v.slotFiles).filter(([, f]) => !!f) as [
    ApplicantDocSlot,
    File,
  ][];
  const fields: MultipartFields = {
    name: v.name,
    specialization: v.specialization,
    university: v.university,
    phone: v.phone,
    files: entries.map(([, f]) => f),
    fileSlots: JSON.stringify(entries.map(([slot]) => slot)),
  };
  if (v.course != null) fields.course = v.course;
  return fields;
};

export function useApplicantsPaginate(
  page: number,
  limit: number,
  filters: ApplicantFilters,
) {
  return useQuery({
    queryKey: [KEY, { page, limit, ...filters }],
    queryFn: async () => {
      const res = await fetchPaginated<BackendApplicant>(`${ROOT}/paginate`, {
        page,
        limit,
        status: filters.status || undefined,
        specialization: filters.specialization || undefined,
        course: filters.course || undefined,
        examDate: filters.examDate || undefined,
        search: filters.search || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });
      return { ...res, docs: res.docs.map(mapApplicant) };
    },
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export async function fetchApplicantsForExport(
  filters: ApplicantFilters,
): Promise<QualifyingApplicant[]> {
  const docs = await fetchList<BackendApplicant>(ROOT, {
    status: filters.status || undefined,
    specialization: filters.specialization || undefined,
    course: filters.course || undefined,
    examDate: filters.examDate || undefined,
    search: filters.search || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  });
  return docs.map(mapApplicant);
}

export function useApplicant(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'one', id],
    enabled: !!id,
    queryFn: async () => mapApplicant(await fetchOne<BackendApplicant>(`${ROOT}/${id}`)),
  });
}

export function useCreateApplicant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: ApplicantPayload) => uploadMultipart(ROOT, 'POST', toMultipart(v)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateApplicant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string } & ApplicantPayload) =>
      uploadMultipart(`${ROOT}/${v.id}`, 'PUT', toMultipart(v)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useResubmitApplicant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string } & ApplicantPayload) =>
      uploadMultipart(`${ROOT}/${v.id}/resubmit`, 'PUT', toMultipart(v)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useApproveApplicant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => putJson(`${ROOT}/${id}/approve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useRejectApplicant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; reason: string }) =>
      putJson(`${ROOT}/${v.id}/reject`, { reason: v.reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useSetExamDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { ids: string[]; examDate: string }) =>
      putJson(`${ROOT}/exam-date`, { ids: v.ids, examDate: v.examDate }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useSetResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; result: 'passed' | 'failed'; certificate?: File | null }) => {
      const fields: MultipartFields = { result: v.result };
      if (v.result === 'passed' && v.certificate) {
        fields.files = [v.certificate];
        fields.fileSlots = JSON.stringify(['certificate']);
      }
      return uploadMultipart(`${ROOT}/${v.id}/result`, 'PUT', fields);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteApplicant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
