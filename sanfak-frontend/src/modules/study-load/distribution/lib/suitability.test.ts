import { describe, expect, it } from 'vitest';
import { AxiosError, type AxiosHeaders } from 'axios';
import {
  ASSIGNMENT_BASES,
  buildJustificationPayload,
  buildSuitabilityWarningMessage,
  evaluateSuitability,
  formatJustificationTooltip,
  justificationNoteMinLength,
  parseSuitabilityBasisError,
  requiresJustificationForEntry,
  type BlockJustification,
} from './suitability';
import manifest from '../../study-load.module';

const fakeT = (key: string, options?: Record<string, unknown>) =>
  `${key}|${JSON.stringify(options ?? {})}`;

describe('evaluateSuitability', () => {
  it('ikkala kafedra bir xil bo\'lsa — match', () => {
    expect(evaluateSuitability({ teacherDepartmentId: 'd1', scienceDepartmentId: 'd1' })).toBe(
      'match',
    );
  });

  it('kafedralar farqli bo\'lsa — crossDepartment', () => {
    expect(evaluateSuitability({ teacherDepartmentId: 'd1', scienceDepartmentId: 'd2' })).toBe(
      'crossDepartment',
    );
  });

  it('teacherDepartmentId yo\'q (null) — unknown (soxta qizil YO\'Q)', () => {
    expect(evaluateSuitability({ teacherDepartmentId: null, scienceDepartmentId: 'd2' })).toBe(
      'unknown',
    );
  });

  it('scienceDepartmentId yo\'q (null) — unknown', () => {
    expect(evaluateSuitability({ teacherDepartmentId: 'd1', scienceDepartmentId: null })).toBe(
      'unknown',
    );
  });

  it('ikkalasi ham null — unknown', () => {
    expect(evaluateSuitability({ teacherDepartmentId: null, scienceDepartmentId: null })).toBe(
      'unknown',
    );
  });

  it('bo\'sh satr ("") ham "ma\'lumot yo\'q" deb hisoblanadi — unknown', () => {
    expect(evaluateSuitability({ teacherDepartmentId: '', scienceDepartmentId: 'd1' })).toBe(
      'unknown',
    );
  });
});

describe('requiresJustificationForEntry — §B.3 (ko\'p blokli vakant entry)', () => {
  const deptMap = new Map<string, string | null>([
    ['wb-1', 'dep-A'],
    ['wb-2', 'dep-B'],
    ['wb-3', null],
  ]);

  it('barcha blok bir xil kafedra (match) — sabab TALAB QILINMAYDI', () => {
    expect(
      requiresJustificationForEntry([{ workloadBlockId: 'wb-1' }], 'dep-A', deptMap),
    ).toBe(false);
  });

  it('KAMIDA BITTA blok crossDepartment — sabab TALAB QILINADI', () => {
    expect(
      requiresJustificationForEntry(
        [{ workloadBlockId: 'wb-1' }, { workloadBlockId: 'wb-2' }],
        'dep-A',
        deptMap,
      ),
    ).toBe(true);
  });

  it('barcha blok crossDepartment — sabab TALAB QILINADI', () => {
    expect(
      requiresJustificationForEntry([{ workloadBlockId: 'wb-2' }], 'dep-A', deptMap),
    ).toBe(true);
  });

  it('bo\'sh bloklar ro\'yxati — sabab TALAB QILINMAYDI (hisoblanadigan narsa yo\'q)', () => {
    expect(requiresJustificationForEntry([], 'dep-A', deptMap)).toBe(false);
  });

  it('teacherDepartmentId null (kandidat hali tanlanmagan) — unknown, sabab YO\'Q', () => {
    expect(
      requiresJustificationForEntry([{ workloadBlockId: 'wb-2' }], null, deptMap),
    ).toBe(false);
  });

  it('workloadBlockId null (legacy blok, D27dan oldin) — unknown deb hisoblanadi, soxta talab YO\'Q', () => {
    expect(
      requiresJustificationForEntry([{ workloadBlockId: null }], 'dep-A', deptMap),
    ).toBe(false);
  });

  it('workloadBlockId xaritada YO\'Q (workload bloklari hali yuklanmagan) — unknown, soxta talab YO\'Q', () => {
    expect(
      requiresJustificationForEntry([{ workloadBlockId: 'wb-unknown' }], 'dep-A', deptMap),
    ).toBe(false);
  });

  it('xaritada scienceDepartmentId null (workload bloki department populate qilinmagan) — unknown', () => {
    expect(
      requiresJustificationForEntry([{ workloadBlockId: 'wb-3' }], 'dep-A', deptMap),
    ).toBe(false);
  });
});

