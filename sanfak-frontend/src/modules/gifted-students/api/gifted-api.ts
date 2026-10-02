import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteData, fetchList, fetchOne, postJson, putJson, apiClient, uploadMultipart } from '@/shared/api';
import type { Criterion, StudentRecord, Activity, DocumentType, Scholarship, ScholarshipApplication, Message } from '../data/types';
import { nameOf } from './user-name';
import {
  mapCriterion,
  mapStudent,
  mapDocType,
  mapAchievement,
  mapScholarship,
  mapApplication,
  toCriterionPayload,
  toStudentPayload,
  toDocTypePayload,
  toAchievementForm,
  type AchievementFormInput,
  toScholarshipPayload,
  toApplyPayload,
  toScorePayload,
  mapChatMessage,
  mapAdvisor,
  type BackendCriterion,
  type BackendStudent,
  type BackendAdvisor,
  type AdvisorDetail,
  type BackendDocType,
  type BackendAchievement,
  type BackendScholarship,
  type BackendApplication,
  type ApplyInput,
  type BackendChatMessage,
} from './mapper';
import { criteriaMock, studentMock, achievementMock, docTypeMock, scholarshipMock, scholarshipApplicationMock } from './mock-store';
import { fetchAllPages, LIST_PAGE_LIMIT, type PaginateEnvelope } from './paginate';
import {
  toAcademicYearOptions,
  toCourseOptions,
  toFacultyOptions,
  toDirectionOptions,
  toGroupOptions,
  toDepartmentOptions,
  type RefOption,
  type AcademicYearOption,
  type CourseOption,
  type DirectionOption,
  type GroupOption,
  type DepartmentOption,
  type BackendRefRow,
  type BackendChildRefRow,
  type BackendGroupRow,
} from './reference-options';

const USE_MOCK = false;

const CRITERIA_KEY = 'gifted-criteria';
const CRITERIA_ROOT = '/evaluation-criterias/criteria';

export function useCriteria() {
  return useQuery({
    queryKey: [CRITERIA_KEY],
    queryFn: async (): Promise<Criterion[]> =>
      USE_MOCK
        ? criteriaMock.list()
        : (await fetchList<BackendCriterion>(CRITERIA_ROOT)).map(mapCriterion),
  });
}

export function useCreateCriterion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (c: Partial<Criterion>) =>
      USE_MOCK ? criteriaMock.create(c) : postJson(CRITERIA_ROOT, toCriterionPayload(c)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [CRITERIA_KEY] }),
  });
}

export function useUpdateCriterion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Criterion> }) =>
      USE_MOCK
        ? criteriaMock.update(id, data)
        : putJson(`${CRITERIA_ROOT}/${id}`, toCriterionPayload(data)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [CRITERIA_KEY] }),
  });
}

