import { useTranslation as useI18next } from 'react-i18next';
import { LANG_STORAGE_KEY, SUPPORTED_LANGS, type Lang } from './config';

export function useTranslation() {
  const { t, i18n } = useI18next();

  const changeLanguage = (lang: Lang) => {
    void i18n.changeLanguage(lang);
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  };

  return { t, lang: i18n.language as Lang, changeLanguage, langs: SUPPORTED_LANGS };
}
