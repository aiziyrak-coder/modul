import { describe, expect, it } from 'vitest';
import { mapWorkload, mapWorkloadDetail, type BackendWorkloadDetailFull } from './mapper';

function makeBlock(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: 'block1',
    section: 'DAVOLASH ISHI',
    science: { _id: 'sci1', title: 'Anatomiya' },
    course: 1,
    student: 90,
    studyWork: {
      group: 3,
      stream: 3,
      semester: 1,
      thisSemester: { totalHour: 144, auditoriumHour: 90 },
      classTypes: [
        { _id: 'ct-lect', slug: 'maruza', canonical: 'lecture', stream: 12, total: 36 },
        { _id: 'ct-lab', slug: 'laboratoriya', canonical: 'lab_training', stream: 20, total: 60 },
        { _id: 'ct-prat', slug: 'amaliy', canonical: 'practical', stream: 15, total: 45 },
      ],
      items: [{ _id: 'it-on', slug: 'on', canonical: 'student_work', value: 18 }],
    },
    otherWork: {
      items: [{ _id: 'it-vada', slug: 'yada_qatnashish', canonical: 'participation', value: 4 }],
    },
    leadership: 10,
    totalHour: 251,
    ...overrides,
  };
}

describe('mapWorkloadDetail', () => {
  it('classType/item qiymatlarini canonical bo\'yicha o\'qiydi, _id ni entryId sifatida saqlaydi', () => {
    const backend: BackendWorkloadDetailFull = {
      _id: 'w1',
      title: 'Yuklama',
      department: { _id: 'd1', title: 'Ichki kasalliklar kafedrasi' },
      academicYear: { _id: 'ay1', title: '2025-2026' },
      status: 'draft',
      directions: [{ blocks: [makeBlock()] }],
    };

    const result = mapWorkloadDetail(backend);

    expect(result.id).toBe('w1');
    expect(result.departmentTitle).toBe('Ichki kasalliklar kafedrasi');
    expect(result.academicYearTitle).toBe('2025-2026');
    expect(result.rows).toHaveLength(1);

    const row = result.rows[0]!;
    expect(row.blockId).toBe('block1');
    expect(row.section).toBe('DAVOLASH ISHI');
    expect(row.science).toBe('Anatomiya');
    expect(row.semTotal).toBe(144);
    expect(row.semAud).toBe(90);
    expect(row.lectStr).toEqual({ entryId: 'ct-lect', value: 12 });
    expect(row.lectTot).toBe(36);
    expect(row.labStr).toEqual({ entryId: 'ct-lab', value: 20 });
    expect(row.labTot).toBe(60);
    expect(row.pratStr).toEqual({ entryId: 'ct-prat', value: 15 });
    expect(row.pratTot).toBe(45);
    expect(row.on).toEqual({ entryId: 'it-on', value: 18 });
    expect(row.vada).toEqual({ entryId: 'it-vada', value: 4 });
    expect(row.leadership).toEqual({ entryId: null, value: 10 });
    expect(row.total).toBe(251);
  });

  it('🔴 NOM TUZOG\'I: top-level studyWork.stream `stream` nomi bilan sizib chiqmaydi — `streamCount`ga o\'qiladi', () => {
    const backend: BackendWorkloadDetailFull = {
      _id: 'w1',
      status: 'draft',
      directions: [{ blocks: [makeBlock()] }],
    };

    const row = mapWorkloadDetail(backend).rows[0]!;

    expect(row).not.toHaveProperty('stream');
    expect(row.streamCount).toBe(3);
    expect(row.group).toBe(3);
  });

  it('canonical topilmasa slug fallback ishlaydi', () => {
    const block = makeBlock({
      studyWork: {
        group: 2,
        semester: 1,
        thisSemester: {},
        classTypes: [{ _id: 'ct-clin', slug: 'klinik_amaliyot', canonical: null, stream: 8, total: 16 }],
        items: [],
      },
    });
    const backend: BackendWorkloadDetailFull = {
      _id: 'w1',
      status: 'draft',
      directions: [{ blocks: [block] }],
    };

    const row = mapWorkloadDetail(backend).rows[0]!;

    expect(row.clinStr).toEqual({ entryId: 'ct-clin', value: 8 });
    expect(row.clinTot).toBe(16);
  });

  it('mos element umuman topilmasa entryId null va value 0 (katak tahrirlanmaydi)', () => {
    const block = makeBlock({
      studyWork: { group: 1, semester: 1, thisSemester: {}, classTypes: [], items: [] },
      otherWork: { items: [] },
    });
    const backend: BackendWorkloadDetailFull = {
      _id: 'w1',
      status: 'draft',
      directions: [{ blocks: [block] }],
    };

    const row = mapWorkloadDetail(backend).rows[0]!;

    expect(row.lectStr).toEqual({ entryId: null, value: 0 });
    expect(row.vada).toEqual({ entryId: null, value: 0 });
  });

  it('department/academicYear populate qilinmagan (xom ObjectId string) bo\'lsa title null qaytadi', () => {
    const backend: BackendWorkloadDetailFull = {
      _id: 'w1',
      title: 'Falokat kafedrasi 2025-2026',
      department: '65f0000000000000000000aa',
      academicYear: '65f0000000000000000000bb',
      status: 'new',
      directions: [],
    };

    const result = mapWorkloadDetail(backend);

    expect(result.departmentTitle).toBeNull();
    expect(result.academicYearTitle).toBeNull();
    expect(result.title).toBe('Falokat kafedrasi 2025-2026');
  });

  it('bir nechta yo\'nalish/blok tekislanadi, hujjatdagi tartib saqlanadi', () => {
    const blockA = makeBlock({ _id: 'a', section: 'DAVOLASH ISHI' });
    const blockB = makeBlock({ _id: 'b', section: 'PEDIATRIYA ISHI' });
    const backend: BackendWorkloadDetailFull = {
      _id: 'w1',
      status: 'draft',
      directions: [{ blocks: [blockA] }, { blocks: [blockB] }],
    };

    const rows = mapWorkloadDetail(backend).rows;

    expect(rows.map((r) => r.blockId)).toEqual(['a', 'b']);
  });

  it('bo\'sh directions bo\'lsa bo\'sh rows qaytaradi', () => {
    const backend: BackendWorkloadDetailFull = { _id: 'w1', status: 'draft' };
    expect(mapWorkloadDetail(backend).rows).toEqual([]);
  });

  it('directions[].direction populate qilingan bo\'lsa har qatorga yo\'nalish nomi qo\'shiladi', () => {
    const backend: BackendWorkloadDetailFull = {
      _id: 'w1',
      status: 'draft',
      directions: [{ direction: { _id: 'dir1', title: 'Davolash ishi' }, blocks: [makeBlock()] }],
    };

    const row = mapWorkloadDetail(backend).rows[0]!;
    expect(row.direction).toBe('Davolash ishi');
  });

  it('directions[].direction populate qilinmagan (xom ObjectId) bo\'lsa "—" fallback', () => {
    const backend: BackendWorkloadDetailFull = {
      _id: 'w1',
      status: 'draft',
      directions: [{ direction: '65f0000000000000000000cc', blocks: [makeBlock()] }],
    };

    const row = mapWorkloadDetail(backend).rows[0]!;
    expect(row.direction).toBe('—');
  });

  it('staffPositions — items[] to\'liq map qilinadi, bo\'lsa default qiymatlar 0', () => {
    const backend: BackendWorkloadDetailFull = {
      _id: 'w1',
      status: 'draft',
      staffPositions: {
        items: [
          { _id: 'sp1', category: 'departmentHead', slug: 'professor', positions: 1, load: 300, totalHours: 300 },
        ],
        totalPositions: 1,
        hourly: 60,
      },
    };

    const result = mapWorkloadDetail(backend);
    expect(result.staffPositions).toEqual({
      items: [{ id: 'sp1', category: 'departmentHead', slug: 'professor', positions: 1, load: 300, totalHours: 300, hourly: 0 }],
      totalPositions: 1,
      hourly: 60,
    });
  });

  it('staffPositions yo\'q bo\'lsa bo\'sh/nolli default qaytaradi', () => {
    const backend: BackendWorkloadDetailFull = { _id: 'w1', status: 'draft' };
    expect(mapWorkloadDetail(backend).staffPositions).toEqual({ items: [], totalPositions: 0, hourly: 0 });
  });
});

