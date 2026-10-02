import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteData,
  fetchList,
  fetchOne,
  fetchPaginated,
  patchJson,
  postJson,
  putJson,
  uploadMultipart,
  type Paginated,
} from '@/shared/api';
import type {
  WorkInput,
  ReviewInput,
  DecisionInput,
  MemberDecisionInput,
  MemberFormInput,
  SeminarResult,
  SpecialtyInput,
  CouncilNumberInput,
  WorkDocumentTypeInput,
} from '../model/types';
import {
  mapWork,
  mapMember,
  mapReview,
  workInputToBackend,
  memberInputToBackend,
  reviewInputToBackend,
  decisionInputToBackend,
  mapSpecialty,
  mapCouncilNumber,
  mapApplicationTemplate,
  mapWorkDocumentType,
  type BackendWork,
  type BackendMember,
  type BackendReview,
  type BackendSpecialty,
  type BackendCouncilNumber,
  type BackendApplicationTemplate,
  type BackendWorkDocumentType,
} from './mapper';

const KEY = 'science-council';
const ROOT = '/scientific-council';

export interface WorksFilter {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  year?: string;
  [key: string]: unknown;
}

export function useWorksPaginated(filter: WorksFilter) {
  return useQuery({
    queryKey: [KEY, 'paginate', filter],
    queryFn: async () => {
      const res: Paginated<BackendWork> = await fetchPaginated(`${ROOT}/works/paginate`, filter);
      return {
        items: res.docs.map(mapWork),
        meta: { page: res.page, limit: res.limit, total: res.totalDocs, totalPages: res.totalPages },
      };
    },
  });
}

export interface AllWorksFilter {
  search?: string;
  status?: string;
  year?: string;
  step?: string;
  specialty?: string;
  councilNumber?: string;
  [key: string]: unknown;
}

export function allWorksQuery(filter?: AllWorksFilter) {
  return {
    queryKey: [KEY, 'all', filter ?? null],
    queryFn: async () => {
      const docs = await fetchList<BackendWork>(`${ROOT}/works`, filter);
      return docs.map(mapWork);
    },
  };
}

export function useAllWorks(filter?: AllWorksFilter) {
  return useQuery(allWorksQuery(filter));
}

export function useMyWorks() {
  return useQuery({
    queryKey: [KEY, 'my-works'],
    queryFn: async () => {
      const docs = await fetchList<BackendWork>(`${ROOT}/works/my`);
      return docs.map(mapWork);
    },
  });
}

export function useSeminarWorks(
  status?: string,
  year?: string,
  specialty?: string,
  councilNumber?: string,
) {
  return useQuery({
    queryKey: [KEY, 'seminars', status ?? null, year ?? null, specialty ?? null, councilNumber ?? null],
    queryFn: async () => {
      const docs = await fetchList<BackendWork>(`${ROOT}/works`, {
        step: 'seminars',
        status,
        year,
        specialty,
        councilNumber,
      });
      return docs.map(mapWork);
    },
  });
}

export function useUpdateSeminarResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; seminarResult: SeminarResult | null }) =>
      patchJson<{ message: string; seminarResult: SeminarResult | null }>(
        `${ROOT}/works/${input.id}/seminar-result`,
        { seminarResult: input.seminarResult },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateSeminarDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; seminarDate: string | null }) =>
      patchJson<{ message: string; seminarDate: string | null }>(
        `${ROOT}/works/${input.id}/seminar-date`,
        { seminarDate: input.seminarDate },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDefenseWorks(
  defenseResult?: string,
  year?: string,
  specialty?: string,
  councilNumber?: string,
) {
  return useQuery({
    queryKey: [KEY, 'defenses', defenseResult ?? null, year ?? null, specialty ?? null, councilNumber ?? null],
    queryFn: async () => {
      const docs = await fetchList<BackendWork>(`${ROOT}/works`, {
        step: 'defenses',
        defenseResult,
        year,
        specialty,
        councilNumber,
      });
      return docs.map(mapWork);
    },
  });
}

export function useUpdateDefenseDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; defenseDate: string | null }) =>
      patchJson<{ message: string; defenseDate: string | null }>(
        `${ROOT}/works/${input.id}/defense-date`,
        { defenseDate: input.defenseDate },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateDefenseResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; defenseResult: SeminarResult | null }) =>
      patchJson<{ message: string; defenseResult: SeminarResult | null }>(
        `${ROOT}/works/${input.id}/defense-result`,
        { defenseResult: input.defenseResult },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function workDetailQuery(id: string) {
  return {
    queryKey: [KEY, 'detail', id],
    queryFn: async () => {
      const b = await fetchOne<BackendWork>(`${ROOT}/works/${id}`);
      const reviews = await fetchList<BackendReview>(`${ROOT}/reviews/work/${id}`).catch(() => []);
      return { ...mapWork(b), reviews: reviews.map(mapReview) };
    },
  };
}

export function useWork(id: string | undefined) {
  return useQuery({
    ...workDetailQuery(id as string),
    enabled: !!id,
  });
}

export function useAssignedWorks(memberId: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'assigned', memberId],
    queryFn: async () => {
      const docs = await fetchList<BackendWork>(`${ROOT}/works`, { memberId });
      return docs.map(mapWork);
    },
    enabled: !!memberId,
  });
}