export function useDeleteCriterion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      USE_MOCK ? criteriaMock.remove(id) : deleteData(`${CRITERIA_ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [CRITERIA_KEY] }),
  });
}

const STUDENT_KEY = 'gifted-students-list';
const STUDENT_ROOT = '/gifted-students/students';

export interface StudentListFilters {
  search?: string;
  faculty?: string;
  course?: string;
  academicYear?: string;
}

function studentListQuery(filters: StudentListFilters): Record<string, string> {
  const q: Record<string, string> = {};
  (['search', 'faculty', 'course', 'academicYear'] as const).forEach((key) => {
    const value = filters[key];
    if (value && value !== 'all') q[key] = value;
  });
  return q;
}

export function useStudents(enabled = true, filters: StudentListFilters = {}) {
  const params = studentListQuery(filters);
  return useQuery({
    queryKey: [STUDENT_KEY, params],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<StudentRecord[]> =>
      USE_MOCK
        ? studentMock.list()
        : (await fetchList<BackendStudent>(STUDENT_ROOT, params)).map(mapStudent),
  });
}

export function useMyAdvisees(enabled = true) {
  return useQuery({
    queryKey: [STUDENT_KEY, 'advisees'],
    enabled,
    queryFn: async (): Promise<StudentRecord[]> =>
      USE_MOCK
        ? studentMock.list()
        : (await fetchList<BackendStudent>(`${STUDENT_ROOT}/my-advisees`)).map(mapStudent),
  });
}

export function useStudent(id: string | undefined) {
  return useQuery({
    queryKey: [STUDENT_KEY, id],
    queryFn: async (): Promise<StudentRecord> =>
      USE_MOCK
        ? studentMock.getOne(id as string)
        : mapStudent(await fetchOne<BackendStudent>(`${STUDENT_ROOT}/${id}`)),
    enabled: !!id,
  });
}

export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: Partial<StudentRecord>) =>
      USE_MOCK ? studentMock.create(s) : postJson(STUDENT_ROOT, toStudentPayload(s)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [STUDENT_KEY] }),
  });
}

export function useUpdateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<StudentRecord> }) =>
      USE_MOCK ? studentMock.update(id, data) : putJson(`${STUDENT_ROOT}/${id}`, toStudentPayload(data)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [STUDENT_KEY] }),
  });
}

export function useDeleteStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => (USE_MOCK ? studentMock.remove(id) : deleteData(`${STUDENT_ROOT}/${id}`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [STUDENT_KEY] }),
  });
}

export async function fetchRankingXlsx(query: Record<string, string>): Promise<Blob> {
  const qs = new URLSearchParams(query).toString();
  const res = await apiClient.get(`${STUDENT_ROOT}/export${qs ? `?${qs}` : ''}`, {
    responseType: 'blob',
  });
  return res.data as Blob;
}

export type ImportStudentStatus = 'created' | 'existing' | 'linked';
export type ImportAccountStatus = 'created' | 'existing' | 'skipped';

export interface ImportRowOk {
  row: number;
  fullName: string;
  jshshir: string | null;
  student: ImportStudentStatus;
  account: ImportAccountStatus;
  id?: string;
  warnings?: string[];
}

export interface ImportRowFailed {
  row: number;
  fullName: string;
  jshshir: string | null;
  status: 'failed';
  errors: string[];
}

export type ImportRow = ImportRowOk | ImportRowFailed;

export const isFailedRow = (r: ImportRow): r is ImportRowFailed =>
  (r as ImportRowFailed).status === 'failed';

export interface ImportReport {
  dryRun: boolean;
  total: number;
  student: Record<ImportStudentStatus | 'failed', number>;
  account: Record<ImportAccountStatus, number>;
  columns: { recognized: string[]; ignored: Array<{ header: string; reason: string }> };
  rows: ImportRow[];
}

export async function importRoster(file: File, dryRun: boolean): Promise<ImportReport> {
  return uploadMultipart<ImportReport>(
    `${STUDENT_ROOT}/import?dryRun=${dryRun ? 'true' : 'false'}`,
    'POST',
    { file },
  );
}

export async function fetchImportTemplate(sample = false): Promise<Blob> {
  const res = await apiClient.get(`${STUDENT_ROOT}/import-template`, {
    params: sample ? { sample: true } : undefined,
    responseType: 'blob',
  });
  return res.data as Blob;
}

const DOCTYPE_KEY = 'gifted-doctypes';
const DOCTYPE_ROOT = '/document-types';

export function useDocumentTypes() {
  return useQuery({
    queryKey: [DOCTYPE_KEY],
    queryFn: async (): Promise<DocumentType[]> =>
      USE_MOCK ? docTypeMock.list() : (await fetchList<BackendDocType>(DOCTYPE_ROOT)).map(mapDocType),
  });
}
export function useCreateDocType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: Partial<DocumentType>) =>
      USE_MOCK ? docTypeMock.create(d) : postJson(DOCTYPE_ROOT, toDocTypePayload(d)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [DOCTYPE_KEY] }),
  });
}
export function useUpdateDocType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DocumentType> }) =>
      USE_MOCK ? docTypeMock.update(id, data) : putJson(`${DOCTYPE_ROOT}/${id}`, toDocTypePayload(data)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [DOCTYPE_KEY] }),
  });
}
export function useDeleteDocType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => (USE_MOCK ? docTypeMock.remove(id) : deleteData(`${DOCTYPE_ROOT}/${id}`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [DOCTYPE_KEY] }),
  });
}

const ACH_KEY = 'gifted-achievements';
const ACH_ROOT = '/student-achievements/achievements';

export function useAchievements() {
  return useQuery({
    queryKey: [ACH_KEY, 'all'],
    queryFn: async (): Promise<Activity[]> =>
      USE_MOCK ? achievementMock.all() : (await fetchList<BackendAchievement>(ACH_ROOT)).map(mapAchievement),
  });
}
export function useMyAchievements() {
  return useQuery({
    queryKey: [ACH_KEY, 'my'],
    queryFn: async (): Promise<Activity[]> =>
      USE_MOCK ? achievementMock.my() : (await fetchList<BackendAchievement>(`${ACH_ROOT}/my`)).map(mapAchievement),
  });
}
export function useStudentAchievements(studentId: string | undefined) {
  return useQuery({
    queryKey: [ACH_KEY, 'student', studentId],
    queryFn: async (): Promise<Activity[]> =>
      USE_MOCK
        ? achievementMock.byStudent(studentId as string)
        : (await fetchList<BackendAchievement>(`${ACH_ROOT}/_shared/student/${studentId}`)).map(mapAchievement),
    enabled: !!studentId,
  });
}
export function useCreateMyAchievement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: AchievementFormInput) =>
      USE_MOCK ? achievementMock.create(a) : uploadMultipart(`${ACH_ROOT}/my`, 'POST', toAchievementForm(a)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ACH_KEY] }),
  });
}
export function useUpdateAchievement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AchievementFormInput }) =>
      USE_MOCK ? achievementMock.update(id, data) : uploadMultipart(`${ACH_ROOT}/my/${id}`, 'PUT', toAchievementForm(data)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ACH_KEY] }),
  });
}
export function useReviewAchievement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: {
      id: string; status: 'approved' | 'rejected'; reviewNote?: string; score?: number;
      scoreCriteria?: string; scoreCategoryId?: string; scoreLabel?: string;
    }) =>
      USE_MOCK
        ? achievementMock.review(p.id, p.status, p.reviewNote)
        : putJson(`${ACH_ROOT}/${p.id}/review`, {
            status: p.status, reviewNote: p.reviewNote, score: p.score,
            scoreCriteria: p.scoreCriteria, scoreCategoryId: p.scoreCategoryId, scoreLabel: p.scoreLabel,
          }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ACH_KEY] }),
  });
}
export function useDeleteAchievement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => (USE_MOCK ? achievementMock.remove(id) : deleteData(`${ACH_ROOT}/${id}`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ACH_KEY] }),
  });
}

const SCH_KEY = 'gifted-scholarships';
const SCH_ROOT = '/scholarships';

export function useScholarships(type?: 'nomdor' | 'rektor') {
  return useQuery({
    queryKey: [SCH_KEY, type ?? 'all'],
    queryFn: async (): Promise<Scholarship[]> => {
      if (USE_MOCK) return scholarshipMock.list(type);
      return (
        await fetchList<BackendScholarship>(SCH_ROOT, type ? { type } : undefined)
      ).map(mapScholarship);
    },
  });
}
export function useScholarship(id: string | undefined) {
  return useQuery({
    queryKey: [SCH_KEY, 'one', id],
    queryFn: async (): Promise<Scholarship> =>
      USE_MOCK
        ? scholarshipMock.getOne(id as string)
        : mapScholarship(await fetchOne<BackendScholarship>(`${SCH_ROOT}/${id}`)),
    enabled: !!id,
  });
}
export function useCreateScholarship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: Partial<Scholarship>) =>
      USE_MOCK ? scholarshipMock.create(s) : postJson(SCH_ROOT, toScholarshipPayload(s)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SCH_KEY] }),
  });
}
export function useUpdateScholarship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Scholarship> }) =>
      USE_MOCK ? scholarshipMock.update(id, data) : putJson(`${SCH_ROOT}/${id}`, toScholarshipPayload(data)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SCH_KEY] }),
  });
}
export interface ScholarshipApplicant {
  id: string;
  name: string;
  faculty: string;
  direction: string;
  course: number;
  group: string;
  appliedAt: string;
}
export function useScholarshipApplicants(id: string | undefined) {
  return useQuery({
    queryKey: [SCH_KEY, 'applicants', id],
    enabled: !!id,
    queryFn: async (): Promise<ScholarshipApplicant[]> =>
      (
        await fetchList<{
          _id: string;
          fullName?: string;
          faculty?: string;
          direction?: string;
          course?: number;
          group?: string;
          appliedAt?: string;
        }>(`${SCH_ROOT}/${id}/applicants`)
      ).map((a) => ({
        id: a._id,
        name: a.fullName ?? '',
        faculty: a.faculty ?? '',
        direction: a.direction ?? '',
        course: a.course ?? 0,
        group: a.group ?? '',
        appliedAt: (a.appliedAt ?? '').split('T')[0] ?? '',
      })),
  });
}

export function useDeleteScholarship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => (USE_MOCK ? scholarshipMock.remove(id) : deleteData(`${SCH_ROOT}/${id}`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SCH_KEY] }),
  });
}

const APP_KEY = 'gifted-applications';
const APP_ROOT = '/scholarship-applications';

export function useMyApplications(enabled = true) {
  return useQuery({
    queryKey: [APP_KEY, 'my'],
    enabled,
    queryFn: async (): Promise<ScholarshipApplication[]> =>
      USE_MOCK
        ? scholarshipApplicationMock.my()
        : (await fetchList<BackendApplication>(`${APP_ROOT}/my`)).map(mapApplication),
  });
}
export function useApplications(enabled = true) {
  return useQuery({
    queryKey: [APP_KEY, 'all'],
    enabled,
    queryFn: async (): Promise<ScholarshipApplication[]> => {
      if (USE_MOCK) return scholarshipApplicationMock.all();
      const docs = await fetchAllPages<BackendApplication>((page) =>
        fetchOne<PaginateEnvelope<BackendApplication>>(
          `${APP_ROOT}?page=${page}&limit=${LIST_PAGE_LIMIT}`,
        ),
      );
      return docs.map(mapApplication);
    },
  });
}
export function useStudentApplications(studentId: string | undefined) {
  return useQuery({
    queryKey: [APP_KEY, 'by-student', studentId],
    enabled: !!studentId,
    queryFn: async (): Promise<ScholarshipApplication[]> =>
      USE_MOCK
        ? scholarshipApplicationMock.all()
        : (await fetchList<BackendApplication>(`${APP_ROOT}/by-student/${studentId}`)).map(mapApplication),
  });
}
export function useApplyScholarship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: ApplyInput) =>
      USE_MOCK ? scholarshipApplicationMock.apply(a) : postJson(`${APP_ROOT}/apply`, toApplyPayload(a)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [APP_KEY] }),
  });
}
export function useReviewApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { id: string; status: 'recommended' | 'rejected'; rejectReason?: string; amount?: number; period?: string }) =>
      USE_MOCK
        ? scholarshipApplicationMock.review(p)
        : putJson(`${APP_ROOT}/${p.id}/review`, {
            status: p.status === 'recommended' ? 'approved' : 'rejected',
            ...(p.rejectReason ? { rejectReason: p.rejectReason } : {}),
            ...(p.amount != null ? { amount: p.amount, period: p.period } : {}),
          }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [APP_KEY] }),
  });
}
export function useDeleteApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      USE_MOCK ? scholarshipApplicationMock.remove(id) : deleteData(`${APP_ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [APP_KEY] }),
  });
}
export function useScoreApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { id: string; scores: Record<string, number> }) =>
      USE_MOCK ? Promise.resolve() : putJson(`${APP_ROOT}/${p.id}/score`, { scores: toScorePayload(p.scores) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [APP_KEY] }),
  });
}

