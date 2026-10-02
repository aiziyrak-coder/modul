import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, fetchList, fetchOne, postJson, putJson, deleteData, uploadMultipart } from '@/shared/api';
import { isAttendanceStateChanged } from './attendance-write-error';
import type {
  Application,
  ApplicationStats,
  Assessment,
  AttestationEligibility,
  Attendance,
  AttendanceStats,
  AttendanceWrite,
  JournalStats,
  ResidentRollup,
  DailyLog,
  DailyLogStats,
  RefOption,
  Resident,
  Specialty,
  UserOption,
} from './types';
import {
  mapApplication,
  mapAssessment,
  mapAttendance,
  mapAttendanceStats,
  mapJournalStats,
  mapResidentRollup,
  mapDailyLog,
  mapResident,
  mapSpecialty,
  mapUserOption,
  toApplicationPayload,
  toAssignPayload,
  toGradePayload,
  toAttendancePayload,
  toDailyLogPayload,
  toResidentPayload,
  toReviewPayload,
  toSpecialtyPayload,
  type BackendApplication,
  type BackendAssessment,
  type BackendAttendance,
  type BackendAttendanceStats,
  type BackendJournalStats,
  type BackendResidentRollup,
  type BackendDailyLog,
  type BackendResident,
  type BackendSpecialty,
} from './mapper';
import {
  toRefOptions,
  toSpecialtyOptions,
  type BackendNamedRow,
} from './reference-options';
import { ATTENDANCE_CONTEXT_SCOPE, SESSION_KEY } from './session-key';
import { normalizeSearch } from '../lib/use-debounced';

type Q = Record<string, string | number | boolean | undefined | null>;
function qs(params: Q): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}
interface BackendPaged<T> {
  docs?: T[];
  totalDocs?: number;
  page?: number;
  totalPages?: number;
}
async function paginate<TB, T>(root: string, params: Q, map: (b: TB) => T): Promise<Paged<T>> {
  const res = await fetchOne<BackendPaged<TB>>(`${root}/paginate${qs({ page: 1, limit: 10, ...params })}`);
  return {
    items: (res.docs ?? []).map(map),
    total: res.totalDocs ?? 0,
    page: res.page ?? 1,
    totalPages: res.totalPages ?? 1,
  };
}

const SPEC = '/specialties';
const SPEC_KEY = 'residency-specialties';

