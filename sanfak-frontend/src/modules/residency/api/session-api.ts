import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { fetchOne, fetchPaginated, postJson, putJson } from '@/shared/api';
import { ATT_KEY, type Paged } from './residency-api';
import { mapAttendanceContext, type AttendanceContext } from './attendance-context';
import { ATTENDANCE_CONTEXT_SCOPE, SESSION_KEY } from './session-key';
import { titleOrSnapshot } from './ref-title';
import { nameOf, type RawUserName } from './user-name';
import { asLessonType, isLessonTypeGraded } from '../lib/lesson-type';
import { applySavedScores, oldScaleRejectText } from '../lib/session-scores';
import {
  SCORE_BLOCKED_TEXT,
  SESSION_STATES,
  SESSION_STATUSES,
  type AnnounceSessionInput,
  type AnnounceSessionResult,
  type LessonSession,
  type LessonSessionDetail,
  type RosterScope,
  type SessionListParams,
  type SessionRosterRow,
  type SessionScoreInput,
  type SessionState,
  type SessionStatus,
} from './session-types';

interface RawRef {
  _id: string;
  title?: string | null;
}
type RawUser = RawUserName & { _id: string };

export interface BackendSession {
  _id: string;
  day?: string | null;
  group?: string | RawRef | null;
  groupTitle?: string | null;
  science?: string | RawRef | null;
  scienceTitle?: string | null;
  lessonType?: string | null;
  hours?: number | null;
  announcedBy?: string | RawUser | null;
  rosterScope?: string | null;
  status?: string | null;
  framedCount?: number | null;
  canCancel?: boolean | null;
  cancelledAt?: string | null;
  cancelledBy?: string | RawUser | null;
  cancelReason?: string | null;
  createdAt?: string | null;
}

interface RawRosterResident {
  _id: string;
  fullName?: string | null;
  groupTitle?: string | null;
  courseNumber?: number | null;
  specialtyTitle?: string | null;
}

export interface BackendRosterRow {
  _id: string;
  resident?: string | RawRosterResident | null;
  state?: string | null;
  outcomeReason?: string | null;
  score?: number | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  scoreBlockedReason?: string | null;
}

export interface BackendAnnounceResult {
  message?: string;
  session?: BackendSession | null;
  framed?: number | null;
  conflicts?: Array<{ resident?: string | null; session?: string | null }> | null;
}

const refId = (v: string | { _id: string } | null | undefined): string | null =>
  v && typeof v === 'object' ? v._id : (v ?? null);

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

const finite = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

const count = (v: unknown): number => Math.max(0, finite(v) ?? 0);

export const dayKey = (v: unknown): string => (typeof v === 'string' ? v.slice(0, 10) : '');

const CLOCK_RE = /^\d{2}:\d{2}$/;
const clock = (v: unknown): string | null => (typeof v === 'string' && CLOCK_RE.test(v) ? v : null);

export const asSessionState = (v: unknown): SessionState =>
  typeof v === 'string' && (SESSION_STATES as readonly string[]).includes(v)
    ? (v as SessionState)
    : 'unmeasured';

const asSessionStatus = (v: unknown): SessionStatus | null =>
  typeof v === 'string' && (SESSION_STATUSES as readonly string[]).includes(v)
    ? (v as SessionStatus)
    : null;

const asRosterScope = (v: unknown): RosterScope | null =>
  v === 'group' || v === 'supervised' ? v : null;

export const mapLessonSession = (b: BackendSession): LessonSession => ({
  id: b._id,
  day: dayKey(b.day),
  scienceId: refId(b.science),
  scienceTitle: titleOrSnapshot(b.science, b.scienceTitle),
  lessonType: asLessonType(b.lessonType),
  groupId: refId(b.group),
  groupTitle: titleOrSnapshot(b.group, b.groupTitle),
  hours: finite(b.hours),
  teacherId: refId(b.announcedBy),
  teacherName: nameOf(b.announcedBy),
  rosterScope: asRosterScope(b.rosterScope),
  status: asSessionStatus(b.status),
  rosterCount: count(b.framedCount),
  canCancel: b.canCancel === true,
  cancelledAt: str(b.cancelledAt),
  cancelledByName: nameOf(b.cancelledBy),
  cancelReason: str(b.cancelReason),
  createdAt: str(b.createdAt),
});

const residentPart = (r: BackendRosterRow['resident']): RawRosterResident | null =>
  r && typeof r === 'object' ? r : null;

const SCORE_BLOCKED_BY_CODE: ReadonlyMap<string, string> = new Map([
  ['not_confirmed', SCORE_BLOCKED_TEXT.notConfirmed],
  ['row_missing', SCORE_BLOCKED_TEXT.rowMissing],
  ['lesson_type_not_graded', SCORE_BLOCKED_TEXT.lessonTypeNotGraded],
]);

