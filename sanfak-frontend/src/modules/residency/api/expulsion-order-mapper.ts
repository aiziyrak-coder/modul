import { mapResidentBrief, type BackendResident } from './mapper';
import { nameOf, type MaybeUserName } from './user-name';
import { nameOrSnapshot } from './ref-title';
import {
  EXPULSION_ORDER_ORIGINS,
  EXPULSION_ORDER_STATUSES,
  RESIDENT_LIFE_STATUSES,
  type ExpulsionDraftPdf,
  type ExpulsionHistoryItem,
  type ExpulsionOrder,
  type ExpulsionOrderFlags,
  type ExpulsionScan,
} from './expulsion-order-types';

type BackendOrderResident = Partial<BackendResident> & {
  _id: string;
  status?: string | null;
};

interface BackendScan {
  fileName?: string | null;
  mimeType?: string | null;
  size?: number | null;
  sha256?: string | null;
  uploadedBy?: MaybeUserName;
  uploadedByName?: string | null;
  uploadedAt?: string | null;
}

interface BackendDraftPdf {
  fileName?: string | null;
  size?: number | null;
  sha256?: string | null;
  hours?: number | null;
  templateVersion?: number | null;
  generatedAt?: string | null;
  generatedBy?: MaybeUserName;
  generatedByName?: string | null;
}

interface BackendHistoryItem {
  at?: string | null;
  action?: string | null;
  source?: string | null;
  actorName?: string | null;
  hours?: number | null;
  note?: string | null;
}

