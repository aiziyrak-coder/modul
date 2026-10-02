export const PHONE_NATIONAL_LENGTH = 9;

export function phoneToNational(raw: string | null | undefined): string {
  let digits = (raw ?? '').replace(/\D/g, '');
  if (digits.startsWith('998')) digits = digits.slice(3);
  return digits.slice(0, PHONE_NATIONAL_LENGTH);
}

export function phoneToDisplay(raw: string | null | undefined): string {
  const n = phoneToNational(raw);
  if (!n) return '';
  const parts = [n.slice(0, 2), n.slice(2, 5), n.slice(5, 7), n.slice(7, 9)].filter(Boolean);
  const [op, a, b, c] = parts;
  let out = `+998 ${op}`;
  if (a) out += ` ${a}`;
  if (b) out += `-${b}`;
  if (c) out += `-${c}`;
  return out;
}

export function phoneToStored(raw: string | null | undefined): string {
  const n = phoneToNational(raw);
  return n ? `+998${n}` : '';
}

export function isPhoneComplete(raw: string | null | undefined): boolean {
  return phoneToNational(raw).length === PHONE_NATIONAL_LENGTH;
}

export const JSHSHIR_LENGTH = 14;

export function jshshirMask(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '').slice(0, JSHSHIR_LENGTH);
}

export function isJshshirComplete(raw: string | null | undefined): boolean {
  return jshshirMask(raw).length === JSHSHIR_LENGTH;
}

export const MONEY_SEPARATOR = ' ';

export function moneyToRaw(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return digits;
}

export function moneyToDisplay(raw: string | null | undefined): string {
  const d = moneyToRaw(raw);
  if (!d) return '';
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, MONEY_SEPARATOR);
}

export function moneyToNumber(raw: string | null | undefined): number | null {
  const d = moneyToRaw(raw);
  return d ? Number(d) : null;
}

export const moneyFormatter = (value: string | number | undefined): string =>
  moneyToDisplay(value == null ? '' : String(value));

export const moneyParser = (display: string | undefined): number =>
  Number(moneyToRaw(display));