const scoreBlockedText = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  return (typeof v === 'string' && SCORE_BLOCKED_BY_CODE.get(v)) || SCORE_BLOCKED_TEXT.other;
};

export const mapRosterRow = (b: BackendRosterRow): SessionRosterRow => {
  const r = residentPart(b.resident);
  return {
    id: b._id,
    residentId: refId(b.resident),
    fullName: str(r?.fullName),
    specialtyTitle: str(r?.specialtyTitle),
    courseNumber: finite(r?.courseNumber),
    groupTitle: str(r?.groupTitle),
    state: asSessionState(b.state),
    outcomeReason: str(b.outcomeReason),
    score: finite(b.score),
    checkInTime: clock(b.checkInTime),
    checkOutTime: clock(b.checkOutTime),
    scoreBlockedReason: scoreBlockedText(b.scoreBlockedReason),
  };
};

export const mapLessonSessionDetail = (b: {
  session: BackendSession;
  roster?: BackendRosterRow[] | null;
}): LessonSessionDetail => {
  const session = mapLessonSession(b.session);
  const roster = (b.roster ?? []).map(mapRosterRow);
  if (isLessonTypeGraded(session.lessonType)) return { session, roster };
  const blocked = SCORE_BLOCKED_TEXT.lessonTypeNotGraded;
  return { session, roster: roster.map((r) => ({ ...r, scoreBlockedReason: blocked })) };
};

export const mapAnnounceResult = (b: BackendAnnounceResult): AnnounceSessionResult => ({
  id: b.session?._id ?? null,
  rosterCount: count(b.framed),
  skipped: (b.conflicts ?? [])
    .filter((c) => typeof c.resident === 'string')
    .map((c) => ({ residentId: c.resident as string, sessionId: str(c.session) })),
});

export const toAnnouncePayload = (input: AnnounceSessionInput): AnnounceSessionInput => ({
  day: input.day,
  group: input.group,
  science: input.science,
  lessonType: input.lessonType,
  hours: input.hours,
});

export function toListQuery(p: SessionListParams): {
  page: number;
  limit: number;
  [k: string]: unknown;
} {
  const q: { page: number; limit: number; [k: string]: unknown } = { page: p.page, limit: p.limit };
  if (p.day) Object.assign(q, { from: p.day, to: p.day });
  for (const key of ['science', 'lessonType', 'group', 'status'] as const) {
    if (p[key]) q[key] = p[key];
  }
  return q;
}

export interface SessionErrorInfo {
  status: number | null;
  reason: string | null;
  message: string;
  meta: Record<string, unknown>;
}

const STANDARD_KEYS = new Set(['status', 'statusCode', 'message', 'detail', 'reason']);
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function sessionErrorInfo(
  err: unknown,
  fallback: string,
  reasonText: Record<string, string> = {},
): SessionErrorInfo {
  if (!(err instanceof AxiosError)) {
    return { status: null, reason: null, message: plainErrorText(err) ?? fallback, meta: {} };
  }
  const body = responseBody(err);
  const reason = str(body.reason);
  const byReason = reason ? reasonText[reason] : undefined;
  return {
    status: err.response?.status ?? null,
    reason,
    message: str(body.message) ?? byReason ?? str(body.detail) ?? fallback,
    meta: Object.fromEntries(Object.entries(body).filter(([k]) => !STANDARD_KEYS.has(k))),
  };
}

const plainErrorText = (err: unknown): string | null =>
  err instanceof Error ? str(err.message) : null;

const responseBody = (err: AxiosError): Record<string, unknown> => {
  const data: unknown = err.response?.data;
  return isRecord(data) ? data : {};
};

const ROOT = '/residency-sessions';
export { SESSION_KEY };

const retryServerOnly = (failureCount: number, error: unknown): boolean => {
  const status = error instanceof AxiosError ? error.response?.status : undefined;
  return failureCount < 1 && (status === undefined || status >= 500);
};

export async function fetchLessonSessions(
  params: SessionListParams,
): Promise<Paged<LessonSession>> {
  const res = await fetchPaginated<BackendSession>(`${ROOT}/paginate`, toListQuery(params));
  return {
    items: (res.docs ?? []).map(mapLessonSession),
    total: res.totalDocs ?? 0,
    page: res.page ?? params.page,
    totalPages: res.totalPages ?? 1,
  };
}

export function useLessonSessions(params: SessionListParams, enabled = true) {
  return useQuery({
    queryKey: [SESSION_KEY, 'paginate', params],
    enabled,
    placeholderData: keepPreviousData,
    retry: retryServerOnly,
    queryFn: () => fetchLessonSessions(params),
  });
}

