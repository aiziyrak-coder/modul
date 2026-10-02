import { describe, expect, it } from 'vitest';
import manifest from '../study-load.module';

const KEYS = [
  'nav.contingentReport',
  'approvalInbox.entity.contingentReport',
  ...[
    'create', 'created', 'deleted', 'deleteTitle', 'deleteSubtitle', 'notFound', 'detailTitle', 'detailSubtitle',
    'asOf', 'pdf', 'excel', 'chainTitle', 'rejectedReason', 'saved', 'editHint', 'groupsWithoutYear',
    'form.academicYear', 'form.academicYearPlaceholder', 'form.asOfDate', 'form.prefillNote', 'form.submit',
    'submitTitle', 'submitSubtitle', 'submitted', 'approveTitle', 'rejectTitle', 'reopenTitle', 'reopenSubtitle', 'reopened',
    'action.submit', 'action.reopen', 'filter.allYears', 'filter.allFaculties', 'courseLabel',
    'column.faculty', 'column.academicYear', 'column.status', 'column.asOfDate', 'column.submittedAt', 'column.actions',
    'totalRow', 'facultyTotalRow', 'emptyRows', 'removeRow', 'source.groups',
    'col.direction', 'col.course', 'col.total', 'col.boys', 'col.girls', 'col.grant', 'col.contract', 'col.groupCount',
    'col.streamCount', 'col.mobilityOut', 'col.mobilityIn', 'col.country', 'col.category', 'col.facultyName',
    'category.milliy', 'category.mdh', 'category.xorijiy', 'category.xorijiy_gibrid',
    'invariant.gender', 'invariant.funding', 'invariant.grantGender', 'invariant.contractGender', 'invariant.blocked',
    'invariant.blockedView', 'summary.forbidden',
    'foreignTitle', 'noForeign', 'addCountry', 'countryPlaceholder',
    'addRow.title', 'addRow.submit', 'addRow.duplicate', 'addRow.noDirections',
    'prefill.button', 'prefill.soft', 'prefill.force',
    'summary.open', 'summary.title', 'summary.pickYear', 'summary.loadError', 'summary.pending', 'summary.allApproved',
    'summary.table1', 'summary.table2', 'summary.table3', 'summary.empty',
  ].map((k) => `contingentReport.${k}`),
] as const;
const LANGS = ['uz', 'ru', 'en'] as const;

describe('study-load — T-08 kontingent hisoboti i18n kalitlari', () => {
  it.each(LANGS)("%s: barcha kalitlar bor va bo'sh emas", (lang) => {
    const dict = (manifest.i18n as Record<string, Record<string, string>>)[lang];
    if (!dict) throw new Error(`til lug'ati yo'q: ${lang}`);
    for (const key of KEYS) {
      const full = `studyLoad.${key}`;
      const value = dict[full];
      expect(typeof value, `${lang} → ${full}`).toBe('string');
      expect((value ?? '').trim().length, `${lang} → ${full} bo'sh`).toBeGreaterThan(0);
    }
  });

  it('manifest: 3 route, menyu bandi, inbox permission unioni', () => {
    const paths = (manifest.routes ?? []).map((r) => r.path);
    expect(paths).toEqual(expect.arrayContaining(['contingent-reports', 'contingent-reports/summary', 'contingent-reports/:id']));
    const menu = (manifest.menu ?? []).find((m) => m.path === '/study-load/contingent-reports');
    expect(menu?.permission).toBe('contingentReport:readAll');
    const inbox = (manifest.menu ?? []).find((m) => m.path === '/study-load/approval-inbox');
    expect(inbox?.permission).toContain('contingentReport:approve');
  });
});
