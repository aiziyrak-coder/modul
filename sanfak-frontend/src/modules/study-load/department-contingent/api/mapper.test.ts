import { describe, expect, it } from 'vitest';
import {
  courseNumFromTitle,
  draftToInput,
  languageTitlesOf,
  mapDetail,
  mapFlagged,
  mapListItem,
  mapPrefill,
  mapSummary,
  rowToInput,
  type BackendDeptContingent,
} from './mapper';

const listDoc: BackendDeptContingent = {
  _id: 'dc1',
  department: { _id: 'dep1', title: 'Normal anatomiya kafedrasi' },
  academicYear: { _id: 'ay1', title: '2026/2027' },
  rowCount: 2,
  streamCount: 3,
  updatedAt: '2026-09-23T05:00:00.000Z',
};

const detailDoc: BackendDeptContingent = {
  _id: 'dc1',
  department: { _id: 'dep1', title: 'Normal anatomiya kafedrasi' },
  academicYear: { _id: 'ay1', title: '2026/2027' },
  updatedAt: '2026-09-23T05:00:00.000Z',
  rows: [
    {
      _id: 'row1',
      direction: { _id: 'd1', title: 'Davolash ishi', code: '60910200' },
      courseNum: 1,
      note: 'Rus guruhlari alohida',
      streams: [
        {
          number: 1,
          groups: [
            { _id: 'g1', title: '101-A', lang: 'uz', studentNumber: 25, active: true },
            { _id: 'g2', title: '102-A', lang: 'uz', studentNumber: 24, active: true },
          ],
          languages: ['uz'],
        },
        {
          number: 2,
          groups: [
            { _id: 'g3', title: '103-R', lang: { _id: 'ru', title: 'Rus' }, studentNumber: 20, active: false },
            { _id: 'g9', missing: true },
          ],
          languages: ['ru'],
        },
      ],
      derived: { groupCount: 4, studentCount: 69, streamCount: 2 },
      problems: ['«103-R» faol emas', 'guruh topilmadi'],
    },
    { direction: 'd2', courseNum: 3, streams: [], derived: null, problems: null },
  ],
};

