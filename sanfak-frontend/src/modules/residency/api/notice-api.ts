import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, fetchList, fetchOne, postJson, putJson, deleteData } from '@/shared/api';
import type { Program } from './types';
import type {
  AbsenceLastNotice,
  AbsenceStreak,
  Notice,
  NoticeAbsence,
  NoticeAuto,
  NoticeDocument,
  NoticeKind,
  NoticeStatus,
  ProblemStudent,
  WritableNoticeKind,
} from './notice-types';
import { nameOrSnapshot, titleOrSnapshot } from './ref-title';

type Q = Record<string, string | number | boolean | undefined | null>;
function qs(params: Q): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

const prog = (v: string | null | undefined): Program =>
  v === 'magistratura' ? 'magistratura' : 'ordinatura';

interface RawUser {
  _id: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
}
interface RawResident {
  _id: string;
  fullName?: string;
}
interface BackendNotice {
  _id: string;
  sender?: string | RawUser | null;
  senderName?: string | null;
  resident?: string | RawResident | null;
  program?: string | null;
  academicYear?: string | null;
  academicYearRef?: string | null;
  title: string;
  content: string;
  status?: string | null;
  kind?: string | null;
  auto?: { state?: string | null; countingYear?: string | null } | null;
  absence?: {
    days?: number;
    from?: string;
    to?: string;
    windowDays?: number | null;
    windowFrom?: string | null;
    windowTo?: string | null;
  } | null;
  document?: { fileName?: string; size?: number; generatedAt?: string } | null;
  decision?: string | null;
  reviewedBy?: string | { _id: string; firstName?: string; lastName?: string; middleName?: string } | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  createdAt?: string | null;
}

const refId = (v: string | { _id: string } | null | undefined): string | null =>
  v && typeof v === 'object' ? v._id : (v ?? null);

const userName = (u: string | RawUser | null | undefined): string | null => {
  if (!u || typeof u !== 'object') return null;
  const parts = [u.lastName, u.firstName, u.middleName].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
};

const asNoticeStatus = (v: string | null | undefined): NoticeStatus =>
  v === 'kutilmoqda' || v === 'korib_chiqilgan' ? v : 'yangi';

const asNoticeKind = (v: string | null | undefined): NoticeKind =>
  v === 'davomat' || v === 'avtomatik' ? v : 'oddiy';

const mapAuto = (a: BackendNotice['auto']): NoticeAuto | null =>
  a && (a.state === 'faol' || a.state === 'bekor_qilingan')
    ? { state: a.state, countingYear: a.countingYear ?? null }
    : null;

const mapAbsence = (a: BackendNotice['absence']): NoticeAbsence | null =>
  a && typeof a.days === 'number' && a.from && a.to
    ? {
        days: a.days,
        from: a.from,
        to: a.to,
        windowDays: typeof a.windowDays === 'number' ? a.windowDays : null,
        windowFrom: a.windowFrom ?? null,
        windowTo: a.windowTo ?? null,
      }
    : null;

const mapDocument = (d: BackendNotice['document']): NoticeDocument | null =>
  d && d.fileName
    ? {
        fileName: d.fileName,
        size: typeof d.size === 'number' ? d.size : 0,
        generatedAt: d.generatedAt ?? null,
      }
    : null;

export const mapNotice = (b: BackendNotice): Notice => ({
  id: b._id,
  senderId: refId(b.sender),
  senderName: nameOrSnapshot(userName(b.sender), b.senderName),
  residentId: refId(b.resident),
  residentName:
    b.resident && typeof b.resident === 'object' ? (b.resident.fullName ?? null) : null,
  program: prog(b.program),
  academicYear: b.academicYear ?? null,
  academicYearRef: b.academicYearRef ?? null,
  title: b.title,
  content: b.content,
  status: asNoticeStatus(b.status),
  kind: asNoticeKind(b.kind),
  auto: mapAuto(b.auto),
  absence: mapAbsence(b.absence),
  document: mapDocument(b.document),
  decision: b.decision ?? null,
  reviewedByName: nameOrSnapshot(userName(b.reviewedBy), b.reviewedByName),
  reviewedAt: b.reviewedAt ?? null,
  createdAt: b.createdAt ?? null,
});

const NOTICE_ROOT = '/notices';
export const NOTICE_KEY = 'residency-notices';

export interface NoticeInput {
  program: Program;
  title: string;
  content: string;
  academicYear?: string | null;
  academicYearRef?: string | null;
  resident?: string | null;
  kind?: WritableNoticeKind;
}

export function useNotices(params: Q = {}) {
  return useQuery({
    queryKey: [NOTICE_KEY, 'list', params],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<Notice[]> =>
      (await fetchList<BackendNotice>(`${NOTICE_ROOT}${qs(params)}`)).map(mapNotice),
  });
}

export function useCreateNotice() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (input: NoticeInput) => postJson(NOTICE_ROOT, input),
    onSuccess: () => q.invalidateQueries({ queryKey: [NOTICE_KEY] }),
  });
}

export function useViewNotice() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => putJson(`${NOTICE_ROOT}/${id}/view`, {}),
    onSuccess: () => q.invalidateQueries({ queryKey: [NOTICE_KEY] }),
  });
}

export function useReviewNotice() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: string }) =>
      putJson(`${NOTICE_ROOT}/${id}/review`, { decision }),
    onSuccess: () => q.invalidateQueries({ queryKey: [NOTICE_KEY] }),
  });
}

