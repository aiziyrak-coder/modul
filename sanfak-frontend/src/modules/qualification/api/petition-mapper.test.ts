import { describe, it, expect } from 'vitest';
import { mapPetition, mapPetitionDetail } from './petition-mapper';

describe('mapPetition', () => {
  it('populate qilingan course bilan ro\'yxat elementini map qiladi', () => {
    const r = mapPetition({
      _id: 'p1',
      fullName: 'Ali Valiyev',
      passport: 'AA1234567',
      status: 1,
      course: { _id: 'c1', title: 'Kardiologiya', form: 1 },
      createdAt: '2026-06-01T00:00:00.000Z',
    });
    expect(r).toEqual({
      id: 'p1',
      fullName: 'Ali Valiyev',
      passport: 'AA1234567',
      courseTitle: 'Kardiologiya',
      form: 1,
      status: 1,
      createdAt: '2026-06-01T00:00:00.000Z',
      acceptedAt: null,
      courseFull: false,
    });
  });

  it('detail: viloyat/tuman + hujjatlarni map qiladi, status/form to\'g\'ri', () => {
    const r = mapPetitionDetail({
      _id: 'p2',
      fullName: 'X',
      passport: 'Y',
      status: 3,
      course: { _id: 'c1', title: 'K', form: 2 },
      province: { _id: 'pr1', title: 'Fargona' },
      region: { _id: 'rg1', title: 'Margilon' },
      bachelorDiploma: 'http://x/b.pdf',
      mastersDiploma: null,
      moCertificate: 'http://x/mo.pdf',
    });
    expect(r.provinceTitle).toBe('Fargona');
    expect(r.regionTitle).toBe('Margilon');
    expect(r.bachelorDiploma).toBe('http://x/b.pdf');
    expect(r.mastersDiploma).toBeNull();
    expect(r.form).toBe(2);
    expect(r.status).toBe(3);
  });
});
