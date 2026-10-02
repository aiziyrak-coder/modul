import { describe, expect, it } from 'vitest';
import { canSeeInstituteSummary, reportTurn } from './chain';
import { groupRows, hasDuplicateRow, rowErrors, sumNumbers, zeroNumbers } from './invariants';
import type { ContingentRow } from './types';

describe('reportTurn', () => {
  it('dekan — draft: yuborish + tahrir + o\'chirish; in_review (dean): tasdiq/rad; rejected: qayta ochish', () => {
    expect(reportTurn('draft', null, 'dekan', false)).toMatchObject({ canSubmit: true, canEdit: true, canDelete: true, canApprove: false });
    expect(reportTurn('in_review', 'dean', 'dekan', false)).toMatchObject({ canApprove: true, canReject: true, canEdit: false, canSubmit: false });
    expect(reportTurn('rejected', null, 'dekan', false)).toMatchObject({ canReopen: true, canEdit: true, canDelete: true });
  });

  it('kotib — yuboradi/qayta ochadi/tahrirlaydi, lekin TASDIQLAMAYDI', () => {
    expect(reportTurn('draft', null, 'fakultet_kengash_kotibi', false)).toMatchObject({ canSubmit: true, canEdit: true });
    expect(reportTurn('in_review', 'dean', 'fakultet_kengash_kotibi', false)).toMatchObject({ canApprove: false, canReject: false });
    expect(reportTurn('rejected', null, 'fakultet_kengash_kotibi', false).canReopen).toBe(true);
  });

  it("O'UB/rektor — kuzatuvchi: hech qanday amal yo'q", () => {
    for (const role of ['oquv_uslubiy_boshqarma', 'rektor', 'prorektor']) {
      const t = reportTurn('in_review', 'dean', role, false);
      expect(t).toMatchObject({ canSubmit: false, canApprove: false, canReject: false, canReopen: false, canEdit: false });
    }
  });

  it('approved — hamma uchun qulf', () => {
    expect(reportTurn('approved', null, 'dekan', true)).toMatchObject({
      canSubmit: false,
      canApprove: false,
      canReject: false,
      canReopen: false,
      canEdit: false,
      canDelete: false,
    });
  });

  it('super admin — barcha amallar (UI)', () => {
    expect(reportTurn('in_review', 'dean', undefined, true).canApprove).toBe(true);
    expect(reportTurn('draft', null, undefined, true).canSubmit).toBe(true);
  });

  it("canSeeInstituteSummary — dekan/kotib ko'rmaydi, O'UB/super ko'radi", () => {
    expect(canSeeInstituteSummary('dekan', false)).toBe(false);
    expect(canSeeInstituteSummary('fakultet_kengash_kotibi', false)).toBe(false);
    expect(canSeeInstituteSummary('oquv_uslubiy_boshqarma', false)).toBe(true);
    expect(canSeeInstituteSummary('dekan', true)).toBe(true);
  });
});

const row = (over: Partial<ContingentRow> = {}): ContingentRow => ({
  directionId: 'd1',
  directionCode: '60910200',
  directionTitle: 'Davolash ishi',
  category: 'milliy',
  course: 1,
  ...zeroNumbers(),
  total: 10,
  boys: 4,
  girls: 6,
  grant: 3,
  contract: 7,
  grantBoys: 1,
  grantGirls: 2,
  contractBoys: 3,
  contractGirls: 4,
  source: { total: 'groups', groupCount: 'groups', streamCount: 'groups' },
  ...over,
});

describe('invariants (backend Joi bilan bir xil)', () => {
  it("to'g'ri qator — xato yo'q; har buzilish o'z kaliti bilan", () => {
    expect(rowErrors(row())).toEqual([]);
    expect(rowErrors(row({ boys: 5 }))).toEqual(['studyLoad.contingentReport.invariant.gender']);
    expect(rowErrors(row({ grant: 4, grantGirls: 3 }))).toEqual(['studyLoad.contingentReport.invariant.funding']);
    expect(rowErrors(row({ grant: 4 }))).toHaveLength(2);
    expect(rowErrors(row({ grantBoys: 2 }))).toEqual(['studyLoad.contingentReport.invariant.grantGender']);
    expect(rowErrors(row({ contractGirls: 9 }))).toEqual(['studyLoad.contingentReport.invariant.contractGender']);
  });

  it('groupRows — blok yo\'nalish×toifa, kurs o\'sish tartibida, jami', () => {
    const blocks = groupRows([row({ course: 2, total: 20, boys: 8, girls: 12, grant: 5, contract: 15, grantBoys: 2, grantGirls: 3, contractBoys: 6, contractGirls: 9 }), row(), row({ category: 'mdh' })]);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.rows.map((r) => r.course)).toEqual([1, 2]);
    expect(blocks[0]?.total.total).toBe(30);
    expect(blocks[1]?.category).toBe('mdh');
    expect(sumNumbers([row(), row()]).total).toBe(20);
  });

  it('hasDuplicateRow — yo\'nalish×kurs×toifa', () => {
    const rows = [row()];
    expect(hasDuplicateRow(rows, { directionId: 'd1', category: 'milliy', course: 1 })).toBe(true);
    expect(hasDuplicateRow(rows, { directionId: 'd1', category: 'mdh', course: 1 })).toBe(false);
    expect(hasDuplicateRow(rows, { directionId: 'd1', category: 'milliy', course: 2 })).toBe(false);
  });
});