export function useCreateWork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<WorkInput>) =>
      postJson<{ _id: string; message: string }>(`${ROOT}/works`, workInputToBackend(input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateWork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; data: Partial<WorkInput> }) =>
      putJson<{ message: string }>(`${ROOT}/works/${input.id}`, workInputToBackend(input.data)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteWork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/works/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useChangeStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; status: string; reason?: string; revisionDocs?: string[] }) =>
      putJson<{ message: string }>(`${ROOT}/works/${input.id}/status`, {
        status: input.status,
        reason: input.reason,
        revisionDocs: input.revisionDocs,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useAcceptApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; memberIds: string[] }) =>
      patchJson<{ message: string; status: string }>(`${ROOT}/works/${input.id}/accept`, {
        memberIds: input.memberIds,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useWorkReviews(workId: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'reviews', workId],
    queryFn: async () => {
      const reviews = await fetchList<BackendReview>(`${ROOT}/reviews/work/${workId}`);
      return reviews.map(mapReview);
    },
    enabled: !!workId,
  });
}

export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReviewInput) =>
      postJson<{ _id: string; message: string }>(`${ROOT}/reviews`, reviewInputToBackend(input)),
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: [KEY, 'detail', input.workId] });
      qc.invalidateQueries({ queryKey: [KEY, 'reviews', input.workId] });
    },
  });
}

export function useUpdateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { reviewId: string; type: string; text: string }) =>
      putJson<{ message: string }>(`${ROOT}/reviews/${input.reviewId}`, { type: input.type, text: input.text }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useGenerateProtocol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { workId: string; conclusion: string; intro?: string }) =>
      postJson<{ message: string }>(`${ROOT}/works/${input.workId}/protocol`, {
        conclusion: input.conclusion,
        intro: input.intro,
      }),
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: [KEY, 'detail', input.workId] });
    },
  });
}

export function useSignProtocol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workId: string) =>
      postJson<{ message: string }>(`${ROOT}/works/${workId}/protocol/sign`, {}),
    onSuccess: (_d, workId) => {
      qc.invalidateQueries({ queryKey: [KEY, 'detail', workId] });
      qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useMakeDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DecisionInput) =>
      postJson<{ message: string }>(`${ROOT}/works/${input.workId}/decision`, decisionInputToBackend(input)),
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: [KEY, 'detail', input.workId] });
      qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useMemberDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MemberDecisionInput) =>
      postJson<{ message: string }>(`${ROOT}/works/${input.workId}/member-decision`, decisionInputToBackend(input)),
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: [KEY, 'detail', input.workId] });
      qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useCouncilMembers(
  all = false,
  filter?: { specialty?: string; councilNumber?: string },
) {
  const specialty = filter?.specialty;
  const councilNumber = filter?.councilNumber;
  return useQuery({
    queryKey: [KEY, 'members', all ? 'all' : 'active', specialty ?? null, councilNumber ?? null],
    queryFn: async () => {
      const docs = await fetchList<BackendMember>(`${ROOT}/members`, {
        ...(all ? { all: true } : {}),
        specialty,
        councilNumber,
      });
      return docs.map(mapMember);
    },
  });
}

export function useCreateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MemberFormInput) =>
      postJson<{ _id: string; message: string }>(`${ROOT}/members`, memberInputToBackend(data)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'members'] }),
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; data: MemberFormInput }) =>
      putJson<{ message: string }>(
        `${ROOT}/members/${input.id}`,
        memberInputToBackend(input.data, { isCreate: false }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'members'] }),
  });
}

export function useDeleteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/members/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'members'] }),
  });
}

