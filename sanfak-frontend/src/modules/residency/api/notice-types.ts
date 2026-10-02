import type { Program } from './types';

export type NoticeStatus = 'yangi' | 'kutilmoqda' | 'korib_chiqilgan';

export type NoticeKind = 'oddiy' | 'davomat' | 'avtomatik';

export type WritableNoticeKind = Exclude<NoticeKind, 'avtomatik'>;

export type NoticeAutoState = 'faol' | 'bekor_qilingan';

export interface NoticeAuto {
  state: NoticeAutoState;
  countingYear: string | null;
}

export interface NoticeAbsence {
  days: number;
  from: string;
  to: string;
  windowDays: number | null;
  windowFrom: string | null;
  windowTo: string | null;
}

export interface NoticeDocument {
  fileName: string;
  size: number;
  generatedAt: string | null;
}

export interface AbsenceLastNotice {
  id: string;
  createdAt: string;
  days: number;
  from: string;
  to: string;
}

export interface AbsenceStreak {
  residentId: string;
  days: number;
  from: string | null;
  to: string | null;
  threshold: number | null;
  eligible: boolean;
  windowDays: number | null;
  windowFrom: string | null;
  windowTo: string | null;
  dayKeys: string[];
  lastNotice: AbsenceLastNotice | null;
}

export interface Notice {
  id: string;
  senderId: string | null;
  senderName: string | null;
  residentId: string | null;
  residentName: string | null;
  program: Program;
  academicYear: string | null;
  academicYearRef: string | null;
  title: string;
  content: string;
  status: NoticeStatus;
  kind: NoticeKind;
  auto: NoticeAuto | null;
  absence: NoticeAbsence | null;
  document: NoticeDocument | null;
  decision: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
}

export interface ProblemStudent {
  id: string;
  academicYear: string | null;
  academicYearRef: string | null;
  departmentId: string | null;
  departmentTitle: string | null;
  program: Program;
  specialtyId: string | null;
  specialtyTitle: string | null;
  fullName: string;
  courseNumber: number | null;
  groupId: string | null;
  groupTitle: string | null;
  date: string | null;
  content: string;
  conclusion: string | null;
}

export const NOTICE_STATUS_LABEL: Record<NoticeStatus, string> = {
  yangi: 'Yangi',
  kutilmoqda: 'Kutilmoqda',
  korib_chiqilgan: 'Ko‘rib chiqilgan',
};

export const NOTICE_STATUS_VARIANT: Record<NoticeStatus, string> = {
  yangi: 'info',
  kutilmoqda: 'warning',
  korib_chiqilgan: 'success',
};

export const PROGRAM_LABEL: Record<Program, string> = {
  magistratura: 'Magistratura',
  ordinatura: 'Ordinatura',
};

export const NOTICE_KIND_LABEL: Record<NoticeKind, string> = {
  oddiy: 'Bildirgi',
  davomat: 'Davomat bildirgisi',
  avtomatik: 'Avtomatik',
};

export const AUTO_NOTICE_REVOKED_LABEL = 'Bekor qilingan — soat 6 dan tushdi';

export const isNoticeReadonly = (n: Pick<Notice, 'kind'>): boolean => n.kind === 'avtomatik';
