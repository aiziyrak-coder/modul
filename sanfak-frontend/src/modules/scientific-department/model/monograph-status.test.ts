import { describe, expect, it } from 'vitest';
import { getMonographRoleStatus } from './role-status';
import type { Monograph } from './types';
import manifest from '../scientific-department.module';

const mono = (over: Partial<Record<string, unknown>>): Monograph =>
  ({
    status: 'pending',
    ilmiyApproved: false,
    kotibSigned: false,
    prorektorSigned: false,
    ssvSent: false,
    ssvReceived: false,
    teacherConfirmed: false,
    dataApproved: false,
    ...over,
  }) as unknown as Monograph;

const STAGES: ReadonlyArray<{ label: string; doc: Monograph; expected: string }> = [
  { label: 'yangi', doc: mono({ status: 'new' }), expected: 'new' },
  { label: 'ilmiy tasdiqladi', doc: mono({ ilmiyApproved: true }), expected: 'pending' },
  {
    label: 'prorektor imzoladi',
    doc: mono({ ilmiyApproved: true, kotibSigned: true, prorektorSigned: true }),
    expected: 'ssvSendPending',
  },
  { label: 'SSV ga yuborildi', doc: mono({ prorektorSigned: true, ssvSent: true }), expected: 'ssvSent' },
  {
    label: 'SSV javobi keldi',
    doc: mono({ prorektorSigned: true, ssvSent: true, ssvReceived: true }),
    expected: 'ssvReceived',
  },
  {
    label: "o'qituvchi ma'lumot to'ldirdi",
    doc: mono({ ssvSent: true, ssvReceived: true, teacherConfirmed: true }),
    expected: 'finalReview',
  },
  {
    label: 'ilmiy data-tasdiq',
    doc: mono({ ssvReceived: true, teacherConfirmed: true, dataApproved: true }),
    expected: 'approved',
  },
  { label: 'rad etilgan', doc: mono({ status: 'rejected' }), expected: 'rejected' },
];

describe('monografiya statuslari (o`qituvchi ko`rinishi)', () => {
  it.each(STAGES)('$label → $expected', ({ doc, expected }) => {
    expect(getMonographRoleStatus(doc, 'teacher')).toBe(expected);
  });

  it('reference UI dagi 8 xil status qamrab olingan (takror yo`q)', () => {
    const got = STAGES.map((s) => getMonographRoleStatus(s.doc, 'teacher'));
    expect(new Set(got).size).toBe(8);
  });

  it('har bir statusning tarjimasi uz/ru/en da bor', () => {
    const i18n = manifest.i18n as Record<string, Record<string, string>> | undefined;
    expect(i18n, 'manifest i18n topilmadi').toBeDefined();

    for (const { expected } of STAGES) {
      const key = `scientificDepartment.status.${expected}`;
      for (const lang of ['uz', 'ru', 'en']) {
        expect(i18n?.[lang]?.[key], `${lang} tilida yo'q: ${key}`).toBeDefined();
      }
    }
  });

  it("o'qituvchiga `kotibApproved` KO'RSATILMAYDI (u ichki bosqich)", () => {
    const got = STAGES.map((s) => getMonographRoleStatus(s.doc, 'teacher'));
    expect(got).not.toContain('kotibApproved');
    expect(
      getMonographRoleStatus(mono({ ilmiyApproved: true, kotibSigned: true }), 'teacher'),
    ).toBe('pending');
  });
});