export function useUpdateDocAssignments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { workId: string; assignments: Record<string, string[]> }) =>
      putJson<{ message: string }>(`${ROOT}/works/${input.workId}/assignments`, {
        assignments: input.assignments,
      }),
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: [KEY, 'detail', input.workId] });
    },
  });
}

export function useUpdateCouncilMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { workId: string; memberIds: string[] }) =>
      patchJson<{ message: string }>(`${ROOT}/works/${input.workId}/members`, {
        memberIds: input.memberIds,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUploadWorkFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { workId: string; file: File }) =>
      uploadMultipart<{ message: string }>(`${ROOT}/works/${input.workId}/work-file`, 'POST', {
        file: input.file,
      }),
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: [KEY, 'detail', input.workId] });
      qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { workId: string; docKey: string; fileName: string }) =>
      postJson<{ message: string }>(`${ROOT}/works/${input.workId}/documents`, {
        docKey: input.docKey,
        fileName: input.fileName,
      }),
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: [KEY, 'detail', input.workId] });
    },
  });
}

const REFS = `${ROOT}/refs`;

interface BackendRefDoc { _id: string; title: string }
interface BackendUserDoc {
  _id: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  fullName?: string;
  department?: string | { _id: string; title?: string };
  division?: string | { _id: string; title?: string };
  position?: string | { _id: string; title?: string };
}

export interface RefOption { id: string; title: string }
export interface StaffOption { id: string; name: string; position: string; departmentId: string; divisionId: string }

function refId(v?: string | { _id: string }): string {
  if (!v) return '';
  return typeof v === 'string' ? v : v._id;
}

function refTitle(v?: string | { _id: string; title?: string }): string {
  if (!v || typeof v === 'string') return '';
  return v.title ?? '';
}

