import { describe, expect, it } from 'vitest';
import {
  SCALAR_OWNER_ORDER,
  withAutoStream,
  classTypeSlugLabel,
  classTypeSlugsLabel,
  classTypeSlugsPayload,
  classTypesIntersect,
  plannedClassTypes,
  scalarOwnerSlug,
} from './class-type-slugs';

const t = (key: string) => `#${key}`;

const classTypes = [
  { slug: 'maruza', title: "Ma'ruza", stream: 2 },
  { slug: 'klinik_amaliyot', title: null, stream: 0 },
  { slug: 'seminar', title: 'Seminar', stream: 1 },
  { slug: 'laboratoriya', title: null, stream: 0 },
  { slug: 'amaliy', title: "Amaliy mashg'ulot", stream: 3 },
];

describe('class-type-slugs — plannedClassTypes / label', () => {
  it('faqat stream > 0 turlar, tartib saqlanadi; sarlavha blokdan, bo`lmasa i18n', () => {
    expect(plannedClassTypes(t, classTypes)).toEqual([
      { slug: 'maruza', title: "Ma'ruza" },
      { slug: 'seminar', title: 'Seminar' },
      { slug: 'amaliy', title: "Amaliy mashg'ulot" },
    ]);
    expect(classTypeSlugLabel(t, 'klinik_amaliyot')).toBe('#studyLoad.myWorkload.classType.clinicalPractice');
    expect(classTypeSlugLabel(t, 'noma_lum')).toBe('noma_lum');
    expect(classTypeSlugsLabel(t, ['maruza', 'seminar'])).toBe(
      '#studyLoad.myWorkload.classType.lecture, #studyLoad.myWorkload.classType.seminar',
    );
    expect(classTypeSlugsLabel(t, [])).toBe('');
  });
});

describe('class-type-slugs — scalarOwnerSlug (SHART #5, egasi Q1 = a)', () => {
  it('qat`iy tartib amaliy → seminar → laboratoriya → klinik; yo`q bo`lsa birinchi soatli; bo`sh → null', () => {
    expect(SCALAR_OWNER_ORDER).toEqual(['amaliy', 'seminar', 'laboratoriya', 'klinik_amaliyot']);
    expect(scalarOwnerSlug(['maruza', 'seminar', 'amaliy'])).toBe('amaliy');
    expect(scalarOwnerSlug(['maruza', 'seminar'])).toBe('seminar');
    expect(scalarOwnerSlug(['maruza'])).toBe('maruza');
    expect(scalarOwnerSlug([])).toBeNull();
  });
});

describe('class-type-slugs — classTypeSlugsPayload (SHART #3: hammasi → yuborilmaydi)', () => {
  const planned = ['maruza', 'seminar', 'amaliy'];
  it('qism tanlansa manba tartibida yuboriladi; hammasi/hech narsa → undefined', () => {
    expect(classTypeSlugsPayload(['amaliy', 'maruza'], planned)).toEqual(['maruza', 'amaliy']);
    expect(classTypeSlugsPayload(['maruza', 'seminar', 'amaliy'], planned)).toBeUndefined();
    expect(classTypeSlugsPayload([], planned)).toBeUndefined();
    expect(classTypeSlugsPayload(['maruza'], [])).toBeUndefined();
  });
});

describe('class-type-slugs — withAutoStream («E»)', () => {
  it('ma`ruza tanlangan + oqim yo`q + guruhlar bor → 1-oqim tanlangan guruhlardan; aks holda o`zgarmaydi', () => {
    expect(withAutoStream(['maruza'], ['g1', 'g2'], [])).toEqual([{ number: 1, groups: ['g1', 'g2'], language: null }]);
    expect(withAutoStream(['maruza'], ['g1'], [{ number: 1, groups: [] }])).toEqual([
      { number: 1, groups: ['g1'], language: null },
    ]);
    expect(withAutoStream(['maruza'], ['g1'], [{ number: 1, groups: ['g1'] }])).toEqual([{ number: 1, groups: ['g1'] }]);
    expect(withAutoStream(['amaliy'], ['g1'], [])).toBeUndefined();
    expect(withAutoStream([], ['g1'], [])).toBeUndefined();
    expect(withAutoStream(['maruza'], [], [])).toBeUndefined();
  });
});

describe('class-type-slugs — classTypesIntersect (D27 uchlik)', () => {
  it('[] hamma bilan kesishadi; ajratilgan to`plamlar kesishmaydi', () => {
    expect(classTypesIntersect([], ['maruza'])).toBe(true);
    expect(classTypesIntersect(['maruza'], [])).toBe(true);
    expect(classTypesIntersect(['maruza'], ['amaliy'])).toBe(false);
    expect(classTypesIntersect(['maruza', 'seminar'], ['seminar'])).toBe(true);
  });
});
