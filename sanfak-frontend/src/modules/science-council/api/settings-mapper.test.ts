import { describe, it, expect } from 'vitest';
import {
  mapSpecialty,
  mapCouncilNumber,
  mapApplicationTemplate,
  type BackendCouncilNumber,
} from './mapper';
import { apiMessage } from '../lib/api-error';

describe('mapSpecialty', () => {
  it("Mongo hujjatini frontend modeliga o'giradi", () => {
    expect(
      mapSpecialty({
        _id: 'a1',
        title: 'Pediatriya',
        code: '14.00.09',
        branch: 'Tibbiyot fanlari',
        active: true,
      }),
    ).toEqual({
      id: 'a1',
      title: 'Pediatriya',
      code: '14.00.09',
      branch: 'Tibbiyot fanlari',
      active: true,
    });
  });

  it("fan tarmog'i yo'q bo'lsa `null`", () => {
    expect(mapSpecialty({ _id: 'a1', title: 'X', code: '01' }).branch).toBeNull();
  });

  it('`active` maydoni umuman kelmasa FAOL deb hisoblanadi (model default)', () => {
    expect(mapSpecialty({ _id: 'a1', title: 'X', code: '01' }).active).toBe(true);
  });

  it('`active: false` aynan false qoladi (switch yonib qolmasin)', () => {
    expect(mapSpecialty({ _id: 'a1', title: 'X', code: '01', active: false }).active).toBe(false);
  });
});

describe('mapCouncilNumber', () => {
  it('populate qilingan ixtisosliklarni ochadi', () => {
    const b: BackendCouncilNumber = {
      _id: 'n1',
      number: 'DSc.03',
      specialties: [
        { _id: 's1', title: 'Pediatriya', code: '14.00.09' },
        { _id: 's2', title: 'Jarrohlik', code: '14.00.27' },
      ],
    };
    const r = mapCouncilNumber(b);
    expect(r.specialties.map((s) => s.code)).toEqual(['14.00.09', '14.00.27']);
  });

  it("populate qilinmagan xom ObjectId qatorlari TASHLAB yuboriladi (yiqilmaydi)", () => {
    const r = mapCouncilNumber({
      _id: 'n1',
      number: 'DSc.03',
      specialties: ['507f1f77bcf86cd799439011', { _id: 's1', title: 'X', code: '01' }],
    });
    expect(r.specialties).toHaveLength(1);
    expect(r.specialties[0]!.code).toBe('01');
  });

  it("biriktirilgan ixtisoslik yo'q — bo'sh massiv", () => {
    expect(mapCouncilNumber({ _id: 'n1', number: 'DSc.03' }).specialties).toEqual([]);
  });
});

describe('mapApplicationTemplate', () => {
  it('namuna yuklanmagan — `null` (xato emas)', () => {
    expect(mapApplicationTemplate(null)).toBeNull();
  });

  it('`filePath` frontend tomonda `fileUrl` bo\'ladi', () => {
    const r = mapApplicationTemplate({
      _id: 't1',
      fileName: 'ariza.pdf',
      filePath: 'https://x/files/file/sc/ariza.pdf',
      size: 120,
      unit: 'KB',
    });
    expect(r).toMatchObject({ fileName: 'ariza.pdf', fileUrl: 'https://x/files/file/sc/ariza.pdf' });
  });
});

describe('apiMessage', () => {
  it('backend xabarini axios xatosidan chiqaradi', () => {
    const err = { response: { data: { message: 'Bu ixtisoslik shifri allaqachon mavjud' } } };
    expect(apiMessage(err, 'zaxira')).toBe('Bu ixtisoslik shifri allaqachon mavjud');
  });

  it("xabar bo'lmasa zaxira matn", () => {
    expect(apiMessage(new Error('boom'), 'zaxira')).toBe('zaxira');
    expect(apiMessage({ response: { data: { message: '   ' } } }, 'zaxira')).toBe('zaxira');
    expect(apiMessage(undefined, 'zaxira')).toBe('zaxira');
  });
});
