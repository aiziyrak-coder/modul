import { describe, expect, it } from 'vitest';
import { mapNotice } from './notice-api';
import { isNoticeReadonly } from './notice-types';

const raw = { _id: 'n1', title: 'T', content: 'C' };

describe('mapNotice — kind (P10)', () => {
  it.each([
    ['avtomatik', 'avtomatik'],
    ['davomat', 'davomat'],
    ['oddiy', 'oddiy'],
    [undefined, 'oddiy'],
    [null, 'oddiy'],
    ['AVTOMATIK', 'oddiy'],
    ['tizim', 'oddiy'],
  ] as const)('%s → %s', (kind, expected) => {
    expect(mapNotice({ ...raw, kind }).kind).toBe(expected);
  });

  it('faqat `avtomatik` o‘qish uchun (tahrirlash/o‘chirish yo‘q)', () => {
    expect(isNoticeReadonly(mapNotice({ ...raw, kind: 'avtomatik' }))).toBe(true);
    expect(isNoticeReadonly(mapNotice({ ...raw, kind: 'davomat' }))).toBe(false);
    expect(isNoticeReadonly(mapNotice({ ...raw }))).toBe(false);
  });
});

describe('mapNotice — auto (P10 `auto.state`, `auto.countingYear`)', () => {
  it('faol / bekor_qilingan — holat va hisob yili', () => {
    expect(
      mapNotice({ ...raw, kind: 'avtomatik', auto: { state: 'faol', countingYear: '2026/2027' } })
        .auto,
    ).toEqual({ state: 'faol', countingYear: '2026/2027' });
    expect(
      mapNotice({ ...raw, kind: 'avtomatik', auto: { state: 'bekor_qilingan' } }).auto,
    ).toEqual({ state: 'bekor_qilingan', countingYear: null });
  });

  it('yo‘q / null / noma’lum holat — `null` (bekor qilingan deb taxmin qilinmaydi)', () => {
    expect(mapNotice({ ...raw }).auto).toBeNull();
    expect(mapNotice({ ...raw, auto: null }).auto).toBeNull();
    expect(mapNotice({ ...raw, auto: { state: 'revoked' } }).auto).toBeNull();
    expect(mapNotice({ ...raw, auto: { countingYear: '2026/2027' } }).auto).toBeNull();
  });
});
