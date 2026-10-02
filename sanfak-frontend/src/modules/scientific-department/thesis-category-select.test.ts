import { describe, expect, it } from 'vitest';
import manifest from './scientific-department.module';

const sources = import.meta.glob('./**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const thesesPage = sources['./pages/theses/index.tsx'];

describe('tezis toifasi select (TZ §5.5)', () => {
  it('toifalar TUR bo`yicha filtrlanadi', () => {
    expect(thesesPage, 'pages/theses topilmadi').toBeDefined();

    expect(thesesPage).toContain("Form.useWatch('type', form)");
    expect(thesesPage).toContain('useThesisCategories(formType)');
    expect(thesesPage).not.toContain('useThesisCategories()');
  });

  it('nom maydoni erkin Input emas, toifalardan Select', () => {
    expect(thesesPage).toContain('categories.map(');
    expect(thesesPage).not.toContain('theses.titlePlaceholder');
  });

  it('select matnlari uz/ru/en da bor', () => {
    const i18n = manifest.i18n as Record<string, Record<string, string>> | undefined;
    for (const k of ['categoryHint', 'categoryPlaceholder', 'categoryEmpty']) {
      for (const lang of ['uz', 'ru', 'en']) {
        const key = `scientificDepartment.theses.${k}`;
        expect(i18n?.[lang]?.[key], `${lang} tilida yo'q: ${key}`).toBeDefined();
      }
    }
  });
});
