import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import {
  buildBlockLabel,
  buildClassTypeItems,
  recalcClassTypeItems,
  countEffectiveStreams,
  recalcScalarItems,
  sumStudents,
  planAuditoriumOf,
  toCourseSemester,
} from './hours';
import type { ClassTypeItem } from './hours';
import type { WorkloadBlockOption } from '../../model/types';

type BlockInput = Pick<WorkloadBlockOption, 'classTypes' | 'studyWorkItems'>;

const t = ((key: string) => key) as unknown as TFunction;

const UZ_LABELS: Record<string, string> = {
  'studyLoad.common.courseN': '{{n}}-kurs',
  'studyLoad.common.semesterN': '{{n}}-semestr',
  'studyLoad.common.hoursN': '{{n}} soat',
};
const tUz = ((key: string, opts?: { n?: number | string }) =>
  UZ_LABELS[key]?.replace('{{n}}', String(opts?.n ?? '')) ?? key) as unknown as TFunction;

describe('buildClassTypeItems', () => {
  it('blok tanlanmagan bo\'lsa bo\'sh massiv qaytaradi', () => {
    expect(buildClassTypeItems(t, undefined)).toEqual([]);
  });

  it('classTypes va studyWorkItems dan real qiymatlarni o\'qiydi (canonical bo\'yicha)', () => {
    const block: BlockInput = {
      classTypes: [
        { slug: 'x', title: null, canonical: 'lecture', colNum: null, stream: 2, total: 34 },
        { slug: 'y', title: null, canonical: 'practical', colNum: null, stream: 1, total: 12 },
      ],
      studyWorkItems: [
        { slug: 'z', title: null, canonical: 'yan', colNum: null, value: 4 },
      ],
    };

    const result = buildClassTypeItems(t, block);

    expect(result.find((r) => r.slug === 'maruza')?.total).toBe(34);
    expect(result.find((r) => r.slug === 'amaliy')?.total).toBe(12);
    expect(result.find((r) => r.slug === 'yakuniy')?.total).toBe(4);
    expect(result.find((r) => r.slug === 'klinik')?.total).toBe(0);
    expect(result.find((r) => r.slug === 'laboratoriya')?.total).toBe(0);
    expect(result.find((r) => r.slug === 'oraliq')?.total).toBe(0);
    expect(result.find((r) => r.slug === 'qoldirilgan')?.total).toBe(0);
    expect(result.find((r) => r.slug === 'malakaviy')?.total).toBe(0);
    expect(result).toHaveLength(8);
  });

  it('canonical bo\'lmasa slug fallback orqali topadi (backend canonical null bo\'lsa)', () => {
    const block: BlockInput = {
      classTypes: [
        { slug: 'klinik_amaliyot', title: null, canonical: null, colNum: null, stream: 3, total: 18 },
      ],
      studyWorkItems: [
        { slug: 'on', title: null, canonical: null, colNum: null, value: 6 },
      ],
    };

    const result = buildClassTypeItems(t, block);

    expect(result.find((r) => r.slug === 'klinik')?.total).toBe(18);
    expect(result.find((r) => r.slug === 'oraliq')?.total).toBe(6);
  });
  it('dars turlarida `stream` ("Bir oqimga") ham o`qiladi', () => {
    const block: BlockInput = {
      classTypes: [
        { slug: 'x', title: null, canonical: 'lecture', colNum: null, stream: 10, total: 40 },
      ],
      studyWorkItems: [],
    };

    const maruza = buildClassTypeItems(t, block).find((r) => r.slug === 'maruza');
    expect(maruza?.stream).toBe(10);
    expect(maruza?.total).toBe(40);
  });

  it('skalyar bandlarda `stream` — `null` (oqim tushunchasi yo`q)', () => {
    const block: BlockInput = {
      classTypes: [],
      studyWorkItems: [{ slug: 'z', title: null, canonical: 'yan', colNum: null, value: 4 }],
    };

    const result = buildClassTypeItems(t, block);
    expect(result.find((r) => r.slug === 'yakuniy')?.stream).toBeNull();
    expect(result.find((r) => r.slug === 'yakuniy')?.total).toBe(4);
    expect(result.find((r) => r.slug === 'maruza')?.stream).toBe(0);
  });
});

