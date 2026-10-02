export const MAX_NATIONAL = 9;

export function toNational(raw: string): string {
  let digits = (raw ?? '').replace(/\D/g, '');
  if (digits.startsWith('998')) digits = digits.slice(3);
  return digits.slice(0, MAX_NATIONAL);
}

export function toDisplay(national: string): string {
  if (!national) return '';
  const groups = [
    national.slice(0, 2),
    national.slice(2, 5),
    national.slice(5, 7),
    national.slice(7, 9),
  ].filter(Boolean);
  return `+998 ${groups.join(' ')}`.trimEnd();
}

export function toStored(national: string): string {
  return national ? `+998${national}` : '';
}

export const isCompletePhone = (value?: string) => /^\+998\d{9}$/.test(value ?? '');
