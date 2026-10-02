import { describe, expect, it } from 'vitest';
import { mapApplication, type BackendApplication } from './mapper';

const base: BackendApplication = {
  _id: 'APP-1',
  giftedStudent: 'GS-1',
  status: 'pending',
  academicYear: '2025/2026',
};

describe('mapApplication — scholarshipName jonli nomni afzal ko\u2018radi', () => {
  it('populate qilingan stipendiya nomi eskirgan snapshotdan ustun', () => {
    const app = mapApplication({
      ...base,
      scholarship: { _id: 'SCH-1', name: 'Navoiy nomidagi stipendiya' },
      scholarshipName: 'Eski nom',
    });

    expect(app.scholarshipName).toBe('Navoiy nomidagi stipendiya');
  });

  it('populate qilinmagan (xom id) bo\u2018lsa snapshotga qaytadi \u2014 nom YO\u2018QOLMAYDI', () => {
    const app = mapApplication({ ...base, scholarship: 'SCH-1', scholarshipName: 'Eski nom' });

    expect(app.scholarshipName).toBe('Eski nom');
  });

  it("stipendiya o\u2018chirilib populate `null` bergan holatda ham snapshot qoladi", () => {
    const app = mapApplication({ ...base, scholarship: null, scholarshipName: 'Eski nom' });

    expect(app.scholarshipName).toBe('Eski nom');
  });

  it('ikkalasi ham yo\u2018q bo\u2018lsa bo\u2018sh satr', () => {
    expect(mapApplication(base).scholarshipName).toBe('');
  });

  it('stipendiya id si baribir ref dan olinadi', () => {
    const app = mapApplication({
      ...base,
      scholarship: { _id: 'SCH-1', name: 'Yangi nom' },
      scholarshipName: 'Eski nom',
    });

    expect(app.scholarshipId).toBe('SCH-1');
  });
});