describe('monografiya statuslari (Ilmiy bo`lim ko`rinishi)', () => {
  const ILMIY: ReadonlyArray<{ label: string; doc: Monograph; expected: string }> = [
    { label: 'ilmiy tasdiqladi (kotib kutilmoqda)', doc: mono({ ilmiyApproved: true }), expected: 'pending' },
    {
      label: 'kotib imzoladi (prorektor kutilmoqda)',
      doc: mono({ ilmiyApproved: true, kotibSigned: true }),
      expected: 'kotibApproved',
    },
    {
      label: 'prorektor imzoladi',
      doc: mono({ ilmiyApproved: true, kotibSigned: true, prorektorSigned: true }),
      expected: 'prorektorApproved',
    },
  ];

  it.each(ILMIY)('$label → $expected', ({ doc, expected }) => {
    expect(getMonographRoleStatus(doc, 'ilmiy')).toBe(expected);
  });

  it('ketma-ket bosqichlar bir-biridan FARQ qiladi (asosiy maqsad)', () => {
    const got = ILMIY.map((s) => getMonographRoleStatus(s.doc, 'ilmiy'));
    expect(new Set(got).size).toBe(3);
  });

  it('kotib o`zi imzolagach `kotibApproved` ko`radi', () => {
    expect(getMonographRoleStatus(mono({ kotibSigned: true }), 'kotib')).toBe('kotibApproved');
  });

  it('`kotibApproved` tarjimasi uz/ru/en da bor', () => {
    const i18n = manifest.i18n as Record<string, Record<string, string>> | undefined;
    const key = 'scientificDepartment.status.kotibApproved';
    for (const lang of ['uz', 'ru', 'en']) {
      expect(i18n?.[lang]?.[key], `${lang} tilida yo'q: ${key}`).toBeDefined();
    }
  });
});

describe('monografiya "nomi biriktirilmagan" izohlari', () => {
  const LANGS = ['uz', 'ru', 'en'];
  const i18n = () => manifest.i18n as Record<string, Record<string, string>> | undefined;

  it('uchala kalit ham uz/ru/en da bor', () => {
    for (const k of ['noTitle', 'noTitleSsvPending', 'noTitleDataPending']) {
      for (const lang of LANGS) {
        const key = `scientificDepartment.monographs.${k}`;
        expect(i18n()?.[lang]?.[key], `${lang} tilida yo'q: ${key}`).toBeDefined();
      }
    }
  });

  it('umumiy `noTitle` bosqichga bog`liq iborani O`Z ICHIGA OLMAYDI', () => {
    for (const lang of LANGS) {
      const v = (i18n()?.[lang]?.['scientificDepartment.monographs.noTitle'] ?? '').toLowerCase();
      expect(v, `${lang}: umumiy yorliqda bosqich nomi bor`).not.toMatch(
        /ssv|минздрав|ministry/,
      );
    }
  });

  it('bosqichli kalitlar bir-biridan farq qiladi', () => {
    for (const lang of LANGS) {
      const ssv = i18n()?.[lang]?.['scientificDepartment.monographs.noTitleSsvPending'];
      const data = i18n()?.[lang]?.['scientificDepartment.monographs.noTitleDataPending'];
      expect(ssv, lang).not.toBe(data);
    }
  });
});

describe('fayllar bo`limi sarlavhalari (bosqichga bog`liq)', () => {
  const LANGS = ['uz', 'ru', 'en'];
  const i18n = () => manifest.i18n as Record<string, Record<string, string>> | undefined;

  const PAIRS = [
    { before: 'monographs.uploadedFiles', after: 'monographs.approvedDocuments' },
    { before: 'methodical.attachedFiles', after: 'methodical.approvedDocuments' },
  ];

  it('har bir juftlik uchala tilda mavjud', () => {
    for (const { before, after } of PAIRS) {
      for (const k of [before, after]) {
        for (const lang of LANGS) {
          const key = `scientificDepartment.${k}`;
          expect(i18n()?.[lang]?.[key], `${lang} tilida yo'q: ${key}`).toBeDefined();
        }
      }
    }
  });

  it('tasdiqdan OLDINGI sarlavha "tasdiqlangan" demaydi', () => {
    for (const { before } of PAIRS) {
      for (const lang of LANGS) {
        const v = (i18n()?.[lang]?.[`scientificDepartment.${before}`] ?? '').toLowerCase();
        expect(v, `${lang}: ${before}`).not.toMatch(/tasdiq|утверж|approved/);
      }
    }
  });

  it('juftlikdagi ikki matn bir xil emas', () => {
    for (const { before, after } of PAIRS) {
      for (const lang of LANGS) {
        expect(
          i18n()?.[lang]?.[`scientificDepartment.${before}`],
          `${lang}: ${before}`,
        ).not.toBe(i18n()?.[lang]?.[`scientificDepartment.${after}`]);
      }
    }
  });
});
