import { describe, expect, it } from 'vitest';
import manifest from '../study-load.module';
import { DEPT_CONTINGENT_I18N } from './i18n';

const KEYS = [
  'nav.deptContingent',
  ...[
    'create', 'created', 'deleted', 'deleteTitle', 'deleteSubtitle', 'flagged', 'saved', 'loadError', 'retry',
    'notFound', 'forbidden', 'detailTitle', 'detailSubtitle', 'addRow', 'removeRow', 'removeRowTitle',
    'removeRowSubtitle', 'stale', 'actual', 'staleTitle', 'staleRow', 'hint', 'emptyRows', 'emptyRowsEditable',
    'courseLabel', 'streamLabel', 'studentsShort',
    'form.academicYear', 'form.academicYearPlaceholder', 'form.note', 'form.submit', 'form.exists',
    'filter.allYears', 'filter.allDepartments',
    'column.department', 'column.academicYear', 'column.rowCount', 'column.streamCount', 'column.updatedAt',
    'column.actions',
    'col.direction', 'col.course', 'col.streams', 'col.groupCount', 'col.studentCount', 'col.streamCount', 'col.state',
    'group.missing', 'group.inactive',
    'stream.empty', 'stream.number', 'stream.mixedLanguages', 'stream.remove', 'stream.groupsPlaceholder',
    'stream.groups', 'stream.counts', 'stream.add',
    'editor.addTitle', 'editor.editTitle', 'editor.directionPlaceholder', 'editor.streams', 'editor.suggest',
    'editor.noGroups', 'editor.poolError', 'editor.totals', 'editor.unassigned', 'editor.note',
    'editor.suggestConfirmTitle', 'editor.suggestConfirmContent',
    'invariant.title', 'invariant.noDirection', 'invariant.noStreams', 'invariant.emptyStream',
    'invariant.streamNumber', 'invariant.groupInTwoStreams', 'invariant.duplicateRow',
    'summary.open', 'summary.title', 'summary.pickYear', 'summary.forbidden', 'summary.loadError', 'summary.totals',
    'summary.missing', 'summary.cohorts', 'summary.noCohorts', 'summary.departments', 'summary.noDepartments',
    'summary.streamsByDepartment', 'summary.noCoverage', 'summary.coverageTag', 'summary.groupMismatch',
    'recalc.tag', 'recalc.tooltip',
    'prefill.button', 'prefill.noPermission', 'prefill.pickBlock', 'prefill.noRow', 'prefill.found',
    'prefill.mismatchTitle', 'prefill.mismatchStream', 'prefill.mismatchGroup', 'prefill.mismatchHint',
    'prefill.dropped', 'prefill.nothingLeft', 'prefill.apply', 'prefill.applied',
  ].map((k) => `deptContingent.${k}`),
] as const;
const LANGS = ['uz', 'ru', 'en'] as const;

describe('study-load — Kafedra kontingenti i18n kalitlari', () => {
  it.each(LANGS)("%s: barcha kalitlar manifestda bor va bo'sh emas", (lang) => {
    const dict = (manifest.i18n as Record<string, Record<string, string>>)[lang];
    if (!dict) throw new Error(`til lug'ati yo'q: ${lang}`);
    for (const key of KEYS) {
      const full = `studyLoad.${key}`;
      const value = dict[full];
      expect(typeof value, `${lang} → ${full}`).toBe('string');
      expect((value ?? '').trim().length, `${lang} → ${full} bo'sh`).toBeGreaterThan(0);
    }
  });

  it('uch til lug\'ati bir xil kalitlar to\'plamiga ega (tushib qolgan tarjima yo\'q)', () => {
    const uz = Object.keys(DEPT_CONTINGENT_I18N.uz).sort();
    expect(Object.keys(DEPT_CONTINGENT_I18N.ru).sort()).toEqual(uz);
    expect(Object.keys(DEPT_CONTINGENT_I18N.en).sort()).toEqual(uz);
  });

  it("T-08 kalitlari bilan to'qnashmaydi (alohida prefiks)", () => {
    for (const k of Object.keys(DEPT_CONTINGENT_I18N.uz)) {
      expect(k.startsWith('studyLoad.deptContingent.') || k === 'studyLoad.nav.deptContingent', k).toBe(true);
    }
  });

  it('manifest: 3 route (summary `/:id` dan oldin), menyu bandi, 5 permission', () => {
    const paths = (manifest.routes ?? []).map((r) => r.path);
    const summaryIdx = paths.indexOf('department-contingents/summary');
    const detailIdx = paths.indexOf('department-contingents/:id');
    expect(paths).toContain('department-contingents');
    expect(summaryIdx).toBeGreaterThan(-1);
    expect(summaryIdx).toBeLessThan(detailIdx);
    const menu = (manifest.menu ?? []).find((m) => m.path === '/study-load/department-contingents');
    expect(menu?.titleKey).toBe('studyLoad.nav.deptContingent');
    const keys = (manifest.permissions ?? []).map((p) => p.key).filter((k) => k.startsWith('departmentContingent:'));
    expect(keys.sort()).toEqual(
      ['create', 'delete', 'read', 'readAll', 'update'].map((a) => `departmentContingent:${a}`).sort(),
    );
  });
});