export function useSpecialties(program?: 'magistratura' | 'ordinatura', enabled = true) {
  return useQuery({
    queryKey: [SPEC_KEY, program ?? 'all'],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<Specialty[]> =>
      toSpecialtyOptions((await fetchList<BackendSpecialty>(`${SPEC}${qs({ program })}`)).map(mapSpecialty)),
  });
}
export function useCreateSpecialty() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (s: Partial<Specialty>) => postJson(SPEC, toSpecialtyPayload(s)),
    onSuccess: () => q.invalidateQueries({ queryKey: [SPEC_KEY] }),
  });
}
export function useUpdateSpecialty() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Specialty> }) =>
      putJson(`${SPEC}/${id}`, toSpecialtyPayload(data)),
    onSuccess: () => q.invalidateQueries({ queryKey: [SPEC_KEY] }),
  });
}
export function useDeleteSpecialty() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${SPEC}/${id}`),
    onSuccess: () => q.invalidateQueries({ queryKey: [SPEC_KEY] }),
  });
}

const RES = '/residents';
export const RES_KEY = 'residency-residents';

export function useResidents(params: Q = {}, enabled = true) {
  return useQuery({
    queryKey: [RES_KEY, 'paginate', params],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: () => paginate<BackendResident, Resident>(RES, params, mapResident),
  });
}
export function useResident(id: string | undefined) {
  return useQuery({
    queryKey: [RES_KEY, id],
    enabled: !!id,
    queryFn: async (): Promise<Resident> => mapResident(await fetchOne<BackendResident>(`${RES}/${id}`)),
  });
}
export function useMyResident(enabled = true) {
  return useQuery({
    queryKey: [RES_KEY, 'my'],
    enabled,
    queryFn: async (): Promise<Resident | null> => {
      try {
        return mapResident(await fetchOne<BackendResident>(`${RES}/my`));
      } catch {
        return null;
      }
    },
  });
}
export function useMyResidents(params: Q = {}, enabled = true) {
  return useQuery({
    queryKey: [RES_KEY, 'my-residents', params],
    enabled,
    queryFn: async (): Promise<Resident[]> =>
      (await fetchList<BackendResident>(`${RES}/my-residents${qs(params)}`)).map(mapResident),
  });
}
export interface OnboardResidentResult {
  message?: string;
  id?: string;
  resident:
    | { status: ImportResidentStatus; id?: string; matchedBy?: DuplicateKey }
    | null;
  account: {
    status: ImportAccountStatus;
    gaps?: {
      conflicts?: Array<{ field: string; account: unknown; incoming: unknown }>;
      warnings?: string[];
    };
  } | null;
  warnings?: string[];
}

export function useCreateResident() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (r: Partial<Resident>): Promise<OnboardResidentResult> =>
      postJson(RES, toResidentPayload(r)) as Promise<OnboardResidentResult>,
    onSuccess: () => q.invalidateQueries({ queryKey: [RES_KEY] }),
  });
}
export interface UpdateResidentResult {
  message?: string;
  accountSync?: { status: string; fields?: string[] };
  warnings?: string[];
}

export function useUpdateResident() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Resident> }): Promise<UpdateResidentResult> =>
      putJson(`${RES}/${id}`, toResidentPayload(data)) as Promise<UpdateResidentResult>,
    onSuccess: () => q.invalidateQueries({ queryKey: [RES_KEY] }),
  });
}
export function useAssignSupervisor() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof toAssignPayload>[0] }) =>
      putJson(`${RES}/${id}/assign`, toAssignPayload(data)),
    onSuccess: () => q.invalidateQueries({ queryKey: [RES_KEY] }),
  });
}

export type ImportResidentStatus = 'created' | 'existing' | 'linked';
export type DuplicateKey = 'user' | 'jshshir' | 'passport';
export type ImportAccountStatus = 'created' | 'existing' | 'skipped';

export interface ImportRowOk {
  row: number;
  fullName: string;
  jshshir: string | null;
  status: 'ok';
  resident: ImportResidentStatus;
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

export const isFailedRow = (r: ImportRow): r is ImportRowFailed => r.status === 'failed';

export interface ImportReport {
  dryRun: boolean;
  total: number;
  resident: Record<ImportResidentStatus | 'failed', number>;
  account: Record<ImportAccountStatus, number>;
  columns: { recognized: string[]; ignored: Array<{ header: string; reason: string }> };
  rows: ImportRow[];
}

export async function importRoster(file: File, dryRun: boolean): Promise<ImportReport> {
  return uploadMultipart<ImportReport>(
    `${RES}/import?dryRun=${dryRun ? 'true' : 'false'}`,
    'POST',
    { file },
  );
}

export async function fetchImportTemplate(sample = false): Promise<Blob> {
  const res = await apiClient.get(`${RES}/import-template`, {
    params: sample ? { sample: true } : undefined,
    responseType: 'blob',
  });
  return res.data as Blob;
}

export function useDeleteResident() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${RES}/${id}`),
    onSuccess: () => q.invalidateQueries({ queryKey: [RES_KEY] }),
  });
}

const ATT = '/attendance';
export const ATT_KEY = 'residency-attendance';

interface QueryOpts {
  enabled?: boolean;
}

export function useAttendance(params: Q = {}, { enabled = true }: QueryOpts = {}) {
  return useQuery({
    queryKey: [ATT_KEY, 'paginate', params],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: () => paginate<BackendAttendance, Attendance>(ATT, params, mapAttendance),
  });
}
export function useResidentAttendance(residentId: string | undefined, params: Q = {}) {
  return useQuery({
    queryKey: [ATT_KEY, 'resident', residentId, params],
    enabled: !!residentId,
    queryFn: async (): Promise<Attendance[]> =>
      (await fetchList<BackendAttendance>(`${ATT}/resident/${residentId}${qs(params)}`)).map(mapAttendance),
  });
}
export function useAttendanceStats(residentId: string | undefined) {
  return useQuery({
    queryKey: [ATT_KEY, 'stats', residentId],
    enabled: !!residentId,
    queryFn: async (): Promise<AttendanceStats> =>
      mapAttendanceStats(await fetchOne<BackendAttendanceStats>(`${ATT}/resident/${residentId}/stats`)),
  });
}
export function useJournalStats(params: Q = {}, { enabled = true }: QueryOpts = {}) {
  return useQuery({
    queryKey: [ATT_KEY, 'journal-stats', params],
    enabled,
    queryFn: async (): Promise<JournalStats> =>
      mapJournalStats(await fetchOne<BackendJournalStats>(`${ATT}/stats${qs(params)}`)),
  });
}

