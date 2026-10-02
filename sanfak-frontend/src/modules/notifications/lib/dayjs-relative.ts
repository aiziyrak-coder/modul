import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/uz-latn';
import 'dayjs/locale/ru';
import 'dayjs/locale/en';
import type { Lang } from '@/shared/lib/i18n/config';

dayjs.extend(relativeTime);

const DAYJS_LOCALE: Record<Lang, string> = {
  uz: 'uz-latn',
  ru: 'ru',
  en: 'en',
};

export function fromNowLocalized(date: Date, lang: Lang): string {
  return dayjs(date).locale(DAYJS_LOCALE[lang]).fromNow();
}
