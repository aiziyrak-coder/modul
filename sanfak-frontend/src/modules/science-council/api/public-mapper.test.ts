import { describe, expect, it } from 'vitest';
import { mapPublicFormRefs, type BackendFormRefs } from './public-api';

const full: BackendFormRefs = {
  specialties: [
    { _id: 'sp1', title: 'Pediatriya', code: '14.00.09', branch: 'Tibbiyot fanlari' },
    { _id: 'sp2', title: 'Morfologiya', code: '14.00.02', branch: null },
  ],
  academicTitles: ['Professor', 'Dotsent'],
  academicLevels: ['FAN DOKTORI'],
  years: ['2026-2027', '2025-2026'],
  template: {
    _id: 'tpl1',
    fileName: 'ariza_namunasi.pdf',
    filePath: 'http://api.local/files/file/x.pdf?t=abc&e=1',
    size: 120,
    unit: 'KB',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
};

describe('mapPublicFormRefs', () => {
  it('`_id` ni `id` ga o\'giradi va shifr/nomni saqlaydi', () => {
    const out = mapPublicFormRefs(full);
    expect(out.specialties).toEqual([
      { id: 'sp1', title: 'Pediatriya', code: '14.00.09', branch: 'Tibbiyot fanlari' },
      { id: 'sp2', title: 'Morfologiya', code: '14.00.02', branch: null },
    ]);
  });

  it('namunaning `filePath` ini `fileUrl` ga o\'giradi (imzo saqlanadi)', () => {
    const out = mapPublicFormRefs(full);
    expect(out.template?.fileUrl).toBe('http://api.local/files/file/x.pdf?t=abc&e=1');
    expect(out.template?.fileName).toBe('ariza_namunasi.pdf');
  });

  it('namuna yuklanmagan bo\'lsa `null` qaytaradi (forma baribir ochiladi)', () => {
    const out = mapPublicFormRefs({ ...full, template: null });
    expect(out.template).toBeNull();
    expect(out.specialties).toHaveLength(2);
  });

  it('lug\'atlar tartibini O\'ZGARTIRMAYDI', () => {
    expect(mapPublicFormRefs(full).years).toEqual(['2026-2027', '2025-2026']);
    expect(mapPublicFormRefs(full).academicTitles).toEqual(['Professor', 'Dotsent']);
  });

  it('bo\'sh/yetishmayotgan massivlarda yiqilmaydi', () => {
    const out = mapPublicFormRefs({} as BackendFormRefs);
    expect(out).toEqual({
      specialties: [],
      academicTitles: [],
      academicLevels: [],
      years: [],
      template: null,
    });
  });
});
