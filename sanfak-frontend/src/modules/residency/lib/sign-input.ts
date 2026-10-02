import type { ExpulsionOrder } from '../api/expulsion-order-types';
import { uzDayKey, uzToday } from './uz-day';

export const PAPER_NUMBER_MAX = 64;
export const REJECT_REASON_MIN = 3;
export const REJECT_REASON_MAX = 1000;
export const SCAN_MAX_BYTES = 10 * 1024 * 1024;
export const SCAN_ACCEPT = '.pdf,.jpg,.jpeg,.png';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const SCAN_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];
const SCAN_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export interface DateBounds {
  min: string | null;
  max: string;
}

export interface SignInputErrors {
  paperOrderNumber?: string;
  paperOrderDate?: string;
}

export function signDateBounds(
  order: Pick<ExpulsionOrder, 'origin' | 'draftedAt'>,
  now: Date = new Date(),
): DateBounds {
  return {
    min: order.origin === 'tizim' ? uzDayKey(order.draftedAt) : null,
    max: uzToday(now),
  };
}

export function isRealDay(value: string): boolean {
  if (!DAY_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function paperNumberError(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return 'Buyruq raqamini kiriting';
  if (trimmed.length > PAPER_NUMBER_MAX) return `Raqam ${PAPER_NUMBER_MAX} belgidan oshmasin`;
  return undefined;
}

function paperDateError(value: string, bounds: DateBounds): string | undefined {
  if (!value) return 'Buyruq sanasini tanlang';
  if (!isRealDay(value)) return "Sana noto'g'ri";
  if (value > bounds.max) return 'Sana bugundan kech bo‘lmasin';
  if (bounds.min && value < bounds.min) return 'Sana loyiha ochilgan kundan oldin bo‘lmasin';
  return undefined;
}

export function validateSignInput(
  input: { paperOrderNumber: string; paperOrderDate: string },
  bounds: DateBounds,
): SignInputErrors {
  const errors: SignInputErrors = {};
  const numberError = paperNumberError(input.paperOrderNumber);
  const dateError = paperDateError(input.paperOrderDate, bounds);
  if (numberError) errors.paperOrderNumber = numberError;
  if (dateError) errors.paperOrderDate = dateError;
  return errors;
}

export function validateRejectReason(reason: string): string | null {
  const length = reason.trim().length;
  if (length < REJECT_REASON_MIN) return `Sabab kamida ${REJECT_REASON_MIN} belgi bo‘lsin`;
  if (length > REJECT_REASON_MAX) return `Sabab ${REJECT_REASON_MAX} belgidan oshmasin`;
  return null;
}

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
};

export function validateScanFile(file: Pick<File, 'name' | 'size' | 'type'>): string | null {
  if (file.size > SCAN_MAX_BYTES) return 'Fayl hajmi 10 MB dan oshmasin';
  if (file.size === 0) return "Fayl bo'sh";
  const typeOk =
    SCAN_EXTENSIONS.includes(extensionOf(file.name)) || SCAN_MIME_TYPES.includes(file.type);
  return typeOk ? null : 'Faqat PDF, JPG yoki PNG fayl yuklang';
}
