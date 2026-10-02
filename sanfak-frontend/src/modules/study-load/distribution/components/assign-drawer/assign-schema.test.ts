import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { makeAssignSchema, withCurrentStavka, assignInitialValues } from './assign-schema';

const baseValues = {
  ...assignInitialValues,
  isVacant: true,
  workloadBlockId: 'blk-1',
};

const templates: Record<string, string> = {
  'studyLoad.distribution.assign.stavkaOneOf': 'Stavka: {{values}}',
  'studyLoad.distribution.assign.noteMinLength': 'Kamida {{n}} ta belgi kiriting',
};
const t = ((key: string, opts?: Record<string, unknown>) => {
  const template = templates[key] ?? key;
  if (!opts) return template;
  return template.replace(/{{(\w+)}}/g, (_match, name: string) => String(opts[name] ?? ''));
}) as unknown as TFunction;

describe('makeAssignSchema — ADR-006(b′) dinamik stavka validatsiyasi', () => {
  it('allowedStakes ro\'yxatidagi qiymatni qabul qiladi', async () => {
    const schema = makeAssignSchema(t, [0.5, 1]);

    await expect(
      schema.validate({ ...baseValues, stavka: 0.5 }),
    ).resolves.toBeTruthy();
  });

  it('allowedStakes ro\'yxatida BO\'LMAGAN qiymatni rad etadi', async () => {
    const schema = makeAssignSchema(t, [0.5, 1]);

    await expect(
      schema.validate({ ...baseValues, stavka: 0.75 }),
    ).rejects.toThrow();
  });

  it('xato matnida ro\'yxat qiymatlaridan biri ko\'rsatiladi', async () => {
    const schema = makeAssignSchema(t, [0.5, 1]);

    try {
      await schema.validate({ ...baseValues, stavka: 0.75 });
      throw new Error('validatsiya rad etishi kerak edi');
    } catch (err) {
      expect((err as Error).message).toContain('0.5');
    }
  });
});

describe('withCurrentStavka — joriy qiymat ro\'yxatdan tashqarida ham saqlanadi', () => {
  it('joriy qiymat ro\'yxatga qo\'shiladi va tartiblanadi', () => {
    expect(withCurrentStavka([0.25, 0.5, 0.75, 1], 1.25)).toEqual([0.25, 0.5, 0.75, 1, 1.25]);
  });

  it('joriy qiymat allaqachon ro\'yxatda bo\'lsa — dublikat bo\'lmaydi', () => {
    expect(withCurrentStavka([0.25, 0.5, 0.75, 1], 0.5)).toEqual([0.25, 0.5, 0.75, 1]);
  });

  it('kengaytirilgan ro\'yxat bilan qurilgan schema joriy (ro\'yxatdan tashqari) qiymatni QABUL qiladi', async () => {
    const extended = withCurrentStavka([0.25, 0.5, 0.75, 1], 1.25);
    const schema = makeAssignSchema(t, extended);

    await expect(
      schema.validate({ ...baseValues, stavka: 1.25 }),
    ).resolves.toBeTruthy();
  });
});

describe('makeAssignSchema — requiresJustification (Faza 2 bayonnoma)', () => {
  it('default (parametr berilmagan) — suitabilityBasis/Note IXTIYORIY (eski xulq buzilmagan)', async () => {
    const schema = makeAssignSchema(t, [0.5, 1]);
    await expect(
      schema.validate({ ...baseValues, stavka: 0.5, suitabilityBasis: '', suitabilityNote: '' }),
    ).resolves.toBeTruthy();
  });

  it('requiresJustification=false — bo\'sh basis/note bilan ham o\'tadi', async () => {
    const schema = makeAssignSchema(t, [0.5, 1], false);
    await expect(
      schema.validate({ ...baseValues, stavka: 0.5, suitabilityBasis: '', suitabilityNote: '' }),
    ).resolves.toBeTruthy();
  });

  it('requiresJustification=true, basis bo\'sh — rad etadi', async () => {
    const schema = makeAssignSchema(t, [0.5, 1], true);
    await expect(
      schema.validate({
        ...baseValues,
        stavka: 0.5,
        suitabilityBasis: '',
        suitabilityNote: '0123456789',
      }),
    ).rejects.toThrow();
  });

  it('requiresJustification=true, note 10 belgidan kam (basis "boshqa" EMAS) — rad etadi', async () => {
    const schema = makeAssignSchema(t, [0.5, 1], true);
    await expect(
      schema.validate({
        ...baseValues,
        stavka: 0.5,
        suitabilityBasis: 'ish_tajribasi',
        suitabilityNote: 'qisqa',
      }),
    ).rejects.toThrow();
  });

  it('requiresJustification=true, note aynan 10 belgi (basis "boshqa" EMAS) — o\'tadi', async () => {
    const schema = makeAssignSchema(t, [0.5, 1], true);
    await expect(
      schema.validate({
        ...baseValues,
        stavka: 0.5,
        suitabilityBasis: 'ish_tajribasi',
        suitabilityNote: '0123456789',
      }),
    ).resolves.toBeTruthy();
  });

  it('requiresJustification=true, basis="boshqa" — 10 belgi YETARLI EMAS (30 talab qilinadi)', async () => {
    const schema = makeAssignSchema(t, [0.5, 1], true);
    await expect(
      schema.validate({
        ...baseValues,
        stavka: 0.5,
        suitabilityBasis: 'boshqa',
        suitabilityNote: '0123456789',
      }),
    ).rejects.toThrow();
  });

  it('requiresJustification=true, basis="boshqa" — 30 belgi bilan o\'tadi', async () => {
    const schema = makeAssignSchema(t, [0.5, 1], true);
    await expect(
      schema.validate({
        ...baseValues,
        stavka: 0.5,
        suitabilityBasis: 'boshqa',
        suitabilityNote: '0'.repeat(30),
      }),
    ).resolves.toBeTruthy();
  });

  it('requiresJustification=true, basis noto\'g\'ri enum qiymat — rad etadi', async () => {
    const schema = makeAssignSchema(t, [0.5, 1], true);
    await expect(
      schema.validate({
        ...baseValues,
        stavka: 0.5,
        suitabilityBasis: 'notavalidbasis',
        suitabilityNote: '0123456789',
      }),
    ).rejects.toThrow();
  });
});

describe('makeAssignSchema — classTypeSlugs (ADR-034)', () => {
  it('plannedClassTypeCount > 0: bo`sh tanlov RAD, qism/hammasi qabul; 0: bo`sh ham qabul', async () => {
    const withTypes = makeAssignSchema(t, [1], false, 3);
    await expect(withTypes.validate({ ...baseValues, classTypeSlugs: [] })).rejects.toThrow();
    await expect(
      withTypes.validate({ ...baseValues, classTypeSlugs: ['maruza'] }),
    ).resolves.toBeTruthy();
    const noTypes = makeAssignSchema(t, [1], false, 0);
    await expect(noTypes.validate({ ...baseValues, classTypeSlugs: [] })).resolves.toBeTruthy();
  });

  it('initial values: classTypeSlugs = [] (blok tanlangach hammasi belgilanadi)', () => {
    expect(assignInitialValues.classTypeSlugs).toEqual([]);
  });
});
