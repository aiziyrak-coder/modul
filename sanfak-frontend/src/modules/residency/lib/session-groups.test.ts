import { describe, expect, it } from 'vitest';
import { groupsFromResidents, residentNamesInGroup } from './session-groups';
import type { Resident } from '../api/types';

const res = (id: string, fullName: string, groupId: string | null, groupTitle: string | null) =>
  ({ id, fullName, groupId, groupTitle }) as Resident;

const RESIDENTS = [
  res('r1', 'Valiyev Anvar', 'g2', 'ORD-202'),
  res('r2', 'Aliyev Bobur', 'g1', 'ORD-101'),
  res('r3', 'Karimova Dilnoza', 'g2', 'ORD-202'),
  res('r4', 'Guruhsiz Rezident', null, null),
  res('r5', 'Nomsiz Guruhli', 'g3', null),
];

describe('groupsFromResidents', () => {
  it('id bo‘yicha noyob, nom bo‘yicha saralangan, guruhsiz tushib qoladi', () => {
    expect(groupsFromResidents(RESIDENTS)).toEqual([
      { id: 'g3', title: 'Nomsiz guruh' },
      { id: 'g1', title: 'ORD-101' },
      { id: 'g2', title: 'ORD-202' },
    ]);
  });

  it('bo‘sh ro‘yxat — bo‘sh', () => {
    expect(groupsFromResidents([])).toEqual([]);
    expect(groupsFromResidents([res('r4', 'X', null, 'ORD-9')])).toEqual([]);
  });
});

describe('residentNamesInGroup', () => {
  it('faqat shu guruh, saralangan', () => {
    expect(residentNamesInGroup(RESIDENTS, 'g2')).toEqual(['Karimova Dilnoza', 'Valiyev Anvar']);
    expect(residentNamesInGroup(RESIDENTS, 'gX')).toEqual([]);
  });
});