describe("needsRecalculation (K5) — ro'yxat va detal", () => {
  const base = { _id: 'w1', status: 'draft' };

  it.each([
    ['true', { needsRecalculation: true }, true],
    ['false', { needsRecalculation: false }, false],
    ['null', { needsRecalculation: null }, false],
    ["maydon yo'q", {}, false],
  ] as const)('%s', (_label, extra, expected) => {
    expect(mapWorkload({ ...base, ...extra }).needsRecalculation).toBe(expected);
    expect(mapWorkloadDetail({ ...base, ...extra }).needsRecalculation).toBe(expected);
  });
});

describe("ADR-043 versiya maydonlari — ro'yxat va detal", () => {
  it("versiya maydonlari yo'q (eski hujjat) → version 1, qolganlari null", () => {
    const w = mapWorkload({ _id: 'w1', status: 'approved' });
    expect(w.version).toBe(1);
    expect(w.previousVersionId).toBeNull();
    expect(w.supersededById).toBeNull();
    expect(w.supersededAt).toBeNull();
  });

  it('superseded + version/previousVersion/supersededBy/supersededAt o`qiladi', () => {
    const w = mapWorkload({
      _id: 'w1',
      status: 'superseded',
      version: 2,
      previousVersion: 'w0',
      supersededBy: 'w3',
      supersededAt: '2026-09-24T10:00:00.000Z',
    });
    expect(w.status).toBe('superseded');
    expect(w.version).toBe(2);
    expect(w.previousVersionId).toBe('w0');
    expect(w.supersededById).toBe('w3');
    expect(w.supersededAt).toBe('2026-09-24T10:00:00.000Z');
  });

  it("noto'g'ri version (0 / null) → 1", () => {
    expect(mapWorkload({ _id: 'w1', version: 0 }).version).toBe(1);
    expect(mapWorkload({ _id: 'w1', version: null }).version).toBe(1);
  });

  it('detal ham versiya maydonlarini oladi', () => {
    const d = mapWorkloadDetail({ _id: 'w2', status: 'superseded', version: 3, supersededBy: 'w4' });
    expect(d.status).toBe('superseded');
    expect(d.version).toBe(3);
    expect(d.supersededById).toBe('w4');
  });
});
