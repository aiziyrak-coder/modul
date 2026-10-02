import { describe, it, expect } from 'vitest';
import { mapAttendee, mapOpenLesson } from './open-lesson-api';
import { mapGroup } from './lesson-api';

const USER = {
  _id: 'u1',
  lastName: 'Ergasheva',
  firstName: 'Dilnoza',
  middleName: 'Shavkatovna',
};

describe('ochiq dars — auditoriya', () => {
  const base = { _id: 'l1', date: '2026-09-10', type: 'ochiq_dars' };

  it('populate qilingan xona nomi snapshotdan USTUN', () => {
    const out = mapOpenLesson({ ...base, room: { _id: 'r1', title: '204-xona' }, roomTitle: '101-xona' });
    expect(out.roomTitle).toBe('204-xona');
  });

  it("populate YO'Q (xom id) — snapshot ishlatiladi", () => {
    const out = mapOpenLesson({ ...base, room: 'r1', roomTitle: '101-xona' });
    expect(out.roomTitle).toBe('101-xona');
  });

  it("xona ma'lumotnomadan o'chirilgan — ustun BO'SHAMAYDI", () => {
    const out = mapOpenLesson({ ...base, room: null, roomTitle: '101-xona' });
    expect(out.roomTitle).toBe('101-xona');
  });
});

describe('ochiq dars — ishtirokchi ismi', () => {
  it('populate qilingan ism snapshotdan USTUN', () => {
    expect(mapAttendee({ user: USER, name: 'Eski Nom' }).name)
      .toBe('Ergasheva Dilnoza Shavkatovna');
  });

  it("populate YO'Q — snapshot ishlatiladi", () => {
    expect(mapAttendee({ user: 'u1', name: 'Ergasheva Dilnoza' }).name)
      .toBe('Ergasheva Dilnoza');
  });

  it('F.I.Sh tartibi buzilmaydi', () => {
    expect(mapAttendee({ user: USER }).name).toBe('Ergasheva Dilnoza Shavkatovna');
  });
});

describe('umumiy dars — guruh nomi', () => {
  it('populate qilingan guruh nomi snapshotdan USTUN', () => {
    expect(mapGroup({ group: { _id: 'g1', title: 'Farm-102' }, title: 'Farm-101' }).title)
      .toBe('Farm-102');
  });

  it("populate YO'Q — snapshot ishlatiladi", () => {
    expect(mapGroup({ group: 'g1', title: 'Farm-101' }).title).toBe('Farm-101');
  });

  it("ikkalasi ham yo'q — bo'sh satr (ustun yiqilmaydi)", () => {
    expect(mapGroup({}).title).toBe('');
  });
});