export function useAttendanceByResident(params: Q = {}, { enabled = true }: QueryOpts = {}) {
  return useQuery({
    queryKey: [ATT_KEY, 'by-resident', params],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<Paged<ResidentRollup>> => {
      const res = await fetchOne<BackendPaged<BackendResidentRollup>>(
        `${ATT}/stats/by-resident${qs({ page: 1, limit: 10, ...params })}`,
      );
      return {
        items: (res.docs ?? []).map(mapResidentRollup),
        total: res.totalDocs ?? 0,
        page: res.page ?? 1,
        totalPages: res.totalPages ?? 1,
      };
    },
  });
}
export function useUpdateAttendance() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AttendanceWrite }) =>
      putJson(`${ATT}/${id}`, toAttendancePayload(data)),
    onSuccess: () => q.invalidateQueries({ queryKey: [ATT_KEY] }),
    onError: (e) => {
      if (isAttendanceStateChanged(e)) void q.invalidateQueries({ queryKey: [ATT_KEY] });
    },
  });
}
export function useApproveExcuse(opts?: { onSettled?: () => void }) {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      putJson(`${ATT}/${id}/approve-excuse`, { reason: reason.trim() }),
    onSettled: () => {
      void q.invalidateQueries({ queryKey: [ATT_KEY] });
      void q.invalidateQueries({ queryKey: [RES_KEY] });
      void q.invalidateQueries({ queryKey: [ASM_KEY] });
      opts?.onSettled?.();
    },
  });
}

const ASM = '/assessments';
const ASM_KEY = 'residency-assessments';

