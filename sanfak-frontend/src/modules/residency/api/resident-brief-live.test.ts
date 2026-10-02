import { describe, it, expect } from 'vitest';
import { mapResidentBrief } from './mapper';

const BASE = { _id: 'r1', fullName: 'Qodirov Sanjar', program: 'ordinatura' };

describe('mapResidentBrief — jonli birinchi', () => {
  it('populate qilingan uchala nom ham snapshotdan USTUN', () => {
    const out = mapResidentBrief({
      ...BASE,
      specialty: { _id: 's1', title: 'Kardiologiya' },
      specialtyTitle: 'Eski mutaxassislik',
      department: { _id: 'd1', title: 'Klinik fanlar kafedrasi' },
      departmentTitle: 'Eski kafedra',
      group: { _id: 'g1', title: 'Ord-201' },
      groupTitle: 'Eski guruh',
    });
    expect(out?.specialtyTitle).toBe('Kardiologiya');
    expect(out?.departmentTitle).toBe('Klinik fanlar kafedrasi');
    expect(out?.groupTitle).toBe('Ord-201');
  });

  it("populate YO'Q (attestatsiya/sinov yuzasi) — snapshot ishlatiladi", () => {
    const out = mapResidentBrief({
      ...BASE,
      specialty: 's1',
      specialtyTitle: 'Kardiologiya (o‘sha paytdagi)',
      group: 'g1',
      groupTitle: 'Ord-201',
    });
    expect(out?.specialtyTitle).toBe('Kardiologiya (o‘sha paytdagi)');
    expect(out?.groupTitle).toBe('Ord-201');
  });

  it("havola o'chirilgan — ustun BO'SHAMAYDI", () => {
    const out = mapResidentBrief({ ...BASE, specialty: null, specialtyTitle: 'Nevrologiya' });
    expect(out?.specialtyTitle).toBe('Nevrologiya');
  });

  it("`groupId` populate qilinganda ham to'g'ri chiqadi", () => {
    const out = mapResidentBrief({ ...BASE, group: { _id: 'g1', title: 'Ord-201' } });
    expect(out?.groupId).toBe('g1');
  });

  it("ikkalasi ham yo'q — `null` (ekran yiqilmaydi)", () => {
    const out = mapResidentBrief({ ...BASE });
    expect(out?.specialtyTitle).toBeNull();
    expect(out?.departmentTitle).toBeNull();
    expect(out?.groupTitle).toBeNull();
  });

  it("rezident umuman yo'q — `null`", () => {
    expect(mapResidentBrief(null)).toBeNull();
    expect(mapResidentBrief('r1')).toBeNull();
  });
});
