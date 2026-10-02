import { AxiosError } from 'axios';
import { blobToText } from './blob-file';
import {
  RESIDENT_STATUS_LABEL,
  STATUS_LABEL,
  labelOf,
} from '../api/expulsion-order-types';

export interface OrderErrorInfo {
  status: number | null;
  reason: string | null;
  message: string;
  meta: Record<string, unknown>;
}

type Body = Record<string, unknown>;

const STANDARD_KEYS = new Set(['status', 'statusCode', 'message', 'detail', 'reason']);

const isRecord = (v: unknown): v is Body =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const text = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v : null;

function parseJson(raw: string | null): Body | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function readBody(data: unknown): Promise<Body | null> {
  if (data instanceof Blob) return parseJson(await blobToText(data));
  if (typeof data === 'string') return parseJson(data);
  return isRecord(data) ? data : null;
}

function statusFallback(status: number | null): string {
  if (status === null || status === 0) return "Server bilan aloqa yo'q";
  if (status === 403) return "Bu amal uchun ruxsatingiz yo'q";
  if (status === 404) return "Buyruq topilmadi yoki rezident o'chirilgan";
  if (status >= 500) return "Server xatosi — qayta urinib ko'ring";
  return "Amalni bajarib bo'lmadi";
}

const withSuffix = (base: string, suffix: string | null): string =>
  suffix ? `${base} ${suffix}` : base;

function enrichment(reason: string | null, meta: Body): string | null {
  switch (reason) {
    case 'paper_date_invalid':
      return `Ruxsat etilgan oraliq: ${String(meta.min ?? '—')} — ${String(meta.max ?? '—')}.`;
    case 'hours_below_threshold':
      return meta.hours === undefined ? null : `(joriy: ${String(meta.hours)} soat)`;
    case 'draft_year_closed':
      return `(${String(meta.countingYear ?? '—')}; joriy ${String(meta.current ?? '—')})`;
    case 'resident_not_signable':
      return `(rezident holati: ${labelOf(RESIDENT_STATUS_LABEL, text(meta.residentStatus))})`;
    case 'order_not_open':
      return `(joriy holat: ${labelOf(STATUS_LABEL, text(meta.currentStatus))})`;
    default:
      return null;
  }
}

function baseMessage(status: number | null, reason: string | null, body: Body | null): string {
  if (reason === 'order_not_found') return statusFallback(404);
  return text(body?.message) ?? text(body?.detail) ?? statusFallback(status);
}

function splitMeta(body: Body | null): Body {
  if (!body) return {};
  return Object.fromEntries(Object.entries(body).filter(([k]) => !STANDARD_KEYS.has(k)));
}

export async function describeOrderError(err: unknown): Promise<OrderErrorInfo> {
  if (!(err instanceof AxiosError)) {
    const message = err instanceof Error && err.message ? err.message : "Amalni bajarib bo'lmadi";
    return { status: null, reason: null, message, meta: {} };
  }
  const status = err.response?.status ?? null;
  const body = err.response ? await readBody(err.response.data) : null;
  const reason = text(body?.reason);
  const meta = splitMeta(body);
  const message = withSuffix(baseMessage(status, reason, body), enrichment(reason, meta));
  return { status, reason, message, meta };
}

export const REFRESH_REASONS: ReadonlySet<string> = new Set([
  'order_not_open',
  'scan_changed',
  'hours_below_threshold',
  'draft_year_closed',
  'scan_already_uploaded',
  'scan_limit',
  'resident_not_signable',
  'resident_inactive',
  'draft_not_ready',
  'draft_pdf_missing',
]);

export const shouldRefresh = (reason: string | null): boolean =>
  reason !== null && REFRESH_REASONS.has(reason);

export const needsRefetch = (info: Pick<OrderErrorInfo, 'status' | 'reason'>): boolean =>
  info.status === 404 || shouldRefresh(info.reason);
