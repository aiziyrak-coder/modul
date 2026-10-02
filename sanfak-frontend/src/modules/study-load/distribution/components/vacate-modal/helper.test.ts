import { describe, expect, it } from 'vitest';
import { buildVacatePayload, vacateEmptyValues } from './helper';

describe('buildVacatePayload — §C.2 (5 ta ixtiyoriy maydon)', () => {
  it('bo\'sh forma — bo\'sh payload (hammasi ixtiyoriy, bugungi xulq buzilmaydi)', () => {
    expect(buildVacatePayload(vacateEmptyValues)).toEqual({});
  });

  it('faqat to\'ldirilgan maydonlarni qo\'shadi (trim qilib)', () => {
    const payload = buildVacatePayload({
      ...vacateEmptyValues,
      reason: '  Pensiyaga chiqdi  ',
      requiredSpecialization: '  Kardiologiya  ',
    });
    expect(payload).toEqual({ reason: 'Pensiyaga chiqdi', requiredSpecialization: 'Kardiologiya' });
  });

  it('hamma maydon to\'ldirilsa — hammasi payload\'da', () => {
    const payload = buildVacatePayload({
      reason: 'Sabab',
      requiredPosition: 'Dotsent',
      requiredSpecialization: 'Kardiologiya',
      requiredAcademicTitle: 'docent',
      deadline: '2026-09-01T00:00:00.000Z',
    });
    expect(payload).toEqual({
      reason: 'Sabab',
      requiredPosition: 'Dotsent',
      requiredSpecialization: 'Kardiologiya',
      requiredAcademicTitle: 'docent',
      deadline: '2026-09-01T00:00:00.000Z',
    });
  });

  it('faqat probeldan iborat matn — tashlab ketiladi (bo\'sh emas deb hisoblanmaydi)', () => {
    expect(buildVacatePayload({ ...vacateEmptyValues, reason: '   ' })).toEqual({});
  });

  it('requiredAcademicTitle bo\'sh satr bo\'lsa — payload\'ga qo\'shilmaydi', () => {
    expect(
      buildVacatePayload({ ...vacateEmptyValues, requiredAcademicTitle: '' }),
    ).toEqual({});
  });
});