export interface SessionProfile {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  photo?: string;
  position?: string;
  role?: { name?: string; title?: string; permissions?: string[] };
}
export function useProfile() {
  return useQuery({
    queryKey: ['gifted-profile'],
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchOne<SessionProfile>('/auth/profile'),
  });
}
export function useMyGiftedProfile(enabled = true) {
  return useQuery({
    queryKey: [STUDENT_KEY, 'my'],
    enabled,
    queryFn: async (): Promise<StudentRecord | null> => {
      const raw = await fetchOne<BackendStudent | null>(`${STUDENT_ROOT}/my`);
      return raw ? mapStudent(raw) : null;
    },
  });
}
export function useMyAdvisor(enabled = true) {
  return useQuery({
    queryKey: [STUDENT_KEY, 'my-advisor'],
    enabled,
    queryFn: async (): Promise<AdvisorDetail | null> => {
      const raw = await fetchOne<BackendAdvisor | null>(`${STUDENT_ROOT}/my/advisor`);
      return raw ? mapAdvisor(raw) : null;
    },
  });
}
const CHAT_ROOT = '/chat';

export async function fetchChatPage(
  peerUserId: string,
  page: number,
  limit: number,
): Promise<{ messages: Message[]; hasMore: boolean }> {
  const res = await fetchOne<{ docs?: BackendChatMessage[] }>(
    `${CHAT_ROOT}/${peerUserId}?page=${page}&limit=${limit}`,
  );
  const docs = res.docs ?? [];
  return { messages: docs.map(mapChatMessage).reverse(), hasMore: docs.length >= limit };
}

