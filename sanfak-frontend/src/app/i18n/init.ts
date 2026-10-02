import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '@/shared/lib/i18n/locales/en.json';
import ru from '@/shared/lib/i18n/locales/ru.json';
import uz from '@/shared/lib/i18n/locales/uz.json';
import { DEFAULT_LANG, LANG_STORAGE_KEY, type Lang } from '@/shared/lib/i18n';
import { buildI18nResources } from '@/app/modules/build-i18n';

const saved = (localStorage.getItem(LANG_STORAGE_KEY) as Lang | null) ?? DEFAULT_LANG;

const resources = buildI18nResources({
  en: { translation: en },
  ru: { translation: ru },
  uz: { translation: uz },
});

void i18n.use(initReactI18next).init({
  resources,
  lng: saved,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});
