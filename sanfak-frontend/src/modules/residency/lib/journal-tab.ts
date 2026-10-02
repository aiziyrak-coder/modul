export type JournalTab = 'kunlik' | 'tarix' | 'mashgulotlar';

export const SESSIONS_TAB_PATH = '/residency/davomat?tab=mashgulotlar';

export const sessionDetailPath = (id: string): string =>
  `/residency/davomat/mashgulot/${encodeURIComponent(id)}`;

export function parseJournalTab(raw: string | null, canAnnounce: boolean): JournalTab {
  if (raw === 'tarix') return 'tarix';
  if (raw === 'mashgulotlar' && canAnnounce) return 'mashgulotlar';
  return 'kunlik';
}

export function withJournalTab(params: URLSearchParams, tab: JournalTab): URLSearchParams {
  const next = new URLSearchParams(params);
  if (tab === 'kunlik') next.delete('tab');
  else next.set('tab', tab);
  return next;
}