export async function sendChatMessageRest(receiver: string, message: string): Promise<Message | null> {
  const res = await postJson<{ data?: BackendChatMessage }>(`${CHAT_ROOT}/send`, { receiver, message });
  const doc = res?.data;
  return doc?._id ? mapChatMessage(doc) : null;
}

export type {
  RefOption,
  AcademicYearOption,
  CourseOption,
  DirectionOption,
  GroupOption,
  DepartmentOption,
} from './reference-options';

export interface AdvisorOption {
  id: string;
  name: string;
  roleTitle: string;
  departmentId?: string;
  degree?: string;
}
const REF_STALE = 5 * 60 * 1000;

export function useAcademicYears() {
  return useQuery({
    queryKey: ['gifted-ref-academic-years'],
    staleTime: REF_STALE,
    queryFn: async (): Promise<AcademicYearOption[]> =>
      toAcademicYearOptions(await fetchList<BackendRefRow>('/academic-years?active=true')),
  });
}

export function useCourses() {
  return useQuery({
    queryKey: ['gifted-ref-courses'],
    staleTime: REF_STALE,
    queryFn: async (): Promise<CourseOption[]> =>
      toCourseOptions(await fetchList<BackendRefRow>('/courses?active=true')),
  });
}

export function useFaculties() {
  return useQuery({
    queryKey: ['gifted-ref-faculties'],
    staleTime: REF_STALE,
    queryFn: async (): Promise<RefOption[]> =>
      toFacultyOptions(await fetchList<BackendRefRow>('/faculties?active=true')),
  });
}