describe('recalcClassTypeItems', () => {
  it('ma\'ruza: stream × oqimlar soni', () => {
    const items: ClassTypeItem[] = [{ slug: 'maruza', title: "Ma'ruza", stream: 10, total: 999 }];
    const result = recalcClassTypeItems(items, 2, 0);
    expect(result.find((r) => r.slug === 'maruza')?.total).toBe(20);
  });

  it('klinik: stream × guruhlar soni', () => {
    const items: ClassTypeItem[] = [
      { slug: 'klinik', title: "Klinik o'quv amaliyoti", stream: 8, total: 0 },
    ];
    const result = recalcClassTypeItems(items, 0, 4);
    expect(result.find((r) => r.slug === 'klinik')?.total).toBe(32);
  });

  it('skalyar band (`stream: null`) ko\'paytirilmaydi', () => {
    const items: ClassTypeItem[] = [
      { slug: 'yakuniy', title: 'Yakuniy nazorat', stream: null, total: 6 },
    ];
    const result = recalcClassTypeItems(items, 3, 3);
    expect(result.find((r) => r.slug === 'yakuniy')?.total).toBe(6);
    expect(result.find((r) => r.slug === 'yakuniy')?.stream).toBeNull();
  });

  it('oqim yoki guruh soni 0 bo\'lsa — backend formula bo\'yicha 0 (FE↔BE parity)', () => {
    const items: ClassTypeItem[] = [
      { slug: 'maruza', title: "Ma'ruza", stream: 10, total: 999 },
      { slug: 'klinik', title: "Klinik o'quv amaliyoti", stream: 8, total: 999 },
    ];
    const result = recalcClassTypeItems(items, 0, 0);
    expect(result.find((r) => r.slug === 'maruza')?.total).toBe(0);
    expect(result.find((r) => r.slug === 'klinik')?.total).toBe(0);
  });

  it('idempotent — `stream` hech qachon o\'zgarmaydi, ketma-ket chaqiruv to\'g\'ri natija beradi', () => {
    const items: ClassTypeItem[] = [{ slug: 'maruza', title: "Ma'ruza", stream: 10, total: 20 }];
    const once = recalcClassTypeItems(items, 2, 0);
    const twice = recalcClassTypeItems(once, 3, 0);
    expect(twice.find((r) => r.slug === 'maruza')?.stream).toBe(10);
    expect(twice.find((r) => r.slug === 'maruza')?.total).toBe(30);
  });
});

describe("countEffectiveStreams — bo'sh oqim sanalmaydi", () => {
  it('guruhsiz oqim hisobga kirmaydi', () => {
    expect(countEffectiveStreams([{ groups: [] }])).toBe(0);
    expect(countEffectiveStreams([{}])).toBe(0);
  });

  it('guruhli oqim sanaladi', () => {
    expect(countEffectiveStreams([{ groups: ['g1'] }])).toBe(1);
    expect(countEffectiveStreams([{ groups: ['g1', 'g2'] }])).toBe(1);
  });

  it('aralash holat — faqat guruhlilari sanaladi', () => {
    expect(
      countEffectiveStreams([{ groups: ['g1'] }, { groups: [] }, { groups: ['g2'] }]),
    ).toBe(2);
  });

  it("bo'sh ro'yxat — 0", () => {
    expect(countEffectiveStreams([])).toBe(0);
  });
});

describe('buildBlockLabel', () => {
  it('fan, kurs, semestr va jami soatni eski format bilan AYNAN bir xil quradi', () => {
    const label = buildBlockLabel(tUz, {
      scienceName: 'Ovqatlanish gigiyenasi',
      course: 1,
      semester: 1,
      totalHour: 120,
    });
    expect(label).toBe('Ovqatlanish gigiyenasi, 1-kurs, 1-semestr — 120 soat');
  });

  it('course=0 bo\'lsa kurs qismi tashlab yuboriladi', () => {
    const label = buildBlockLabel(tUz, {
      scienceName: 'Fan',
      course: 0,
      semester: 2,
      totalHour: 5,
    });
    expect(label).toBe('Fan, 2-semestr — 5 soat');
  });

  it("scienceName null bo'lsa ham qolgan qismlar saqlanadi", () => {
    const label = buildBlockLabel(tUz, {
      scienceName: null,
      course: 1,
      semester: 1,
      totalHour: 0,
    });
    expect(label).toBe('1-kurs, 1-semestr — 0 soat');
  });
});

