import type { Vacancy } from '../model/types';

const LEAVE_TYPE_KEYS = ['leave', 'resignation', 'transfer'] as const;

type Translate = (key: string, opts?: Record<string, unknown>) => string;

function formatDate(value: string): string | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('uz-UZ');
}

export function vacancyReasonLabel(
  item: Pick<Vacancy, 'leave' | 'vacancyReason'>,
  t: Translate,
): string {
  const type = item.leave?.type ?? item.vacancyReason;
  if (!type) return '—';
  const typeLabel = (LEAVE_TYPE_KEYS as readonly string[]).includes(type)
    ? t(`studyLoad.vacancy.reason.${type}`)
    : type;
  const from = item.leave?.fromDate ? formatDate(item.leave.fromDate) : null;
  const to = item.leave?.toDate ? formatDate(item.leave.toDate) : null;
  if (from && to) return `${typeLabel}: ${from} – ${to}`;
  if (from) return `${typeLabel}: ${t('studyLoad.vacancy.reason.since', { date: from })}`;
  return typeLabel;
}