export function useLessonSession(id: string | undefined) {
  return useQuery({
    queryKey: [SESSION_KEY, 'detail', id],
    enabled: !!id,
    retry: retryServerOnly,
    queryFn: async (): Promise<LessonSessionDetail> =>
      mapLessonSessionDetail(
        await fetchOne<{ session: BackendSession; roster?: BackendRosterRow[] }>(`${ROOT}/${id}`),
      ),
  });
}

export function useAttendanceContext(residentId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [SESSION_KEY, ATTENDANCE_CONTEXT_SCOPE, residentId],
    enabled: enabled && !!residentId,
    retry: retryServerOnly,
    queryFn: async (): Promise<AttendanceContext> =>
      mapAttendanceContext(
        await fetchOne<unknown>(`${ROOT}/residents/${residentId}/attendance-context`),
      ),
  });
}

function useInvalidateSessions() {
  const q = useQueryClient();
  return () => {
    void q.invalidateQueries({ queryKey: [SESSION_KEY] });
    void q.invalidateQueries({ queryKey: [ATT_KEY] });
  };
}

export function useAnnounceSession() {
  const invalidate = useInvalidateSessions();
  return useMutation({
    mutationFn: async (input: AnnounceSessionInput) =>
      mapAnnounceResult(await postJson<BackendAnnounceResult>(ROOT, toAnnouncePayload(input))),
    onSuccess: invalidate,
  });
}

export function useCancelSession() {
  const invalidate = useInvalidateSessions();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      putJson<{ session?: BackendSession; cancelledFrames?: number }>(`${ROOT}/${id}/cancel`, {
        reason: reason.trim(),
      }),
    onSettled: invalidate,
  });
}

export async function putSessionScore(
  sessionId: string,
  residentId: string,
  score: number | null,
): Promise<void> {
  await putJson(`${ROOT}/${sessionId}/entries/${residentId}/score`, { score });
}

export interface ScoreFailure {
  resident: string;
  reason: string | null;
  message: string;
}

export interface SaveScoresResult {
  saved: SessionScoreInput[];
  failed: ScoreFailure[];
  notSent: string[];
}

const SESSION_LEVEL_REASONS = new Set([
  'session_not_found',
  'session_cancelled',
  'lesson_type_not_graded',
]);
const isSessionLevel = (e: SessionErrorInfo): boolean =>
  (e.reason !== null && SESSION_LEVEL_REASONS.has(e.reason)) ||
  e.status === 401 ||
  e.status === 403;

const SCORE_REASON_TEXT: Record<string, string> = {
  not_confirmed: 'SAMS orqali kelgani tasdiqlanmagan — ball qo‘yilmaydi',
  state_changed: 'Holat o‘zgardi — ro‘yxat yangilandi, qayta urinib ko‘ring',
  entry_not_found: 'Rezident bu mashg‘ulot ro‘yxatida yo‘q',
  session_cancelled: 'Mashg‘ulot bekor qilingan',
  session_not_found: 'Mashg‘ulot topilmadi',
};

const FIXED_REASON_TEXT: ReadonlyMap<string, string> = new Map([
  ['lesson_type_not_graded', SCORE_BLOCKED_TEXT.lessonTypeNotGraded],
]);

function scoreFailure(
  resident: string,
  err: unknown,
): { failure: ScoreFailure; info: SessionErrorInfo } {
  const info = sessionErrorInfo(err, 'Ballni saqlab bo‘lmadi', SCORE_REASON_TEXT);
  const fixed =
    info.reason === null
      ? oldScaleRejectText(info.status, info.message)
      : FIXED_REASON_TEXT.get(info.reason);
  return { failure: { resident, reason: info.reason, message: fixed ?? info.message }, info };
}

export async function saveSessionScores(
  sessionId: string,
  scores: SessionScoreInput[],
  put: typeof putSessionScore = putSessionScore,
): Promise<SaveScoresResult> {
  const result: SaveScoresResult = { saved: [], failed: [], notSent: [] };
  for (const [i, s] of scores.entries()) {
    try {
      await put(sessionId, s.resident, s.score);
      result.saved.push(s);
    } catch (err) {
      const { failure, info } = scoreFailure(s.resident, err);
      result.failed.push(failure);
      if (isSessionLevel(info)) {
        result.notSent = scores.slice(i + 1).map((x) => x.resident);
        break;
      }
    }
  }
  return result;
}

export function useSaveSessionScores() {
  const q = useQueryClient();
  const invalidate = useInvalidateSessions();
  return useMutation({
    mutationFn: ({ sessionId, scores }: { sessionId: string; scores: SessionScoreInput[] }) =>
      saveSessionScores(sessionId, scores),
    onSuccess: (res, { sessionId }) => {
      q.setQueryData<LessonSessionDetail>([SESSION_KEY, 'detail', sessionId], (d) =>
        d ? applySavedScores(d, res.saved) : d,
      );
    },
    onSettled: invalidate,
  });
}