describe('recalcScalarItems — ON/YAN/qoldirilgan talaba soniga qarab (P-24)', () => {
  const items = (planStream: number): ClassTypeItem[] => [
    { slug: 'maruza', title: 'M', stream: planStream, total: planStream * 2, backendSlug: 'maruza' },
    { slug: 'amaliy', title: 'A', stream: 0, total: 0, backendSlug: 'amaliy' },
    { slug: 'oraliq', title: 'ON', stream: null, total: 20, backendSlug: null },
    { slug: 'yakuniy', title: 'YAN', stream: null, total: 30, backendSlug: null },
    { slug: 'qoldirilgan', title: 'Q', stream: null, total: 10, backendSlug: null },
    { slug: 'malakaviy', title: 'MA', stream: null, total: 7, backendSlug: null },
  ];
  const bySlug = (list: ClassTypeItem[], slug: string) => list.find((i) => i.slug === slug)?.total;

  it('60 talaba, auditoriya 72 > 71.99, oxirgi semestr → 12 / 9 / 6; malakaviy tegilmaydi', () => {
    const out = recalcScalarItems(items(72), 60, { isLastSemester: true });
    expect(bySlug(out, 'oraliq')).toBe(12);
    expect(bySlug(out, 'yakuniy')).toBe(9);
    expect(bySlug(out, 'qoldirilgan')).toBe(6);
    expect(bySlug(out, 'malakaviy')).toBe(7);
    expect(bySlug(out, 'maruza')).toBe(144);
  });

  it('auditoriya ≤ 71.99 → ON = 0 (blanka sharti), qolganlari hisoblanadi', () => {
    const out = recalcScalarItems(items(71), 60, { isLastSemester: true });
    expect(bySlug(out, 'oraliq')).toBe(0);
    expect(bySlug(out, 'yakuniy')).toBe(9);
  });

  it('oxirgi semestr emas → YAN = 0', () => {
    const out = recalcScalarItems(items(72), 60, { isLastSemester: false });
    expect(bySlug(out, 'yakuniy')).toBe(0);
    expect(bySlug(out, 'oraliq')).toBe(12);
  });

  it('yaxlitlash backend `Math.round` bilan bir xil (44 talaba → ON 9, YAN round(6.6)=7, Q 4)', () => {
    const out = recalcScalarItems(items(100), 44, { isLastSemester: true });
    expect(bySlug(out, 'oraliq')).toBe(9);
    expect(bySlug(out, 'yakuniy')).toBe(7);
    expect(bySlug(out, 'qoldirilgan')).toBe(4);
  });

  it("QA holati (test4): 100 talabali blok 60/40 ga bo'linsa skalyar 27 / 18 (ilgari ikkalasida ham 60; YAN ÷2 dan oldin 36 / 24)", () => {
    const sum = (list: ClassTypeItem[]) =>
      list.filter((i) => i.stream === null && i.slug !== 'malakaviy').reduce((s, i) => s + i.total, 0);
    expect(sum(recalcScalarItems(items(100), 60, { isLastSemester: true }))).toBe(27);
    expect(sum(recalcScalarItems(items(100), 40, { isLastSemester: true }))).toBe(18);
  });

  it('F-11 (test4 15.09): 53 talaba → YAN round(53×0.3/2)=round(7.95)=8 (ilgari 16 — panel 129 vs saqlangan 121)', () => {
    const out = recalcScalarItems(items(100), 53, { isLastSemester: true });
    expect(bySlug(out, 'yakuniy')).toBe(8);
  });

  it('planAuditoriumOf — Σ stream (skalyar null hisobga olinmaydi)', () => {
    expect(planAuditoriumOf(items(50))).toBe(50);
  });
});

describe('toCourseSemester — yuklama global semestri → taqsimot kurs semestri (F-10)', () => {
  it('1→1 2→2 3→1 4→2 5→1 6→2', () => {
    expect([1, 2, 3, 4, 5, 6].map(toCourseSemester)).toEqual([1, 2, 1, 2, 1, 2]);
  });
  it("noto'g'ri/bo'sh qiymat → 1 (model default, xulq o'zgarmaydi)", () => {
    expect(toCourseSemester(0)).toBe(1);
    expect(toCourseSemester(null)).toBe(1);
    expect(toCourseSemester(undefined)).toBe(1);
    expect(toCourseSemester(2.5)).toBe(1);
  });
});

describe('sumStudents — tanlangan guruhlar talabalari (backend scopedStudent)', () => {
  const groups = [
    { id: 'g1', studentNumber: 30 },
    { id: 'g2', studentNumber: 30 },
    { id: 'g3', studentNumber: null },
  ];
  it("tanlanganlar yig'iladi, noma'lum/null → 0", () => {
    expect(sumStudents(['g1', 'g2'], groups)).toBe(60);
    expect(sumStudents(['g1', 'g3', 'yoq'], groups)).toBe(30);
    expect(sumStudents([], groups)).toBe(0);
  });
});
