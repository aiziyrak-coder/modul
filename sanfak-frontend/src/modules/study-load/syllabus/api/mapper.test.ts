import { describe, expect, it } from 'vitest';
import { mapSyllabusScience } from './mapper';

describe('mapSyllabusScience — kurs (P-36)', () => {
  it('backend `course` → `year` (kurs raqami)', () => {
    const out = mapSyllabusScience({
      science: 'sci1',
      scienceName: 'Tibbiyot kasbiga kirish',
      course: 1,
      semester: 2,
    });
    expect(out.year).toBe(1);
    expect(out.semester).toBe(2);
  });

  it('`year` bo`lsa u ustun (mavjud kontrakt buzilmaydi)', () => {
    const out = mapSyllabusScience({ science: 'sci1', year: 3, course: 1 });
    expect(out.year).toBe(3);
  });

  it('ikkalasi ham yo`q → null (UI "—")', () => {
    const out = mapSyllabusScience({ science: 'sci1' });
    expect(out.year).toBeNull();
  });
});
