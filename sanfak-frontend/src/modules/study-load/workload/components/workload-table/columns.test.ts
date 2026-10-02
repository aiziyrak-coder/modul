import { describe, expect, it } from 'vitest';
import { buildUpdateBlockPayload, groupRowsByDirection, isEditableColKey } from './columns';
import type { WorkloadRow } from '../../model/detail-types';

const baseRow: WorkloadRow = {
  blockId: 'b1',
  direction: 'Davolash ishi',
  section: 'DAVOLASH ISHI',
  science: 'Anatomiya',
  course: 1,
  student: 90,
  group: 3,
  perGroup: 30,
  streamCount: 3,
  semester: 1,
  semTotal: 144,
  semAud: 90,
  lectStr: { entryId: 'ct-lect', value: 12 },
  lectTot: 36,
  clinStr: { entryId: 'ct-clin', value: 0 },
  clinTot: 0,
  semStr: { entryId: 'ct-sem', value: 0 },
  semTot: 0,
  labStr: { entryId: 'ct-lab', value: 20 },
  pratStr: { entryId: null, value: 0 },
  labTot: 60,
  pratTot: 0,
  on: { entryId: 'it-on', value: 18 },
  yan: { entryId: 'it-yan', value: 0 },
  missed: { entryId: 'it-missed', value: 0 },
  skilled: { entryId: 'it-skilled', value: 0 },
  vada: { entryId: 'it-vada', value: 4 },
  reception: { entryId: 'it-reception', value: 0 },
  consulting: { entryId: 'it-consulting', value: 0 },
  openDep: { entryId: 'it-openDep', value: 0 },
  integral: { entryId: 'it-integral', value: 0 },
  special: { entryId: 'it-special', value: 0 },
  leadership: { entryId: null, value: 10 },
  total: 251,
};

describe('buildUpdateBlockPayload', () => {
  it('hech narsa o\'zgarmagan bo\'lsa null qaytaradi (API\'ga bo\'sh so\'rov yuborilmaydi)', () => {
    expect(buildUpdateBlockPayload(baseRow, {})).toBeNull();
  });

  it('faqat o\'zgargan classType elementini yuboradi — boshqalari massivga tushmaydi', () => {
    const payload = buildUpdateBlockPayload(baseRow, { lectStr: 14 });

    expect(payload).toEqual({
      studyWork: { classTypes: [{ _id: 'ct-lect', stream: 14 }] },
    });
  });

  it('classTypes + studyWork.items aralash o\'zgarsa ikkalasi ham studyWork ostida', () => {
    const payload = buildUpdateBlockPayload(baseRow, { lectStr: 14, missed: 5 });

    expect(payload).toEqual({
      studyWork: {
        classTypes: [{ _id: 'ct-lect', stream: 14 }],
        items: [{ _id: 'it-missed', value: 5 }],
      },
    });
  });

  it('otherWork.items alohida guruhda yuboriladi', () => {
    const payload = buildUpdateBlockPayload(baseRow, { vada: 8, reception: 2 });

    expect(payload).toEqual({
      otherWork: {
        items: [
          { _id: 'it-vada', value: 8 },
          { _id: 'it-reception', value: 2 },
        ],
      },
    });
  });

  it('leadership blok darajasidagi maydon sifatida top-levelga chiqadi (massiv emas)', () => {
    const payload = buildUpdateBlockPayload(baseRow, { leadership: 15 });

    expect(payload).toEqual({ leadership: 15 });
  });

  it('entryId null bo\'lgan katak o\'zgarsa ham — PATCH nishoni yo\'q, jimgina o\'tkazib yuboriladi', () => {
    const payload = buildUpdateBlockPayload(baseRow, { pratStr: 5 });
    expect(payload).toBeNull();
  });

  it('entryId null (pratStr) va valid (lectStr) aralash bo\'lsa faqat valid yuboriladi', () => {
    const payload = buildUpdateBlockPayload(baseRow, { pratStr: 5, lectStr: 14 });

    expect(payload).toEqual({
      studyWork: { classTypes: [{ _id: 'ct-lect', stream: 14 }] },
    });
  });

  it('barcha 4 turdagi maydon birgalikda to\'g\'ri guruhlanadi', () => {
    const payload = buildUpdateBlockPayload(baseRow, {
      lectStr: 14,
      missed: 5,
      vada: 8,
      leadership: 15,
    });

    expect(payload).toEqual({
      studyWork: {
        classTypes: [{ _id: 'ct-lect', stream: 14 }],
        items: [{ _id: 'it-missed', value: 5 }],
      },
      otherWork: { items: [{ _id: 'it-vada', value: 8 }] },
      leadership: 15,
    });
  });

  it('ON/YAN — tahrirlanadi (2026-08-25): server hisoblaydi, O\'UB tuzatadi', () => {
    expect(isEditableColKey('on')).toBe(true);
    expect(isEditableColKey('yan')).toBe(true);
  });

  it('ON/YAN qiymatlari studyWork.items payloadiga tushadi', () => {
    expect(buildUpdateBlockPayload(baseRow, { on: 12, yan: 18 })).toEqual({
      studyWork: {
        items: [
          { _id: 'it-on', value: 12 },
          { _id: 'it-yan', value: 18 },
        ],
      },
    });
  });
});

describe('groupRowsByDirection', () => {
  it('ketma-ket bir xil direction\'li qatorlarni bitta guruhga birlashtiradi', () => {
    const rowA = { ...baseRow, blockId: 'a', direction: 'Davolash ishi' };
    const rowB = { ...baseRow, blockId: 'b', direction: 'Davolash ishi' };
    const rowC = { ...baseRow, blockId: 'c', direction: 'Stomatologiya' };

    const groups = groupRowsByDirection([rowA, rowB, rowC]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toEqual({ direction: 'Davolash ishi', rows: [rowA, rowB] });
    expect(groups[1]).toEqual({ direction: 'Stomatologiya', rows: [rowC] });
  });
});
