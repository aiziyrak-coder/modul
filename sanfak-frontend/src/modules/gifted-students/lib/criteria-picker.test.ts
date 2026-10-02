import { describe, expect, it } from 'vitest';
import { availableCriteria, findDuplicateCriteriaId, takenCriteriaIds } from './criteria-picker';

const opt = (id: string) => ({ id, name: id });
const row = (criteriaId: string) => ({ criteriaId });

describe('takenCriteriaIds', () => {
  it('bo\u2018sh tanlov hisobga olinmaydi', () => {
    expect([...takenCriteriaIds([row(''), row('A')])]).toEqual(['A']);
  });
});

describe('availableCriteria', () => {
  const all = [opt('A'), opt('B'), opt('C')];

  it('🔴 allaqachon tanlangan faoliyat ro\u2018yxatdan CHIQADI', () => {
    const taken = takenCriteriaIds([row('A')]);
    expect(availableCriteria(all, taken, '').map((o) => o.id)).toEqual(['B', 'C']);
  });

  it('SHU qatorning tanlovi qoladi — aks holda kartochka bo\u2018shab ko\u2018rinardi', () => {
    const taken = takenCriteriaIds([row('A'), row('B')]);
    expect(availableCriteria(all, taken, 'A').map((o) => o.id)).toEqual(['A', 'C']);
  });

  it('hech narsa tanlanmagan — hammasi ko\u2018rinadi', () => {
    expect(availableCriteria(all, new Set(), '').map((o) => o.id)).toEqual(['A', 'B', 'C']);
  });
});

describe('findDuplicateCriteriaId', () => {
  it('🔴 dublikat topiladi', () => {
    expect(findDuplicateCriteriaId([row('A'), row('B'), row('A')])).toBe('A');
  });

  it('dublikat yo\u2018q — null', () => {
    expect(findDuplicateCriteriaId([row('A'), row('B')])).toBeNull();
  });

  it('bir necha BO\u2018SH qator dublikat SANALMAYDI', () => {
    expect(findDuplicateCriteriaId([row(''), row(''), row('A')])).toBeNull();
  });

  it('bo\u2018sh ro\u2018yxat — null', () => {
    expect(findDuplicateCriteriaId([])).toBeNull();
  });
});
