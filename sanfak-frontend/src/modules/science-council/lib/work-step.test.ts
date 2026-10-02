import { describe, it, expect } from 'vitest';
import { workStep } from './work-step';

describe('work-step — bosqichlar bo\'linishi (partition)', () => {
  it('seminarga tavsiya etilmagan — boshlang\'ich bosqich ("Ilmiy ishlar")', () => {
    expect(workStep({})).toBe('works');
    expect(workStep({ seminarResult: null })).toBe('works');
    expect(workStep({ finalDecision: 'revision' })).toBe('works');
    expect(workStep({ finalDecision: 'rejected' })).toBe('works');
  });

  it('seminarga tavsiya etilgan, natija hali yo\'q — "Seminarlar"', () => {
    expect(workStep({ finalDecision: 'seminar' })).toBe('seminars');
    expect(workStep({ finalDecision: 'seminar', seminarResult: null })).toBe('seminars');
  });

  it('SANASI hali belgilanmagan ish ham "Seminarlar"da — sanani o\'sha yerda qo\'yadi', () => {
    expect(workStep({ finalDecision: 'seminar' })).toBe('seminars');
  });

  it('seminarda RAD ETILGAN — "Seminarlar"da QOTIB QOLADI (himoyaga o\'tmaydi)', () => {
    expect(workStep({ finalDecision: 'seminar', seminarResult: 'not_defended' })).toBe('seminars');
  });

  it('seminarda himoyaga qo\'yilgan — "Himoyalar"', () => {
    expect(workStep({ finalDecision: 'seminar', seminarResult: 'defended' })).toBe('defenses');
  });

  it('himoya bosqichi seminar tavsiyasidan USTUN (ikkalasi ham bor bo\'lsa)', () => {
    expect(workStep({ finalDecision: 'seminar', seminarResult: 'defended' })).not.toBe('seminars');
  });

  it('har bir holat aynan BITTA bosqich beradi (bo\'linish invarianti)', () => {
    const cases = [
      {},
      { finalDecision: 'revision' as const },
      { finalDecision: 'seminar' as const },
      { finalDecision: 'seminar' as const, seminarResult: 'not_defended' as const },
      { finalDecision: 'seminar' as const, seminarResult: 'defended' as const },
    ];
    for (const c of cases) {
      expect(['works', 'seminars', 'defenses']).toContain(workStep(c));
    }
  });
});
