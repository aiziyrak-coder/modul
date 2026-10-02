import type { ContentLang, LangRecord, NamedRef } from './admission-types';

const SUFFIX: Record<ContentLang, string> = { uz: 'Uz', ru: 'Ru', en: 'En' };

export const CONTENT_LANGS: ContentLang[] = ['uz', 'ru', 'en'];

export const langField = (base: string, lang: ContentLang): string => `${base}${SUFFIX[lang]}`;

export function pickLang(
  record: Record<string, string | undefined> | null | undefined,
  base: string,
  lang: ContentLang,
  fallback = '—',
): string {
  if (!record) return fallback;
  const preferred = record[langField(base, lang)];
  if (preferred) return preferred;
  return record[langField(base, 'uz')] || fallback;
}

export function refName(ref: NamedRef | null | undefined, lang: ContentLang, fallback = '—'): string {
  if (!ref) return fallback;
  return pickLang(ref as unknown as Record<string, string | undefined>, 'title', lang, fallback);
}

export function toOptions(
  items: NamedRef[] | undefined,
  lang: ContentLang,
): { value: string; label: string }[] {
  return (items ?? []).map((i) => ({ value: i.id, label: refName(i, lang) }));
}

export const recordName = (record: LangRecord, base: string, lang: ContentLang): string =>
  pickLang(record, base, lang);
