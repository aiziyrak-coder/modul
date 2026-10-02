export function isFieldChanged(changedFields: string[], candidateKeys: string[]): boolean {
  if (changedFields.length === 0 || candidateKeys.length === 0) return false;
  return changedFields.some((changed) =>
    candidateKeys.some(
      (key) => changed === key || changed.startsWith(`${key}.`) || key.startsWith(`${changed}.`),
    ),
  );
}

const MONTHS_UZ_SHORT = [
  'Yan',
  'Fev',
  'Mar',
  'Apr',
  'May',
  'Iyun',
  'Iyul',
  'Avg',
  'Sen',
  'Okt',
  'Noy',
  'Dek',
];

export function formatSubmittedDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const day = d.getDate();
  const month = MONTHS_UZ_SHORT[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}. ${year}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('uz-UZ');
}

export function formatNotificationTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const day = d.getDate();
  const month = MONTHS_UZ_SHORT[d.getMonth()];
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day}-${month}. ${year} | ${hh}:${mm}`;
}

export function isNegativeNotification(eventType: string): boolean {
  return /reject|return|fail/i.test(eventType);
}