export function useDirections() {
  return useQuery({
    queryKey: ['gifted-ref-directions'],
    staleTime: REF_STALE,
    queryFn: async (): Promise<DirectionOption[]> =>
      toDirectionOptions(await fetchList<BackendChildRefRow>('/directions?active=true')),
  });
}

export function useGroups() {
  return useQuery({
    queryKey: ['gifted-ref-groups'],
    staleTime: REF_STALE,
    queryFn: async (): Promise<GroupOption[]> =>
      toGroupOptions(await fetchList<BackendGroupRow>('/groups?active=true')),
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ['gifted-ref-departments'],
    staleTime: REF_STALE,
    queryFn: async (): Promise<DepartmentOption[]> =>
      toDepartmentOptions(await fetchList<BackendChildRefRow>('/departments?active=true')),
  });
}

interface BackendCandidate {
  _id: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  role?: { title?: string };
  department?: string | { _id: string };
  academicTitle?: { title?: string } | null;
}

const candidateName = (u: BackendCandidate) => nameOf(u) ?? u._id;

const mapCandidate = (u: BackendCandidate): AdvisorOption => ({
  id: u._id,
  name: candidateName(u),
  roleTitle: u.role?.title ?? '',
  departmentId: u.department
    ? typeof u.department === 'object'
      ? u.department._id
      : u.department
    : undefined,
  degree: u.academicTitle?.title || undefined,
});

export function useAdvisorUsers(enabled = true) {
  return useQuery({
    queryKey: ['gifted-advisor-users'],
    enabled,
    staleTime: REF_STALE,
    queryFn: async (): Promise<AdvisorOption[]> =>
      (await fetchList<BackendCandidate>(`${STUDENT_ROOT}/advisor-candidates`)).map(mapCandidate),
  });
}

export interface TalabaOption {
  id: string;
  name: string;
}
export function useTalabaUsers(enabled = true) {
  return useQuery({
    queryKey: ['gifted-talaba-users'],
    enabled,
    staleTime: REF_STALE,
    queryFn: async (): Promise<TalabaOption[]> =>
      (await fetchList<BackendCandidate>(`${STUDENT_ROOT}/account-candidates`)).map((u) => ({
        id: u._id,
        name: candidateName(u),
      })),
  });
}

export function useJudgeUsers(enabled = true) {
  return useQuery({
    queryKey: ['gifted-judge-users'],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Array<{ id: string; name: string }>> =>
      (await fetchList<BackendCandidate>(`${SCH_ROOT}/judge-candidates`)).map((u) => ({
        id: u._id,
        name: candidateName(u),
      })),
  });
}
