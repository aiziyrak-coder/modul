import { useMemo } from 'react';
import { useTranslation } from '@/shared/lib/i18n';
import { REF_ROOTS, useAllLangRecords } from '../api/reference-api';
import { recordName } from '../model/content-lang';

export function useCountryLocalizer(): (name?: string) => string {
  const { lang } = useTranslation();
  const ref = useAllLangRecords(REF_ROOTS.countries);

  return useMemo(() => {
    const map = new Map<string, string>();
    for (const rec of ref.data ?? []) {
      map.set(recordName(rec, 'title', 'uz'), recordName(rec, 'title', lang));
    }
    return (name?: string) => (name ? (map.get(name) ?? name) : '—');
  }, [ref.data, lang]);
}