export function useUpdateNotice() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { title?: string; content?: string; academicYear?: string | null };
    }) => putJson(`${NOTICE_ROOT}/${id}`, data),
    onSuccess: () => q.invalidateQueries({ queryKey: [NOTICE_KEY] }),
  });
}

export function useDeleteNotice() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${NOTICE_ROOT}/${id}`),
    onSuccess: () => q.invalidateQueries({ queryKey: [NOTICE_KEY] }),
  });
}

interface RawRef {
  _id: string;
  title?: string;
}
interface BackendProblemStudent {
  _id: string;
  academicYear?: string | null;
  academicYearRef?: string | null;
  department?: string | RawRef | null;
  departmentTitle?: string | null;
  program?: string | null;
  specialty?: string | RawRef | null;
  specialtyTitle?: string | null;
  fullName: string;
  courseNumber?: number | null;
  group?: string | RawRef | null;
  groupTitle?: string | null;
  date?: string | null;
  content: string;
  conclusion?: string | null;
}

const mapProblemStudent = (b: BackendProblemStudent): ProblemStudent => ({
  id: b._id,
  academicYear: b.academicYear ?? null,
  academicYearRef: b.academicYearRef ?? null,
  departmentId: refId(b.department),
  departmentTitle: titleOrSnapshot(b.department, b.departmentTitle),
  program: prog(b.program),
  specialtyId: refId(b.specialty),
  specialtyTitle: titleOrSnapshot(b.specialty, b.specialtyTitle),
  fullName: b.fullName,
  courseNumber: b.courseNumber ?? null,
  groupId: refId(b.group),
  groupTitle: b.groupTitle ?? null,
  date: b.date ?? null,
  content: b.content,
  conclusion: b.conclusion ?? null,
});

const PS_ROOT = '/problem-students';
const PS_KEY = 'residency-problem-students';

export interface ProblemStudentInput {
  academicYear?: string | null;
  academicYearRef?: string | null;
  department?: string | null;
  departmentTitle?: string | null;
  program: Program;
  specialty?: string | null;
  specialtyTitle?: string | null;
  fullName: string;
  courseNumber?: number | null;
  group?: string | null;
  groupTitle?: string | null;
  content: string;
  conclusion?: string | null;
}

export function useProblemStudents(params: Q = {}, enabled = true) {
  return useQuery({
    queryKey: [PS_KEY, 'list', params],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<ProblemStudent[]> =>
      (await fetchList<BackendProblemStudent>(`${PS_ROOT}${qs(params)}`)).map(
        mapProblemStudent,
      ),
  });
}

export function useCreateProblemStudent() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (input: ProblemStudentInput) => postJson(PS_ROOT, input),
    onSuccess: () => q.invalidateQueries({ queryKey: [PS_KEY] }),
  });
}

export function useUpdateProblemStudent() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProblemStudentInput> }) =>
      putJson(`${PS_ROOT}/${id}`, data),
    onSuccess: () => q.invalidateQueries({ queryKey: [PS_KEY] }),
  });
}

export function useDeleteProblemStudent() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${PS_ROOT}/${id}`),
    onSuccess: () => q.invalidateQueries({ queryKey: [PS_KEY] }),
  });
}

interface BackendAbsenceStreak {
  resident?: string;
  days?: number;
  from?: string | null;
  to?: string | null;
  threshold?: number | null;
  eligible?: boolean;
  windowDays?: number | null;
  windowFrom?: string | null;
  windowTo?: string | null;
  dayKeys?: string[] | null;
  lastNotice?: {
    id?: string;
    createdAt?: string;
    days?: number;
    from?: string;
    to?: string;
  } | null;
}

const mapLastNotice = (n: BackendAbsenceStreak['lastNotice']): AbsenceLastNotice | null =>
  n &&
  typeof n === 'object' &&
  typeof n.id === 'string' &&
  typeof n.createdAt === 'string' &&
  typeof n.days === 'number' &&
  typeof n.from === 'string' &&
  typeof n.to === 'string'
    ? { id: n.id, createdAt: n.createdAt, days: n.days, from: n.from, to: n.to }
    : null;

export const mapAbsenceStreak = (b: BackendAbsenceStreak, residentId: string): AbsenceStreak => ({
  residentId: b.resident ?? residentId,
  days: b.days ?? 0,
  from: b.from ?? null,
  to: b.to ?? null,
  threshold: b.threshold ?? null,
  eligible: !!b.eligible,
  windowDays: typeof b.windowDays === 'number' ? b.windowDays : null,
  windowFrom: b.windowFrom ?? null,
  windowTo: b.windowTo ?? null,
  dayKeys: Array.isArray(b.dayKeys) ? b.dayKeys.filter((d) => typeof d === 'string') : [],
  lastNotice: mapLastNotice(b.lastNotice),
});

export function useAbsenceStreak(residentId: string | null) {
  return useQuery({
    queryKey: [NOTICE_KEY, 'absence-streak', residentId],
    enabled: !!residentId,
    queryFn: async (): Promise<AbsenceStreak> =>
      mapAbsenceStreak(
        await fetchOne<BackendAbsenceStreak>(
          `${NOTICE_ROOT}/absence-streak${qs({ resident: residentId })}`,
        ),
        String(residentId),
      ),
  });
}

export async function downloadNoticePdf(
  noticeId: string,
  fileName: string,
): Promise<void> {
  const res = await apiClient.get<Blob>(`${NOTICE_ROOT}/${noticeId}/pdf`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