describe('department-contingent mapper', () => {
  it("ro'yxat: id, populate title, sonlar", () => {
    expect(mapListItem(listDoc)).toEqual({
      id: 'dc1',
      departmentId: 'dep1',
      departmentTitle: 'Normal anatomiya kafedrasi',
      academicYearId: 'ay1',
      academicYearTitle: '2026/2027',
      rowCount: 2,
      streamCount: 3,
      updatedAt: '2026-09-23T05:00:00.000Z',
    });
    expect(mapListItem({ _id: 'x', department: 'dep2', academicYear: 'ay2' })).toMatchObject({
      departmentId: 'dep2',
      departmentTitle: '',
      academicYearId: 'ay2',
      rowCount: 0,
      streamCount: 0,
      updatedAt: null,
    });
  });

  it('detal: qator — yo\'nalish kodi, oqimlar, guruh (til/faol/topilmadi), derived, problems', () => {
    const d = mapDetail(detailDoc);
    expect(d).toMatchObject({ id: 'dc1', departmentTitle: 'Normal anatomiya kafedrasi', academicYearId: 'ay1' });
    const row = d.rows[0]!;
    expect(row).toMatchObject({
      key: 'row1',
      directionId: 'd1',
      directionTitle: 'Davolash ishi',
      directionCode: '60910200',
      courseNum: 1,
      note: 'Rus guruhlari alohida',
      derived: { groupCount: 4, studentCount: 69, streamCount: 2 },
      problems: ['«103-R» faol emas', 'guruh topilmadi'],
    });
    expect(row.streams[0]).toEqual({
      number: 1,
      languageIds: ['uz'],
      groups: [
        { id: 'g1', title: '101-A', langId: 'uz', langTitle: '', studentNumber: 25, inactive: false, missing: false },
        { id: 'g2', title: '102-A', langId: 'uz', langTitle: '', studentNumber: 24, inactive: false, missing: false },
      ],
    });
    expect(row.streams[1]?.groups).toEqual([
      { id: 'g3', title: '103-R', langId: 'ru', langTitle: 'Rus', studentNumber: 20, inactive: true, missing: false },
      { id: 'g9', title: '', langId: null, langTitle: '', studentNumber: 0, inactive: false, missing: true },
    ]);
  });

  it("detal: bo'sh/null maydonlar — derived 0, problems [], kalit yo'nalish|kurs", () => {
    const row = mapDetail(detailDoc).rows[1]!;
    expect(row).toMatchObject({
      key: 'd2|3',
      directionId: 'd2',
      directionTitle: '',
      courseNum: 3,
      streams: [],
      note: null,
      derived: { groupCount: 0, studentCount: 0, streamCount: 0 },
      problems: [],
    });
    expect(mapDetail({ _id: 'e' }).rows).toEqual([]);
  });

  it('PUT allowlist — faqat direction, courseNum, streams[{number, groups}], note (bo\'sh izoh yuborilmaydi)', () => {
    const d = mapDetail(detailDoc);
    const input = rowToInput(d.rows[0]!);
    expect(input).toEqual({
      direction: 'd1',
      courseNum: 1,
      streams: [
        { number: 1, groups: ['g1', 'g2'] },
        { number: 2, groups: ['g3', 'g9'] },
      ],
      note: 'Rus guruhlari alohida',
    });
    expect(Object.keys(input).sort()).toEqual(['courseNum', 'direction', 'note', 'streams']);
    const noNote = draftToInput({ directionId: 'd2', courseNum: 2, streams: [{ number: 1, groupIds: ['g5'] }], note: '   ' });
    expect(noNote).toEqual({ direction: 'd2', courseNum: 2, streams: [{ number: 1, groups: ['g5'] }] });
    expect('note' in noNote).toBe(false);
  });

  it('prefill — taklif oqimlari (id), havza guruhlari, courseNum satr bo\'lsa ham son', () => {
    const p = mapPrefill({
      direction: 'd1',
      courseNum: '2',
      streams: [
        { number: 1, groups: ['g1', 'g2'] },
        { number: 2, groups: ['g3'] },
      ],
      groups: [
        { _id: 'g1', title: '201-A', lang: { _id: 'uz', title: "O'zbek tili" }, studentNumber: 25 },
        { _id: 'g3', title: '203-R', lang: 'ru', studentNumber: null },
      ],
    });
    expect(p).toEqual({
      directionId: 'd1',
      courseNum: 2,
      streams: [
        { number: 1, groupIds: ['g1', 'g2'] },
        { number: 2, groupIds: ['g3'] },
      ],
      groups: [
        { id: 'g1', title: '201-A', langId: 'uz', langTitle: "O'zbek tili", studentNumber: 25, inactive: false, missing: false },
        { id: 'g3', title: '203-R', langId: 'ru', langTitle: '', studentNumber: 0, inactive: false, missing: false },
      ],
    });
    expect(mapPrefill({})).toEqual({ directionId: '', courseNum: 0, streams: [], groups: [] });
  });

  it('meta.flaggedWorkloads — default 0', () => {
    expect(mapFlagged({ flaggedWorkloads: 3 })).toBe(3);
    expect(mapFlagged(undefined)).toBe(0);
    expect(mapFlagged({ flaggedWorkloads: null })).toBe(0);
  });

  it('kurs sarlavhasi → raqam (backend courseResolver bilan bir xil)', () => {
    expect(courseNumFromTitle('I')).toBe(1);
    expect(courseNumFromTitle('iii')).toBe(3);
    expect(courseNumFromTitle('2')).toBe(2);
    expect(courseNumFromTitle('IV-kurs')).toBe(4);
    expect(courseNumFromTitle('5 kurs')).toBe(5);
    expect(courseNumFromTitle('')).toBe(0);
    expect(courseNumFromTitle(null)).toBe(0);
    expect(courseNumFromTitle('noma\'lum')).toBe(0);
  });

  it("yig'ma — bo'sh javobda ham shakl to'liq, throw yo'q", () => {
    expect(mapSummary(undefined)).toEqual({
      departments: [],
      cohorts: [],
      missingDepartments: [],
      totals: { withContingent: 0, expected: 0 },
    });
  });

  it("yig'ma — kafedralar (populate), kohortalar (courseNum hosila), kiritmaganlar, jamilar", () => {
    const s = mapSummary({
      departments: [
        {
          department: { _id: 'dep1', title: 'Normal anatomiya kafedrasi' },
          updatedAt: '2026-09-23T05:00:00.000Z',
          rows: [
            { direction: { _id: 'd1', title: 'Davolash ishi' }, courseNum: 1, groupCount: 4, studentCount: 90, streamCount: 2 },
          ],
        },
      ],
      cohorts: [
        { direction: 'd1', directionTitle: 'Davolash ishi', course: 'c1', courseTitle: 'I', groupCount: 5, studentCount: 110 },
      ],
      missingDepartments: [{ _id: 'dep2', title: 'Fiziologiya kafedrasi' }],
      totals: { withContingent: 1, expected: 2 },
    });
    expect(s.departments[0]).toEqual({
      departmentId: 'dep1',
      departmentTitle: 'Normal anatomiya kafedrasi',
      updatedAt: '2026-09-23T05:00:00.000Z',
      rows: [
        {
          directionId: 'd1',
          directionTitle: 'Davolash ishi',
          courseNum: 1,
          courseId: null,
          joinKey: 'd1|1',
          groupCount: 4,
          studentCount: 90,
          streamCount: 2,
        },
      ],
    });
    expect(s.cohorts[0]).toEqual({
      directionId: 'd1',
      directionTitle: 'Davolash ishi',
      courseId: 'c1',
      courseTitle: 'I',
      courseNum: 1,
      joinKey: 'd1|1',
      groupCount: 5,
      studentCount: 110,
    });
    expect(s.departments[0]?.rows[0]?.joinKey).toBe(s.cohorts[0]?.joinKey);
    expect(s.missingDepartments).toEqual([{ id: 'dep2', title: 'Fiziologiya kafedrasi' }]);
    expect(s.totals).toEqual({ withContingent: 1, expected: 2 });
  });

  it("yig'ma — `courseId` bor: join kurs id bo'yicha, sarlavha parse qilinmaydi", () => {
    const s = mapSummary({
      departments: [
        {
          department: { _id: 'dep1', title: 'Normal anatomiya kafedrasi' },
          rows: [
            { direction: 'd1', courseNum: 1, courseId: 'c1', groupCount: 4, studentCount: 90, streamCount: 2 },
            { direction: 'd1', courseNum: 2, courseId: 'c2', groupCount: 3, studentCount: 60, streamCount: 1 },
          ],
        },
      ],
      cohorts: [
        { direction: 'd1', course: 'c1', courseId: 'c1', courseTitle: 'Birinchi bosqich', groupCount: 5, studentCount: 110 },
        { direction: 'd1', course: 'c3', courseId: 'c3', courseTitle: '1', groupCount: 2, studentCount: 40 },
      ],
    });
    const [row1, row2] = s.departments[0]?.rows ?? [];
    const [coh1, coh3] = s.cohorts;
    expect(row1).toMatchObject({ courseId: 'c1', joinKey: 'd1|c:c1' });
    expect(row2).toMatchObject({ courseId: 'c2', joinKey: 'd1|c:c2' });
    expect(coh1).toMatchObject({ courseId: 'c1', courseNum: 0, joinKey: 'd1|c:c1' });
    expect(coh3).toMatchObject({ courseId: 'c3', courseNum: 1, joinKey: 'd1|c:c3' });
    expect(row1?.joinKey).toBe(coh1?.joinKey);
    expect(coh3?.joinKey).not.toBe(row1?.joinKey);
  });

  it("til nomi — guruhlarning o'zidan (populate `lang`), 403 so'rovsiz", () => {
    const d = mapDetail(detailDoc);
    const titles = languageTitlesOf(d.rows.flatMap((r) => r.streams.flatMap((s) => s.groups)));
    expect([...titles.entries()]).toEqual([['ru', 'Rus']]);
    expect(languageTitlesOf([])).toEqual(new Map());
  });
});
