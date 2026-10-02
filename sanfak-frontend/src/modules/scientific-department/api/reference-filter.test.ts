import { describe, expect, it } from 'vitest';
import { departmentsOfFaculty } from './reference-api';
import type { RefOption } from '../model/types';

const DAVOLASH = 'fac-1';
const STOMAT = 'fac-2';

const DEPARTMENTS: RefOption[] = [
  { id: 'd1', name: 'Ichki kasalliklar kafedrasi', facultyId: DAVOLASH },
  { id: 'd2', name: 'Jarrohlik kafedrasi', facultyId: DAVOLASH },
  { id: 'd3', name: 'Stomatologiya kafedrasi', facultyId: STOMAT },
  { id: 'd4', name: 'Biriktirilmagan kafedra', facultyId: null },
];

describe('departmentsOfFaculty', () => {
  it('fakultet tanlanmagan — hammasi qaytadi', () => {
    expect(departmentsOfFaculty(DEPARTMENTS, undefined)).toHaveLength(4);
    expect(departmentsOfFaculty(DEPARTMENTS, '')).toHaveLength(4);
  });

  it('fakultet tanlangan — faqat o`sha fakultet kafedralari', () => {
    expect(departmentsOfFaculty(DEPARTMENTS, DAVOLASH).map((d) => d.id)).toEqual(['d1', 'd2']);
    expect(departmentsOfFaculty(DEPARTMENTS, STOMAT).map((d) => d.id)).toEqual(['d3']);
  });

  it('fakulteti biriktirilmagan kafedra tanlovda KO`RINMAYDI', () => {
    const ids = departmentsOfFaculty(DEPARTMENTS, DAVOLASH).map((d) => d.id);
    expect(ids).not.toContain('d4');
  });

  it('mos kafedrasi yo`q fakultet — bo`sh ro`yxat (xato emas)', () => {
    expect(departmentsOfFaculty(DEPARTMENTS, 'fac-yoq')).toEqual([]);
  });

  it('asl massivni o`zgartirmaydi', () => {
    const before = [...DEPARTMENTS];
    departmentsOfFaculty(DEPARTMENTS, DAVOLASH);
    expect(DEPARTMENTS).toEqual(before);
  });
});
