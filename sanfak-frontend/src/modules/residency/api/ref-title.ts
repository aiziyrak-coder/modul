type TitledRef = { title?: string | null; name?: string | null } | string | null | undefined;

export const liveTitle = (ref: TitledRef): string | null =>
  ref && typeof ref === 'object' ? (ref.title ?? ref.name ?? null) : null;

export const titleOrSnapshot = (ref: TitledRef, snapshot?: string | null): string | null =>
  liveTitle(ref) ?? snapshot ?? null;

export const codeOrSnapshot = (
  ref: { code?: string | null } | string | null | undefined,
  snapshot?: string | null,
): string | null =>
  (ref && typeof ref === 'object' ? (ref.code ?? null) : null) ?? snapshot ?? null;

export const nameOrSnapshot = (
  liveName: string | null | undefined,
  snapshot?: string | null,
): string | null => {
  const live = (liveName ?? '').trim();
  const snap = (snapshot ?? '').trim();
  if (!live) return snap || null;
  if (!snap) return live;
  if (snap.length > live.length && snap.startsWith(`${live} `)) return snap;
  return live;
};
