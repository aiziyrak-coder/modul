import type { SamsDay, SamsOutageDraft, SamsOutagePayload } from '../api/sams-status-types';
import { daySpan, isDayKey } from './sams-cell-state';

export const OUTAGE_REASON_MIN = 3;
export const OUTAGE_REASON_MAX = 500;
export const OUTAGE_MAX_SPAN_DAYS = 366;
export const OUTAGE_ALL_CLINICS = '*';

export function validateOutageReason(reason: string): string | null {
  const length = reason.trim().length;
  if (length < OUTAGE_REASON_MIN) return `Sabab kamida ${OUTAGE_REASON_MIN} belgi bo‘lsin`;
  if (length > OUTAGE_REASON_MAX) return `Sabab ${OUTAGE_REASON_MAX} belgidan oshmasin`;
  return null;
}

export function outageSpanDays(from: SamsDay, to: SamsDay): number | null {
  return daySpan(from, to);
}

function validateRange(from: SamsDay, to: SamsDay, today: SamsDay | null): string | null {
  if (!from || !to) return 'Boshlanish va tugash sanasini tanlang';
  if (!isDayKey(from) || !isDayKey(to)) return 'Sana YYYY-MM-DD ko‘rinishida bo‘lsin';
  if (from > to) return 'Boshlanish sanasi tugash sanasidan keyin bo‘lmasin';
  if (today && to > today)
    return 'Uzilish kelajakka e’lon qilinmaydi (tugash sanasi bugundan keyin)';
  const span = outageSpanDays(from, to) ?? 0;
  if (span > OUTAGE_MAX_SPAN_DAYS) return `Oraliq ${OUTAGE_MAX_SPAN_DAYS} kundan oshmasin`;
  return null;
}

export function validateOutageDraft(draft: SamsOutageDraft, today: SamsDay | null): string | null {
  if (!draft.dbname) return 'Klinikani yoki «Barcha klinikalar»ni tanlang';
  return validateRange(draft.from, draft.to, today) ?? validateOutageReason(draft.reason);
}

export function outageScopeLabel(
  dbname: string,
  clinics: readonly { dbname: string; orgTitle: string }[],
): string | null {
  if (!dbname) return null;
  if (dbname === OUTAGE_ALL_CLINICS) return 'barcha klinikalar';
  return clinics.find((c) => c.dbname === dbname)?.orgTitle ?? dbname;
}

export function toCreateOutagePayload(draft: SamsOutageDraft): SamsOutagePayload {
  return {
    from: draft.from,
    to: draft.to,
    dbname: draft.dbname === OUTAGE_ALL_CLINICS ? null : draft.dbname,
    reason: draft.reason.trim(),
  };
}
