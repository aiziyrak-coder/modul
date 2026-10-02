export const SUPPORTED_LANGS = ['uz', 'ru', 'en'] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

export const LANG_STORAGE_KEY = 'platform-lang';
export const DEFAULT_LANG: Lang = 'uz';

export const LANG_LABELS: Record<Lang, string> = {
  uz: "O'zbekcha",
  ru: 'Русский',
  en: 'English',
};
