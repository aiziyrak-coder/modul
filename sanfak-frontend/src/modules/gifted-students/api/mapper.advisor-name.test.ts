import { describe, it, expect } from 'vitest';
import { mapStudent } from './mapper';

const BASE = {
  _id: 's1',
  fullName: 'Aliyev Sardor',
};

describe('advisorName — jonli birinchi', () => {
  it('populate qilingan `advisor` snapshotdan USTUN', () => {
    const out = mapStudent({
      ...BASE,
      advisorName: 'Eski Nom',
      advisor: { lastName: 'Ergasheva', firstName: 'Dilnoza', middleName: 'Shavkatovna' },
    });
    expect(out.advisorName).toBe('Ergasheva Dilnoza Shavkatovna');
  });

  it('F.I.Sh tartibi — familiya, ism, sharif', () => {
    const out = mapStudent({
      ...BASE,
      advisor: { firstName: 'Dilnoza', lastName: 'Ergasheva', middleName: 'Shavkatovna' },
    });
    expect(out.advisorName).toBe('Ergasheva Dilnoza Shavkatovna');
  });

  it('🔴 populate QILINMAGAN (xom satr) — snapshot ishlatiladi', () => {
    const out = mapStudent({
      ...BASE,
      advisorName: 'Ergasheva Dilnoza',
      advisor: '6a5a0acbd34b3c21a575d58e',
    });
    expect(out.advisorName).toBe('Ergasheva Dilnoza');
  });

  it("`advisor` umuman yo'q — snapshot ishlatiladi", () => {
    expect(mapStudent({ ...BASE, advisorName: 'Ergasheva Dilnoza' }).advisorName)
      .toBe('Ergasheva Dilnoza');
  });

  it("ikkalasi ham yo'q — bo'sh satr (ekran yiqilmaydi)", () => {
    expect(mapStudent({ ...BASE }).advisorName).toBe('');
  });

  it("bo'sh ism maydonlari snapshotni BOSIB KETMAYDI", () => {
    const out = mapStudent({
      ...BASE,
      advisorName: 'Ergasheva Dilnoza',
      advisor: { firstName: '', lastName: '', middleName: '' },
    });
    expect(out.advisorName).toBe('Ergasheva Dilnoza');
  });
});