describe('studyLoad.distribution.suitability.* manifestda (uz/ru/en) mavjud', () => {
  const KEYS = [
    'studyLoad.distribution.suitability.crossDepartmentShort',
    'studyLoad.distribution.suitability.crossDepartmentTitle',
    'studyLoad.distribution.suitability.crossDepartmentDescription',
    'studyLoad.distribution.suitability.crossDepartmentBadge',
    'studyLoad.distribution.suitability.basis.kafedradaMutaxassisYoq',
    'studyLoad.distribution.suitability.basis.ishTajribasi',
    'studyLoad.distribution.suitability.basis.oqiganFaniYaqin',
    'studyLoad.distribution.suitability.basis.sertifikatMalaka',
    'studyLoad.distribution.suitability.basis.ilmiyIshlar',
    'studyLoad.distribution.suitability.basis.boshqa',
    'studyLoad.distribution.suitability.basisLabel',
    'studyLoad.distribution.suitability.basisPlaceholder',
    'studyLoad.distribution.suitability.noteLabel',
    'studyLoad.distribution.suitability.notePlaceholder',
    'studyLoad.distribution.suitability.basisRequiredHint',
    'studyLoad.distribution.suitability.noteMinLengthHint',
    'studyLoad.distribution.suitability.basisRequiredError',
    'studyLoad.distribution.suitability.undeclaredHint',
    'studyLoad.distribution.suitabilityWarning',
  ] as const;
  const locales = ['uz', 'ru', 'en'] as const;

  it.each(locales)('%s tilida barcha kalitlar mavjud va bo\'sh emas', (lang) => {
    for (const key of KEYS) {
      const value = manifest.i18n?.[lang]?.[key];
      expect(typeof value, `${lang}/${key}`).toBe('string');
      expect((value as string).trim(), `${lang}/${key}`).not.toBe('');
    }
  });

  it('ASSIGNMENT_BASES va KEYS ro\'yxati bir xil uzunlikda (har bir basis uchun label kaliti bor)', () => {
    const basisKeys = KEYS.filter((k) => k.startsWith('studyLoad.distribution.suitability.basis.'));
    expect(basisKeys).toHaveLength(ASSIGNMENT_BASES.length);
  });
});

describe('studyLoad.distribution.vacateModal.* manifestda (uz/ru/en) mavjud', () => {
  const KEYS = [
    'studyLoad.distribution.vacateModal.reasonLabel',
    'studyLoad.distribution.vacateModal.requiredPositionLabel',
    'studyLoad.distribution.vacateModal.requiredSpecializationLabel',
    'studyLoad.distribution.vacateModal.requiredSpecializationPlaceholder',
    'studyLoad.distribution.vacateModal.requiredAcademicTitleLabel',
    'studyLoad.distribution.vacateModal.deadlineLabel',
    'studyLoad.distribution.vacateModal.academicTitle.phd',
    'studyLoad.distribution.vacateModal.academicTitle.docent',
    'studyLoad.distribution.vacateModal.academicTitle.professor',
    'studyLoad.distribution.vacateModal.confirm',
    'studyLoad.distribution.vacateModal.success',
  ] as const;
  const locales = ['uz', 'ru', 'en'] as const;

  it.each(locales)('%s tilida barcha kalitlar mavjud va bo\'sh emas', (lang) => {
    for (const key of KEYS) {
      const value = manifest.i18n?.[lang]?.[key];
      expect(typeof value, `${lang}/${key}`).toBe('string');
      expect((value as string).trim(), `${lang}/${key}`).not.toBe('');
    }
  });
});

describe('justificationNoteMinLength', () => {
  it('"boshqa" — 30 belgi (deklaratsiya charchoqi riski, REJA §7)', () => {
    expect(justificationNoteMinLength('boshqa')).toBe(30);
  });

  it.each(ASSIGNMENT_BASES.filter((b) => b !== 'boshqa'))('"%s" — 10 belgi', (basis) => {
    expect(justificationNoteMinLength(basis)).toBe(10);
  });

  it('bo\'sh/null — 10 belgi (default, hali basis tanlanmagan)', () => {
    expect(justificationNoteMinLength(null)).toBe(10);
    expect(justificationNoteMinLength('')).toBe(10);
  });
});

describe('buildJustificationPayload — §B.2 "TEKIS kalitlar"', () => {
  it('basis bo\'sh/null/undefined — BO\'SH OBYEKT (hech narsa yuborilmaydi)', () => {
    expect(buildJustificationPayload('', 'izoh')).toEqual({});
    expect(buildJustificationPayload(null, 'izoh')).toEqual({});
    expect(buildJustificationPayload(undefined, 'izoh')).toEqual({});
  });

  it('basis berilsa — ikkala kalit ham qo\'shiladi, note trim qilinadi', () => {
    expect(buildJustificationPayload('ish_tajribasi', '  10 yillik tajriba  ')).toEqual({
      suitabilityBasis: 'ish_tajribasi',
      suitabilityNote: '10 yillik tajriba',
    });
  });

  it('`declaredBy`/`declaredAt` HECH QACHON qo\'shilmaydi (server o\'zi qo\'yadi)', () => {
    const result = buildJustificationPayload('boshqa', 'izoh');
    expect(result).not.toHaveProperty('declaredBy');
    expect(result).not.toHaveProperty('declaredAt');
  });
});

