import type { Lang } from '@/shared/lib/module';
import { registeredModules } from './registry';

export type I18nResources = Record<Lang, { translation: Record<string, string> }>;

export function buildI18nResources(
  base: I18nResources,
): I18nResources {
  const out: I18nResources = {
    uz: { translation: { ...base.uz.translation } },
    ru: { translation: { ...base.ru.translation } },
    en: { translation: { ...base.en.translation } },
  };

  for (const { folder, manifest } of registeredModules) {
    for (const lang of ['uz', 'ru', 'en'] as const) {
      const entries = manifest.i18n?.[lang];
      if (!entries) continue;
      for (const [key, value] of Object.entries(entries)) {
        if (out[lang].translation[key] !== undefined) {
          console.warn(
            `[i18n] Duplicate key "${key}" (${lang}) — module "${folder}" overrides earlier value.`,
          );
        }
        out[lang].translation[key] = value;
      }
    }
  }

  return out;
}
