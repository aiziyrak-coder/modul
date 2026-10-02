import { describe, expect, it } from 'vitest';
import manifest from './scientific-department.module';

const sources = import.meta.glob('./{pages,api,model}/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const read = (fragment: string) => {
  const entry = Object.entries(sources).find(([p]) => p.includes(fragment));
  expect(entry, `${fragment} topilmadi`).toBeDefined();
  return entry![1];
};

describe('maqola formasi — nashr qilingan sanasi', () => {
  it('yillar Select`i o`rnida DatePicker', () => {
    const src = read('/pages/articles/index.tsx');

    expect(src).toContain('name="publishedDate"');
    expect(src).toContain('format="YYYY-MM-DD"');
    expect(src).not.toContain('name="year"');
    expect(src).not.toContain('publishYearOptions');
  });

  it('so`rovga sana yuboriladi, yil emas', () => {
    const src = read('/pages/articles/index.tsx');
    expect(src).toMatch(/publishedDate: values\.publishedDate\.format\('YYYY-MM-DD'\)/);
    expect(src).not.toMatch(/year: values\.year/);
  });

  it('tahrirlashda mavjud sana formaga qaytadi', () => {
    const src = read('/pages/articles/index.tsx');
    expect(src).toMatch(/publishedDate: a\.publishedDate \? dayjs\(a\.publishedDate\) : undefined/);
  });

  it('multipart payloadda `publishedDate`, `year` yo`q', () => {
    const src = read('/api/article-api.ts');

    expect(src).toContain('publishedDate: v.publishedDate');
    expect(src).not.toMatch(/year: v\.year/);
    expect(src).toContain("publishedDate: doc.publishedDate ?? ''");
  });
});

describe('eski maqolalar (sanasiz) ham ko`rinadi', () => {
  it('jadval ustuni yilga qaytadi', () => {
    const src = read('/pages/articles/index.tsx');
    expect(src).toMatch(/row\.original\.publishedDate \|\| row\.original\.publishYear/);
  });

  it('detal sahifasi yilga qaytadi', () => {
    const src = read('/pages/article-detail/index.tsx');
    expect(src).toMatch(/article\.publishedDate \|\| article\.publishYear/);
  });

  it('`publishYear` tipi saqlanib qolgan (o`qish uchun kerak)', () => {
    const src = read('/model/types.ts');
    expect(src).toContain('publishYear: number | null;');
  });
});

describe('i18n kalitlari', () => {
  const i18n = manifest.i18n as Record<string, Record<string, string>> | undefined;

  it('uch tilda ham yorliq va placeholder bor', () => {
    expect(i18n, 'manifest i18n topilmadi').toBeDefined();

    for (const lang of ['uz', 'ru', 'en']) {
      expect(
        i18n?.[lang]?.['scientificDepartment.articles.publishDate'],
        `${lang}: publishDate yo'q`,
      ).toBeDefined();
      expect(
        i18n?.[lang]?.['scientificDepartment.articles.publishDatePlaceholder'],
        `${lang}: publishDatePlaceholder yo'q`,
      ).toBeDefined();
      expect(i18n?.[lang]?.['scientificDepartment.articles.colPublishYear']).toBeUndefined();
    }
  });

  it("o'zbekcha yorliq — «Nashr qilingan sanasi»", () => {
    expect(i18n?.uz?.['scientificDepartment.articles.publishDate']).toBe('Nashr qilingan sanasi');
  });
});