export function useAcademicTitlesRef() {
  return useQuery({
    queryKey: [KEY, 'ref', 'academic-titles'],
    queryFn: async () => {
      const docs = await fetchList<BackendRefDoc>(`${REFS}/academic-titles`);
      return docs.map((d): RefOption => ({ id: d._id, title: d.title }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAcademicLevelsRef() {
  return useQuery({
    queryKey: [KEY, 'ref', 'academic-levels'],
    queryFn: async () => {
      const docs = await fetchList<BackendRefDoc>(`${REFS}/academic-levels`);
      return docs.map((d): RefOption => ({ id: d._id, title: d.title }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useFacultiesRef() {
  return useQuery({
    queryKey: [KEY, 'ref', 'faculties'],
    queryFn: async () => {
      const docs = await fetchList<BackendRefDoc>(`${REFS}/faculties`);
      return docs.map((d): RefOption => ({ id: d._id, title: d.title }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useDepartmentsRef(facultyId?: string) {
  return useQuery({
    queryKey: [KEY, 'ref', 'departments', facultyId],
    queryFn: async () => {
      const docs = await fetchList<BackendRefDoc>(`${REFS}/departments`, { faculty: facultyId });
      return docs.map((d): RefOption => ({ id: d._id, title: d.title }));
    },
    enabled: !!facultyId,
    staleTime: 5 * 60 * 1000,
  });
}

export interface DeptRefOption { id: string; title: string; facultyId: string }

export function useAllDepartmentsRef() {
  return useQuery({
    queryKey: [KEY, 'ref', 'departments', 'all'],
    queryFn: async () => {
      const docs = await fetchList<BackendRefDoc & { faculty?: string }>(`${REFS}/departments`);
      return docs.map((d): DeptRefOption => ({ id: d._id, title: d.title, facultyId: d.faculty ?? '' }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useDivisionsRef() {
  return useQuery({
    queryKey: [KEY, 'ref', 'divisions'],
    queryFn: async () => {
      const docs = await fetchList<BackendRefDoc>(`${REFS}/divisions`);
      return docs.map((d): RefOption => ({ id: d._id, title: d.title }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAllStaff() {
  return useQuery({
    queryKey: [KEY, 'ref', 'staff'],
    queryFn: async () => {
      const docs = await fetchList<BackendUserDoc>(`${REFS}/staff`);
      return docs.map((u): StaffOption => ({
        id: u._id,
        name: u.fullName ?? [u.lastName, u.firstName, u.middleName].filter(Boolean).join(' '),
        position: refTitle(u.position),
        departmentId: refId(u.department),
        divisionId: refId(u.division),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

const SPECIALTY_KEY = [KEY, 'specialties'] as const;
const NUMBER_KEY = [KEY, 'council-numbers'] as const;
const DOC_TYPE_KEY = [KEY, 'work-document-types'] as const;
const TEMPLATE_KEY = [KEY, 'application-template'] as const;

export interface SpecialtyListOpts {
  all?: boolean;
  search?: string;
  free?: boolean;
  exceptNumber?: string;
}

export function useSpecialties(opts: SpecialtyListOpts = {}) {
  return useQuery({
    queryKey: [...SPECIALTY_KEY, opts],
    queryFn: async () => {
      const list = await fetchList<BackendSpecialty>(`${ROOT}/specialties`, {
        ...(opts.all ? { all: true } : {}),
        ...(opts.search ? { search: opts.search } : {}),
        ...(opts.free ? { free: true } : {}),
        ...(opts.exceptNumber ? { exceptNumber: opts.exceptNumber } : {}),
      });
      return list.map(mapSpecialty);
    },
  });
}

export function useCreateSpecialty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SpecialtyInput) =>
      postJson<{ _id: string }>(`${ROOT}/specialties`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SPECIALTY_KEY });
    },
  });
}

export function useUpdateSpecialty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<SpecialtyInput> }) =>
      putJson<{ message: string }>(`${ROOT}/specialties/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SPECIALTY_KEY });
      qc.invalidateQueries({ queryKey: NUMBER_KEY });
    },
  });
}

export function useDeleteSpecialty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/specialties/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SPECIALTY_KEY });
      qc.invalidateQueries({ queryKey: NUMBER_KEY });
    },
  });
}

export interface WorkDocTypeListOpts {
  all?: boolean;
  search?: string;
}

export function useWorkDocumentTypes(opts: WorkDocTypeListOpts = {}) {
  return useQuery({
    queryKey: [...DOC_TYPE_KEY, opts],
    queryFn: async () => {
      const list = await fetchList<BackendWorkDocumentType>(`${ROOT}/work-document-types`, {
        ...(opts.all ? { all: true } : {}),
        ...(opts.search ? { search: opts.search } : {}),
      });
      return list.map(mapWorkDocumentType);
    },
  });
}

export function useCreateWorkDocumentType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: WorkDocumentTypeInput) =>
      postJson<{ _id: string }>(`${ROOT}/work-document-types`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DOC_TYPE_KEY });
    },
  });
}

export function useUpdateWorkDocumentType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<WorkDocumentTypeInput> }) =>
      putJson<{ message: string }>(`${ROOT}/work-document-types/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DOC_TYPE_KEY });
    },
  });
}

export function useDeleteWorkDocumentType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/work-document-types/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DOC_TYPE_KEY });
    },
  });
}

export function useCouncilNumbers(opts: { all?: boolean; search?: string } = {}) {
  return useQuery({
    queryKey: [...NUMBER_KEY, opts],
    queryFn: async () => {
      const list = await fetchList<BackendCouncilNumber>(`${ROOT}/council-numbers`, {
        ...(opts.all ? { all: true } : {}),
        ...(opts.search ? { search: opts.search } : {}),
      });
      return list.map(mapCouncilNumber);
    },
  });
}

export function useCreateCouncilNumber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CouncilNumberInput) =>
      postJson<{ _id: string }>(`${ROOT}/council-numbers`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NUMBER_KEY });
      qc.invalidateQueries({ queryKey: SPECIALTY_KEY });
    },
  });
}

export function useUpdateCouncilNumber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<CouncilNumberInput> }) =>
      putJson<{ message: string }>(`${ROOT}/council-numbers/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NUMBER_KEY });
      qc.invalidateQueries({ queryKey: SPECIALTY_KEY });
    },
  });
}

export function useDeleteCouncilNumber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/council-numbers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NUMBER_KEY });
      qc.invalidateQueries({ queryKey: SPECIALTY_KEY });
    },
  });
}

export function useApplicationTemplate() {
  return useQuery({
    queryKey: TEMPLATE_KEY,
    queryFn: async () => {
      const doc = await fetchOne<BackendApplicationTemplate | null>(
        `${ROOT}/application-template`,
      );
      return mapApplicationTemplate(doc);
    },
  });
}

export function useUploadApplicationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) =>
      uploadMultipart<{ message: string }>(`${ROOT}/application-template`, 'POST', {
        file,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TEMPLATE_KEY });
    },
  });
}

export function useDeleteApplicationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deleteData(`${ROOT}/application-template`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TEMPLATE_KEY });
    },
  });
}