describe('parseSuitabilityBasisError — 409 SUITABILITY_BASIS_REQUIRED (§B.2)', () => {
  function makeAxiosError(data: unknown, status = 409): AxiosError {
    return new AxiosError('Request failed with status code 409', 'ERR_BAD_REQUEST', undefined, undefined, {
      status,
      statusText: 'Conflict',
      data,
      headers: {} as AxiosHeaders,
      config: { headers: {} as AxiosHeaders },
    });
  }

  it('code=SUITABILITY_BASIS_REQUIRED — blockIds bilan parse qiladi', () => {
    const err = makeAxiosError({ code: 'SUITABILITY_BASIS_REQUIRED', blockIds: ['b1', 'b2'] });
    expect(parseSuitabilityBasisError(err)).toEqual({ blockIds: ['b1', 'b2'] });
  });

  it('blockIds yo\'q bo\'lsa ham — bo\'sh massiv bilan parse qiladi (yiqilmaydi)', () => {
    const err = makeAxiosError({ code: 'SUITABILITY_BASIS_REQUIRED' });
    expect(parseSuitabilityBasisError(err)).toEqual({ blockIds: [] });
  });

  it('boshqa code (yoki code yo\'q) — null (bu xato boshqa narsa)', () => {
    expect(parseSuitabilityBasisError(makeAxiosError({ code: 'SOME_OTHER_ERROR' }))).toBeNull();
    expect(parseSuitabilityBasisError(makeAxiosError({}))).toBeNull();
  });

  it('AxiosError EMAS (oddiy Error/string) — null', () => {
    expect(parseSuitabilityBasisError(new Error('boom'))).toBeNull();
    expect(parseSuitabilityBasisError('boom')).toBeNull();
    expect(parseSuitabilityBasisError(undefined)).toBeNull();
  });
});

describe('formatJustificationTooltip — §D.2 blok indikatori', () => {
  it('basis yo\'q (legacy kross blok, deklaratsiyasiz) — "asos ko\'rsatilmagan" i18n kaliti', () => {
    expect(formatJustificationTooltip(fakeT, null)).toBe(
      'studyLoad.distribution.suitability.undeclaredHint|{}',
    );
    expect(
      formatJustificationTooltip(fakeT, {
        basis: null,
        note: null,
        declaredBy: null,
        declaredAt: null,
      }),
    ).toBe('studyLoad.distribution.suitability.undeclaredHint|{}');
  });

  it('to\'liq deklaratsiya — basis yorlig\'i · note · «kim, sana»', () => {
    const justification: BlockJustification = {
      basis: 'ish_tajribasi',
      note: '10 yillik amaliy tajriba.',
      declaredBy: 'Karimov Aziz',
      declaredAt: '2026-08-27T10:00:00.000Z',
    };
    const result = formatJustificationTooltip(fakeT, justification);
    expect(result).toContain('studyLoad.distribution.suitability.basis.ishTajribasi');
    expect(result).toContain('10 yillik amaliy tajriba.');
    expect(result).toContain('Karimov Aziz');
    expect(result.split(' · ')).toHaveLength(3);
  });

  it('note/declaredBy yo\'q bo\'lsa ham — faqat basis yorlig\'i bilan yiqilmaydi', () => {
    const result = formatJustificationTooltip(fakeT, {
      basis: 'boshqa',
      note: null,
      declaredBy: null,
      declaredAt: null,
    });
    expect(result).toBe('studyLoad.distribution.suitability.basis.boshqa|{}');
  });
});

describe('buildSuitabilityWarningMessage — §B.6 (warnings[] TEGILMAYDI, alohida kalit)', () => {
  it('warnings yo\'q/bo\'sh — null', () => {
    expect(buildSuitabilityWarningMessage(fakeT, undefined)).toBeNull();
    expect(buildSuitabilityWarningMessage(fakeT, [])).toBeNull();
  });

  it('count = jami blok soni, undeclaredCount = declared:false soni', () => {
    const result = buildSuitabilityWarningMessage(fakeT, [
      { type: 'suitability', severity: 'warning', teacherEntryId: 't1', blockId: 'b1', flag: 'crossDepartment', declared: true, basis: 'ish_tajribasi' },
      { type: 'suitability', severity: 'warning', teacherEntryId: 't2', blockId: 'b2', flag: 'crossDepartment', declared: false, basis: null },
      { type: 'suitability', severity: 'warning', teacherEntryId: 't3', blockId: 'b3', flag: 'crossDepartment', declared: false, basis: null },
    ]);
    expect(result).toContain('"count":3');
    expect(result).toContain('"undeclaredCount":2');
  });
});
