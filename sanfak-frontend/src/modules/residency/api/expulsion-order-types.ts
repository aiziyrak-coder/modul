import type { ResidentBrief } from './types';

export type ExpulsionOrderStatus = 'loyiha' | 'imzolangan' | 'bekor_qilingan' | 'rad_etilgan';
export type ExpulsionOrderOrigin = 'tizim' | 'meros';
export type ResidentLifeStatus = 'oquvda' | 'chetlatilgan' | 'akademik_tatil';

export const EXPULSION_ORDER_STATUSES: readonly ExpulsionOrderStatus[] = [
  'loyiha',
  'imzolangan',
  'bekor_qilingan',
  'rad_etilgan',
];
export const EXPULSION_ORDER_ORIGINS: readonly ExpulsionOrderOrigin[] = ['tizim', 'meros'];
export const RESIDENT_LIFE_STATUSES: readonly ResidentLifeStatus[] = [
  'oquvda',
  'chetlatilgan',
  'akademik_tatil',
];

export interface ExpulsionOrderFlags {
  canUploadScan: boolean;
  canReject: boolean;
  canSign: boolean;
  needsResume: boolean;
  canResume: boolean;
  canGetDraftPdf: boolean;
}

export interface ExpulsionScan {
  fileName: string;
  mimeType: string | null;
  size: number;
  sha256: string;
  uploadedByName: string | null;
  uploadedAt: string | null;
}

export interface ExpulsionDraftPdf {
  fileName: string;
  size: number;
  sha256: string;
  hours: number | null;
  templateVersion: number | null;
  generatedAt: string | null;
  generatedByName: string | null;
}

export interface ExpulsionHistoryItem {
  at: string | null;
  action: string;
  source: string;
  actorName: string | null;
  hours: number | null;
  note: string | null;
}

export interface ExpulsionOrder {
  id: string;
  resident: ResidentBrief | null;
  residentStatus: ResidentLifeStatus | null;
  residentHours: number | null;
  residentActive: boolean;
  residentName: string;
  origin: ExpulsionOrderOrigin | null;
  status: ExpulsionOrderStatus | null;
  countingYear: string | null;
  draftedAt: string | null;
  hoursAtDraft: number | null;
  noticesSentAt: string | null;
  closedAt: string | null;
  closedByName: string | null;
  closeReason: string | null;
  closeNote: string | null;
  hoursAtClose: number | null;
  paperOrderNumber: string | null;
  paperOrderDate: string | null;
  scan: ExpulsionScan | null;
  draftPdf: ExpulsionDraftPdf | null;
  signedAt: string | null;
  signedByName: string | null;
  hoursAtSign: number | null;
  eriSerialNumber: string | null;
  eriSignedAt: string | null;
  residentAppliedAt: string | null;
  basisLostAt: string | null;
  hoursAtBasisLost: number | null;
  history: ExpulsionHistoryItem[];
  createdAt: string | null;
  flags: ExpulsionOrderFlags;
}

export const STATUS_LABEL: Record<ExpulsionOrderStatus, string> = {
  loyiha: 'Qaror kutilmoqda',
  imzolangan: 'Imzolangan',
  rad_etilgan: 'Rad etilgan',
  bekor_qilingan: 'Bekor qilingan',
};

export const STATUS_VARIANT: Record<ExpulsionOrderStatus, string> = {
  loyiha: 'warning',
  imzolangan: 'danger',
  rad_etilgan: 'info',
  bekor_qilingan: 'nofaol',
};

export const ORIGIN_LABEL: Record<ExpulsionOrderOrigin, string> = {
  tizim: 'Tizim (72 soat)',
  meros: 'Meros',
};

export const CLOSE_REASON_LABEL: Record<string, string> = {
  soat_72_dan_past: 'Sababsiz soat 72 dan tushdi',
  yangi_oquv_yili: "Yangi o'quv yili boshlandi",
  rezident_ochirildi: "Rezident o'chirildi",
  migratsiya_qaytarildi: 'Migratsiya qaytarildi',
  imzolangan_buyruq_bor: 'Rezidentda imzolangan buyruq allaqachon bor',
  yaroqsiz_loyiha: 'Yaroqsiz loyiha',
};

export const HISTORY_ACTION_LABEL: Record<string, string> = {
  yaratildi: 'Loyiha ochildi',
  migratsiya: 'Meros loyiha (migratsiya)',
  bekor_qilindi: 'Bekor qilindi',
  skan_yuklandi: 'Skan yuklandi',
  imzolandi: 'Imzolandi',
  rad_etildi: 'Rad etildi',
  asos_72_dan_past: 'Imzodan keyin soat 72 dan tushdi',
  pdf_yaratildi: "Loyiha PDF'i yaratildi",
};

export const HISTORY_SOURCE_LABEL: Record<string, string> = {
  attendance: 'Davomat',
  cron: 'Kunlik tekshiruv',
  application: 'Ariza',
  resident_delete: "Rezident o'chirilishi",
  migration: 'Migratsiya',
  office: "Bo'lim",
  runbook: "Qo'lda tuzatish",
  sams: 'SAMS davomati',
};

export const RESIDENT_STATUS_LABEL: Record<ResidentLifeStatus, string> = {
  oquvda: "O'qimoqda",
  chetlatilgan: 'Chetlatilgan',
  akademik_tatil: "Akademik ta'til",
};

export function labelOf(map: Readonly<Record<string, string>>, key: string | null | undefined): string {
  if (key === null || key === undefined || key === '') return '—';
  return map[key] ?? key;
}
