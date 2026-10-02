export const SAFE_LINK_RX = /^(https?:\/\/\S+|\/files\/\S+)$/i;

export function isSafeLink(value: string | null | undefined): value is string {
  return typeof value === 'string' && SAFE_LINK_RX.test(value.trim());
}

export function isValidOptionalLink(value: string): boolean {
  const v = value.trim();
  return v === '' || SAFE_LINK_RX.test(v);
}
