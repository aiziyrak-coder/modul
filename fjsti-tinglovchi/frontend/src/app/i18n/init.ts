import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LANG, LANG_STORAGE_KEY, SUPPORTED_LANGS, type Lang } from '@/shared/lib/i18n';
import uz from '@/shared/lib/i18n/locales/uz.json';
import ru from '@/shared/lib/i18n/locales/ru.json';
import en from '@/shared/lib/i18n/locales/en.json';
import { qualTranslations } from '@/qual/i18n';

const base: Record<Lang, Record<string, string>> = {
  uz: uz as Record<string, string>,
  ru: ru as Record<string, string>,
  en: en as Record<string, string>,
};

const resources = Object.fromEntries(
  SUPPORTED_LANGS.map((lang) => [
    lang,
    {
      translation: {
        ...base[lang],
        ...((qualTranslations as Record<string, Record<string, string>>)[lang] ?? {}),
      },
    },
  ]),
);

const stored = (localStorage.getItem(LANG_STORAGE_KEY) as Lang | null) ?? DEFAULT_LANG;

void i18n.use(initReactI18next).init({
  resources,
  lng: SUPPORTED_LANGS.includes(stored) ? stored : DEFAULT_LANG,
  fallbackLng: DEFAULT_LANG,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
