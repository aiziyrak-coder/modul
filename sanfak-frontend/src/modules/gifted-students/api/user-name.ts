export interface RawUserName {
  firstName?: string;
  lastName?: string;
  middleName?: string;
}

export type MaybeUserName = string | RawUserName | null | undefined;

export const nameOf = (u: MaybeUserName): string | null => {
  if (!u || typeof u !== 'object') return null;
  const parts = [u.lastName, u.firstName, u.middleName]
    .map((p) => (p ?? '').trim())
    .filter(Boolean);
  return parts.length ? parts.join(' ') : null;
};