export interface BackendExpulsionOrder {
  _id: string;
  resident?: BackendOrderResident | string | null;
  residentName?: string | null;
  origin?: string | null;
  status?: string | null;
  countingYear?: string | null;
  draftedAt?: string | null;
  hoursAtDraft?: number | null;
  noticesSentAt?: string | null;
  closedAt?: string | null;
  closedBy?: MaybeUserName;
  closedByName?: string | null;
  closeReason?: string | null;
  closeNote?: string | null;
  hoursAtClose?: number | null;
  paperOrderNumber?: string | null;
  paperOrderDate?: string | null;
  scan?: BackendScan | null;
  signedAt?: string | null;
  signedBy?: MaybeUserName;
  signedByName?: string | null;
  hoursAtSign?: number | null;
  eriSerialNumber?: string | null;
  eriSignedAt?: string | null;
  residentAppliedAt?: string | null;
  basisLostAt?: string | null;
  hoursAtBasisLost?: number | null;
  draftPdf?: BackendDraftPdf | null;
  history?: BackendHistoryItem[] | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  canUploadScan?: unknown;
  canReject?: unknown;
  canSign?: unknown;
  needsResume?: unknown;
  canResume?: unknown;
  canGetDraftPdf?: unknown;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;
const flag = (v: unknown): boolean => v === true;

function oneOf<T extends string>(values: readonly T[], v: unknown): T | null {
  return typeof v === 'string' && (values as readonly string[]).includes(v) ? (v as T) : null;
}

const populated = (r: BackendExpulsionOrder['resident']): BackendOrderResident | null =>
  r && typeof r === 'object' ? r : null;

const SCAN_FALLBACK_NAME = 'buyruq-skan';

function mapScan(s: BackendScan | null | undefined): ExpulsionScan | null {
  const sha256 = str(s?.sha256);
  if (!s || !sha256) return null;
  return {
    fileName: str(s.fileName) ?? SCAN_FALLBACK_NAME,
    mimeType: str(s.mimeType),
    size: num(s.size) ?? 0,
    sha256,
    uploadedByName: nameOrSnapshot(nameOf(s.uploadedBy), s.uploadedByName),
    uploadedAt: str(s.uploadedAt),
  };
}

function mapDraftPdf(d: BackendDraftPdf | null | undefined): ExpulsionDraftPdf | null {
  const fileName = str(d?.fileName);
  const sha256 = str(d?.sha256);
  if (!d || !fileName || !sha256) return null;
  return {
    fileName,
    size: num(d.size) ?? 0,
    sha256,
    hours: num(d.hours),
    templateVersion: num(d.templateVersion),
    generatedAt: str(d.generatedAt),
    generatedByName: nameOrSnapshot(nameOf(d.generatedBy), d.generatedByName),
  };
}

const mapHistoryItem = (h: BackendHistoryItem): ExpulsionHistoryItem => ({
  at: str(h.at),
  action: str(h.action) ?? '',
  source: str(h.source) ?? '',
  actorName: str(h.actorName),
  hours: num(h.hours),
  note: str(h.note),
});

const mapFlags = (b: BackendExpulsionOrder): ExpulsionOrderFlags => ({
  canUploadScan: flag(b.canUploadScan),
  canReject: flag(b.canReject),
  canSign: flag(b.canSign),
  needsResume: flag(b.needsResume),
  canResume: flag(b.canResume),
  canGetDraftPdf: flag(b.canGetDraftPdf),
});

type ResidentPart = Pick<
  ExpulsionOrder,
  'resident' | 'residentStatus' | 'residentHours' | 'residentActive' | 'residentName'
>;

function mapResidentPart(b: BackendExpulsionOrder): ResidentPart {
  const r = populated(b.resident);
  return {
    resident: r ? mapResidentBrief(r as BackendResident) : null,
    residentStatus: oneOf(RESIDENT_LIFE_STATUSES, r?.status),
    residentHours: num(r?.totalUnexcusedHours),
    residentActive: r?.active !== false,
    residentName: str(r?.fullName) ?? str(b.residentName) ?? '—',
  };
}

type DecisionPart = Pick<
  ExpulsionOrder,
  | 'closedAt' | 'closedByName' | 'closeReason' | 'closeNote' | 'hoursAtClose'
  | 'paperOrderNumber' | 'paperOrderDate' | 'signedAt' | 'signedByName' | 'hoursAtSign'
  | 'eriSerialNumber' | 'eriSignedAt' | 'residentAppliedAt' | 'basisLostAt' | 'hoursAtBasisLost'
>;

const mapDecisionPart = (b: BackendExpulsionOrder): DecisionPart => ({
  closedAt: str(b.closedAt),
  closedByName: nameOrSnapshot(nameOf(b.closedBy), b.closedByName),
  closeReason: str(b.closeReason),
  closeNote: str(b.closeNote),
  hoursAtClose: num(b.hoursAtClose),
  paperOrderNumber: str(b.paperOrderNumber),
  paperOrderDate: str(b.paperOrderDate),
  signedAt: str(b.signedAt),
  signedByName: nameOrSnapshot(nameOf(b.signedBy), b.signedByName),
  hoursAtSign: num(b.hoursAtSign),
  eriSerialNumber: str(b.eriSerialNumber),
  eriSignedAt: str(b.eriSignedAt),
  residentAppliedAt: str(b.residentAppliedAt),
  basisLostAt: str(b.basisLostAt),
  hoursAtBasisLost: num(b.hoursAtBasisLost),
});

export function mapExpulsionOrder(b: BackendExpulsionOrder): ExpulsionOrder {
  return {
    id: b._id,
    ...mapResidentPart(b),
    origin: oneOf(EXPULSION_ORDER_ORIGINS, b.origin),
    status: oneOf(EXPULSION_ORDER_STATUSES, b.status),
    countingYear: str(b.countingYear),
    draftedAt: str(b.draftedAt),
    hoursAtDraft: num(b.hoursAtDraft),
    noticesSentAt: str(b.noticesSentAt),
    ...mapDecisionPart(b),
    scan: mapScan(b.scan),
    draftPdf: mapDraftPdf(b.draftPdf),
    history: (b.history ?? []).map(mapHistoryItem),
    createdAt: str(b.createdAt),
    flags: mapFlags(b),
  };
}

export interface SignInput {
  paperOrderNumber: string;
  paperOrderDate: string;
  scanSha256: string;
  eriSignature?: string | null;
}

export interface SignPayload {
  orderId: string;
  paperOrderNumber: string;
  paperOrderDate: string;
  scanSha256: string;
  eriSignature?: string;
}

export function toSignPayload(orderId: string, input: SignInput): SignPayload {
  const payload: SignPayload = {
    orderId,
    paperOrderNumber: input.paperOrderNumber.trim(),
    paperOrderDate: input.paperOrderDate,
    scanSha256: input.scanSha256,
  };
  if (input.eriSignature) payload.eriSignature = input.eriSignature;
  return payload;
}

export function toResumePayload(order: ExpulsionOrder): SignPayload | null {
  const { paperOrderNumber, paperOrderDate } = order;
  const scanSha256 = order.scan?.sha256;
  if (!paperOrderNumber || !paperOrderDate || !scanSha256) return null;
  return { orderId: order.id, paperOrderNumber, paperOrderDate, scanSha256 };
}

export const draftFallbackName = (id: string): string =>
  `chetlatish-buyrugi-loyihasi-${id.slice(-6)}.pdf`;
