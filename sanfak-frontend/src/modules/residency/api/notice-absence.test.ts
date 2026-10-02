import { describe, expect, it } from 'vitest';
import { mapNotice } from './notice-api';

const base = {
  _id: 'n1',
  program: 'ordinatura',
  title: 'Bildirgi',
  content: 'Matn',
};

describe('mapNotice — kind', () => {
  it('davomat', () => {
    expect(mapNotice({ ...base, kind: 'davomat' }).kind).toBe('davomat');
  });

  it.each([undefined, null, 'oddiy', 'nimadir'])('%p -> oddiy', (kind) => {
    expect(mapNotice({ ...base, kind: kind as string | null | undefined }).kind).toBe('oddiy');
  });
});

describe('mapNotice — absence snapshot', () => {
  it("to'liq snapshot (eski — ketma-ket qoida, oyna maydonlarisiz)", () => {
    const n = mapNotice({
      ...base,
      absence: { days: 5, from: '2026-09-01', to: '2026-09-08' },
    });
    expect(n.absence).toEqual({
      days: 5,
      from: '2026-09-01',
      to: '2026-09-08',
      windowDays: null,
      windowFrom: null,
      windowTo: null,
    });
  });

  it('yangi snapshot (ABS) — oyna maydonlari o‘tadi', () => {
    const n = mapNotice({
      ...base,
      absence: {
        days: 3,
        from: '2026-09-21',
        to: '2026-09-25',
        windowDays: 7,
        windowFrom: '2026-09-19',
        windowTo: '2026-09-25',
      },
    });
    expect(n.absence).toEqual({
      days: 3,
      from: '2026-09-21',
      to: '2026-09-25',
      windowDays: 7,
      windowFrom: '2026-09-19',
      windowTo: '2026-09-25',
    });
  });

  it.each([
    ['null', null],
    ['satr', '7'],
  ])('windowDays: %s -> null', (_label, windowDays) => {
    const n = mapNotice({
      ...base,
      absence: {
        days: 3,
        from: '2026-09-21',
        to: '2026-09-25',
        windowDays: windowDays as number | null,
      },
    });
    expect(n.absence?.windowDays).toBeNull();
  });

  it.each([
    ['maydon yo‘q', undefined],
    ['null', null],
    ['kunsiz', { from: '2026-09-01', to: '2026-09-08' }],
    ['boshlanishsiz', { days: 5, to: '2026-09-08' }],
    ['tugashsiz', { days: 5, from: '2026-09-01' }],
  ])('%s -> null', (_label, absence) => {
    expect(
      mapNotice({ ...base, absence: absence as { days?: number; from?: string; to?: string } | null })
        .absence,
    ).toBeNull();
  });

  it('days: 0 ham son sifatida o‘tadi', () => {
    expect(
      mapNotice({ ...base, absence: { days: 0, from: '2026-09-01', to: '2026-09-01' } })
        .absence?.days,
    ).toBe(0);
  });
});

describe('mapNotice — document', () => {
  it('to‘liq metadata', () => {
    const n = mapNotice({
      ...base,
      document: { fileName: 'bildirgi-2026-09-09.pdf', size: 58991, generatedAt: '2026-09-09T06:00:00.000Z' },
    });
    expect(n.document).toEqual({
      fileName: 'bildirgi-2026-09-09.pdf',
      size: 58991,
      generatedAt: '2026-09-09T06:00:00.000Z',
    });
  });

  it.each([
    ['maydon yo‘q', undefined],
    ['null', null],
    ['nomsiz', { size: 10 }],
    ['bo‘sh nom', { fileName: '', size: 10 }],
  ])('%s -> null (yuklab olish tugmasi chiqmaydi)', (_label, document) => {
    expect(
      mapNotice({ ...base, document: document as { fileName?: string; size?: number } | null })
        .document,
    ).toBeNull();
  });

  it('hajmi yo‘q bo‘lsa 0 (tugma baribir ishlaydi)', () => {
    expect(mapNotice({ ...base, document: { fileName: 'a.pdf' } }).document?.size).toBe(0);
  });

  it('document da URL/havola maydoni YO‘Q', () => {
    const n = mapNotice({
      ...base,
      document: { fileName: 'a.pdf', size: 1 },
    });
    const keys = Object.keys(n.document ?? {});
    expect(keys.sort()).toEqual(['fileName', 'generatedAt', 'size']);
    expect(JSON.stringify(n.document)).not.toContain('/files');
  });
});

describe('mavjud maydonlar buzilmagan', () => {
  it('oddiy bildirgi o‘zgarishsiz mapping qilinadi', () => {
    const n = mapNotice({ ...base, status: 'kutilmoqda', decision: 'Qaror' });
    expect(n).toMatchObject({
      id: 'n1',
      title: 'Bildirgi',
      content: 'Matn',
      status: 'kutilmoqda',
      decision: 'Qaror',
      kind: 'oddiy',
      absence: null,
      document: null,
    });
  });
});
