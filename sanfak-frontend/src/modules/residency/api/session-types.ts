import type { LessonType } from './types';

export type SessionState = 'pending' | 'present' | 'absent' | 'unmeasured' | 'excused';
export const SESSION_STATES: readonly SessionState[] = [
  'present',
  'absent',
  'unmeasured',
  'pending',
  'excused',
];

export type SessionStatus = 'announced' | 'cancelled';
export const SESSION_STATUSES: readonly SessionStatus[] = ['announced', 'cancelled'];

export type RosterScope = 'group' | 'supervised';

export interface LessonSession {
  id: string;
  day: string;
  scienceId: string | null;
  scienceTitle: string | null;
  lessonType: LessonType | null;
  groupId: string | null;
  groupTitle: string | null;
  hours: number | null;
  teacherId: string | null;
  teacherName: string | null;
  rosterScope: RosterScope | null;
  status: SessionStatus | null;
  rosterCount: number;
  canCancel: boolean;
  cancelledAt: string | null;
  cancelledByName: string | null;
  cancelReason: string | null;
  createdAt: string | null;
}

export interface SessionRosterRow {
  id: string;
  residentId: string | null;
  fullName: string | null;
  specialtyTitle: string | null;
  courseNumber: number | null;
  groupTitle: string | null;
  state: SessionState;
  outcomeReason: string | null;
  score: number | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  scoreBlockedReason: string | null;
}

export interface LessonSessionDetail {
  session: LessonSession;
  roster: SessionRosterRow[];
}

export interface AnnounceSessionInput {
  day: string;
  science: string;
  lessonType: LessonType;
  group: string;
  hours: number;
}

export interface SkippedResident {
  residentId: string;
  sessionId: string | null;
}

export interface AnnounceSessionResult {
  id: string | null;
  rosterCount: number;
  skipped: SkippedResident[];
}

export interface SessionScoreInput {
  resident: string;
  score: number | null;
}

export interface SessionListParams {
  page: number;
  limit: number;
  day?: string;
  science?: string;
  lessonType?: LessonType;
  group?: string;
  status?: SessionStatus;
}

export const SESSION_STATE_LABEL: Record<SessionState, string> = {
  present: 'Keldi',
  absent: 'Kelmadi',
  unmeasured: 'O‘lchanmagan',
  pending: 'Kutilmoqda',
  excused: 'Sababli',
};

export const SESSION_STATE_VARIANT: Record<SessionState, string> = {
  present: 'success',
  absent: 'danger',
  unmeasured: 'umumiy',
  pending: 'info',
  excused: 'warning',
};

export const SESSION_STATE_HINT: Record<SessionState, string | null> = {
  present: 'SAMS orqali kelgani tasdiqlangan',
  absent: 'SAMS o‘lchagan kun, kirish qayd etilmagan',
  unmeasured: 'SAMS ma’lumoti yo‘q — «kelmadi» hisoblanmaydi',
  pending: 'Kun hali yopilmagan — SAMS ma’lumoti kutilmoqda',
  excused: 'Tasdiqlangan ariza bilan sababli',
};

export const PENDING_CLOSED_DAY_HINT =
  'Kun yopilgan — SAMS ma’lumoti hali kelmagan («kelmadi» hisoblanmaydi)';

export const SCORE_BLOCKED_TEXT = {
  notConfirmed: 'SAMS orqali kelgani tasdiqlanmagan',
  rowMissing: 'Jurnal qatori hali yozilmagan — birozdan so‘ng «Yangilash»ni bosing',
  lessonTypeNotGraded:
    'Amaliy mashg‘ulotga har dars uchun ball qo‘yilmaydi — oraliq nazorat orqali baholanadi',
  other: 'Bu qatorga ball qo‘yib bo‘lmaydi',
} as const;

export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  announced: 'E’lon qilingan',
  cancelled: 'Bekor qilingan',
};

export const SESSION_STATUS_VARIANT: Record<SessionStatus, string> = {
  announced: 'success',
  cancelled: 'nofaol',
};

export const SESSION_HOURS = { min: 1, max: 8 } as const;
export const SESSION_SCORE_MAX = 100;
export const CANCEL_REASON = { min: 2, max: 500 } as const;