export function useAssessments(params: Q = {}) {
  return useQuery({
    queryKey: [ASM_KEY, 'paginate', params],
    queryFn: () => paginate<BackendAssessment, Assessment>(ASM, params, mapAssessment),
  });
}
export function useResidentAssessments(residentId: string | undefined) {
  return useQuery({
    queryKey: [ASM_KEY, 'resident', residentId],
    enabled: !!residentId,
    queryFn: async (): Promise<Assessment[]> =>
      (await fetchList<BackendAssessment>(`${ASM}/resident/${residentId}`)).map(mapAssessment),
  });
}
export function useAttestationEligibility(residentId: string | undefined) {
  return useQuery({
    queryKey: [ASM_KEY, 'eligibility', residentId],
    enabled: !!residentId,
    queryFn: async (): Promise<AttestationEligibility> =>
      fetchOne<AttestationEligibility>(`${ASM}/resident/${residentId}/eligibility`),
  });
}
export function useGradeAssessment() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (a: Parameters<typeof toGradePayload>[0]) => postJson(`${ASM}/grade`, toGradePayload(a)),
    onSuccess: () => q.invalidateQueries({ queryKey: [ASM_KEY] }),
  });
}
export function useUpdateAssessment() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({ id, score }: { id: string; score: number }) => putJson(`${ASM}/${id}`, { score }),
    onSuccess: () => q.invalidateQueries({ queryKey: [ASM_KEY] }),
  });
}
export function useDeleteAssessment() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ASM}/${id}`),
    onSuccess: () => q.invalidateQueries({ queryKey: [ASM_KEY] }),
  });
}

const LOG = '/daily-logs';
const LOG_KEY = 'residency-daily-logs';

export function useDailyLogs(params: Q = {}) {
  return useQuery({
    queryKey: [LOG_KEY, 'paginate', params],
    placeholderData: keepPreviousData,
    queryFn: () => paginate<BackendDailyLog, DailyLog>(LOG, params, mapDailyLog),
  });
}
export function useDailyLogsByResident(residentId: string | undefined, params: Q = {}) {
  return useQuery({
    queryKey: [LOG_KEY, 'resident', residentId, params],
    enabled: !!residentId,
    queryFn: async (): Promise<DailyLog[]> =>
      (await fetchList<BackendDailyLog>(`${LOG}/resident/${residentId}${qs(params)}`)).map(mapDailyLog),
  });
}
export function useDailyLogStats() {
  return useQuery({
    queryKey: [LOG_KEY, 'stats'],
    queryFn: (): Promise<DailyLogStats> => fetchOne<DailyLogStats>(`${LOG}/stats`),
  });
}
export function useCreateDailyLog() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (d: Partial<DailyLog>) => postJson(LOG, toDailyLogPayload(d)),
    onSuccess: () => q.invalidateQueries({ queryKey: [LOG_KEY] }),
  });
}
export function useUpdateDailyLog() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DailyLog> }) =>
      putJson(`${LOG}/${id}`, toDailyLogPayload(data)),
    onSuccess: () => q.invalidateQueries({ queryKey: [LOG_KEY] }),
  });
}
export function useApproveDailyLog() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) =>
      putJson(`${LOG}/${id}/approve`, { ...(comment !== undefined ? { comment } : {}) }),
    onSuccess: () => q.invalidateQueries({ queryKey: [LOG_KEY] }),
  });
}
export function useReturnDailyLog() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => putJson(`${LOG}/${id}/return`, { reason }),
    onSuccess: () => q.invalidateQueries({ queryKey: [LOG_KEY] }),
  });
}

const APP = '/applications';
const APP_KEY = 'residency-applications';

export function useApplications(params: Q = {}) {
  return useQuery({
    queryKey: [APP_KEY, 'paginate', params],
    placeholderData: keepPreviousData,
    queryFn: () => paginate<BackendApplication, Application>(APP, params, mapApplication),
  });
}
export function useApplicationStats(params: Q = {}) {
  return useQuery({
    queryKey: [APP_KEY, 'stats', params],
    placeholderData: keepPreviousData,
    queryFn: (): Promise<ApplicationStats> =>
      fetchOne<ApplicationStats>(`${APP}/stats${qs(params)}`),
  });
}
export function useCreateApplication() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({ file, ...a }: Parameters<typeof toApplicationPayload>[0] & { file?: File | null }) =>
      uploadMultipart(APP, 'POST', {
        ...(toApplicationPayload(a) as Record<string, string | undefined>),
        file: file ?? null,
      }),
    onSuccess: () => q.invalidateQueries({ queryKey: [APP_KEY] }),
  });
}
export function useReviewApplication() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof toReviewPayload>[0] }) =>
      putJson(`${APP}/${id}/review`, toReviewPayload(data)),
    onSuccess: () => {
      q.invalidateQueries({ queryKey: [APP_KEY] });
      q.invalidateQueries({ queryKey: [ATT_KEY] });
      q.invalidateQueries({ queryKey: [SESSION_KEY, ATTENDANCE_CONTEXT_SCOPE] });
      q.invalidateQueries({ queryKey: [ASM_KEY, 'eligibility'] });
    },
  });
}

const REF_STALE = 5 * 60 * 1000;

export function useDepartments(enabled = true) {
  return useQuery({
    queryKey: ['residency-ref-departments'],
    enabled,
    staleTime: REF_STALE,
    queryFn: async (): Promise<RefOption[]> =>
      toRefOptions(await fetchList<BackendNamedRow>('/departments?active=true')),
  });
}
export function useGroups(enabled = true) {
  return useQuery({
    queryKey: ['residency-ref-groups'],
    enabled,
    staleTime: REF_STALE,
    queryFn: async (): Promise<RefOption[]> =>
      toRefOptions(await fetchList<BackendNamedRow>('/groups?active=true')),
  });
}
export function useSciences() {
  return useQuery({
    queryKey: ['residency-ref-sciences'],
    staleTime: REF_STALE,
    queryFn: async (): Promise<RefOption[]> =>
      toRefOptions(await fetchList<BackendNamedRow>('/sciences?active=true')),
  });
}

interface LookupUser {
  _id: string;
  firstName?: string;
  lastName?: string;
  department?: { _id: string; title?: string } | null;
  role?: { title?: string; name?: string };
}
const LOOKUP_ROOT = '/users/lookup';

const SUPERVISOR_ROLES = ['klinik_ustoz', 'ilmiy_rahbar', 'oqituvchi', 'kafedra_mudiri', 'dekan'];

export interface SupervisorCard {
  id: string;
  fullName: string | null;
  academicTitle: string | null;
  position: string | null;
  department: string | null;
  faculty: string | null;
  division: string | null;
  phone: string | null;
  office: string | null;
  workingHours: string | null;
}

export function useSupervisorCard(id: string | null | undefined) {
  return useQuery({
    queryKey: [RES_KEY, 'supervisor-card', id],
    enabled: !!id,
    staleTime: REF_STALE,
    queryFn: async (): Promise<SupervisorCard> =>
      fetchOne<SupervisorCard>(`${RES}/supervisors/${id}`),
  });
}

export function useSupervisorUsers(
  enabled = true,
  search = '',
  roles: readonly string[] = SUPERVISOR_ROLES,
) {
  const roleParam = roles.join(',');
  const term = normalizeSearch(search);
  return useQuery({
    queryKey: ['residency-supervisor-users', roleParam, term],
    enabled,
    staleTime: REF_STALE,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<UserOption[]> => {
      const docs = await fetchList<LookupUser>(LOOKUP_ROOT, {
        role: roleParam,
        limit: 100,
        ...(term ? { search: term } : {}),
      });
      return docs.map(mapUserOption);
    },
  });
}
export function useTalabaUsers(enabled = true, search = '') {
  const term = normalizeSearch(search);
  return useQuery({
    queryKey: ['residency-talaba-users', term],
    enabled,
    staleTime: REF_STALE,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<UserOption[]> => {
      const docs = await fetchList<LookupUser>(LOOKUP_ROOT, {
        role: 'talaba,rezident,magistrant',
        limit: 100,
        ...(term ? { search: term } : {}),
      });
      return docs.map(mapUserOption);
    },
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
  role?: { name?: string; title?: string };
}
export function useProfile() {
  return useQuery({
    queryKey: ['residency-profile'],
    staleTime: REF_STALE,
    queryFn: () => fetchOne<SessionProfile>('/auth/profile'),
  });
}
