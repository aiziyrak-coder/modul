import { describe, expect, it } from 'vitest';
import {
  mapGrid,
  mapOutage,
  mapOverview,
  mapWarnings,
  withOverviewPackets,
  type BackendSamsDays,
  type BackendSamsOutage,
  type BackendSamsOverview,
  type BackendSamsWarnings,
} from './sams-status-mapper';

const OVERVIEW_WIRE = {
  now: '2026-09-27T03:20:00.000Z',
  today: '2026-09-27',
  config: { tickMinutes: 15, staleAfterMinutes: 30, closeGraceHours: 6, resendMaxDays: 30 },
  liveness: {
    state: 'stale',
    lastPacket: {
      receivedAt: '2026-09-27T03:05:00.000Z',
      emittedAt: '2026-09-27T03:04:40.000Z',
      lagSeconds: 20,
      window: { from: '2026-09-26', to: '2026-09-27' },
      trigger: 'tick',
      tenantsScanned: 7,
      tenantsWithResidents: 2,
      peopleCount: 17,
      unresolvedCount: 3,
      ambiguousCount: 0,
      failedTenants: [],
    },
  },
  delivery: {
    deliveredThrough: '2026-09-24',
    resendFrom: '2026-09-25',
    gapDays: 3,
    oldestGap: '2026-09-25',
  },
  clinics: [
    {
      dbname: 'klinika_b',
      orgTitle: 'Respublika klinikasi',
      live: true,
      firstDay: '2026-01-10',
      lastDay: '2026-09-27',
      lastPacketAt: '2026-09-27T03:05:00.000Z',
      deliveredThrough: '2026-09-24',
      gapCount: 2,
      today: {
        delivery: 'open',
        measured: true,
        unmeasuredReason: null,
        expectedResidents: 12,
        scannedResidents: 7,
        coverage: 0.58,
        baselineCoverage: null,
        coverageStatus: 'provisional',
        packetAt: '2026-09-27T03:04:40.000Z',
        receivedAt: '2026-09-27T03:05:00.000Z',
      },
    },
    {
      dbname: 'klinika_a',
      orgTitle: 'Akfa klinikasi',
      live: false,
      firstDay: '2026-02-01',
      lastDay: '2026-09-20',
      lastPacketAt: null,
      deliveredThrough: null,
      gapCount: 0,
      today: {
        delivery: 'none',
        measured: null,
        unmeasuredReason: null,
        expectedResidents: null,
        scannedResidents: null,
        coverage: null,
        baselineCoverage: null,
        coverageStatus: null,
        packetAt: null,
        receivedAt: null,
      },
    },
  ],
  warnings: {
    day: '2026-09-27',
    unresolved: 3,
    ambiguous: 0,
    noSchedule: 1,
    inactiveUser: 0,
    tenantSetChanged: {
      at: '2026-09-26T10:00:00.000Z',
      from: 7,
      to: 6,
      added: [],
      removed: ['klinika_c'],
    },
  },
};
const OVERVIEW: BackendSamsOverview = OVERVIEW_WIRE;

describe('mapOverview', () => {
  it('liveness, oxirgi paket, watermark va klinikalar (orgTitle bo‘yicha)', () => {
    const o = mapOverview(OVERVIEW);
    expect(o.now).toBe('2026-09-27T03:20:00.000Z');
    expect(o.today).toBe('2026-09-27');
    expect(o.liveness).toBe('stale');
    expect(o.lastPacket?.receivedAt).toBe('2026-09-27T03:05:00.000Z');
    expect(o.deliveredThrough).toBe('2026-09-24');
    expect(o.gapDays).toBe(3);
    expect(o.clinics.map((c) => c.dbname)).toEqual(['klinika_a', 'klinika_b']);
    expect(o.clinics[1]?.today).toEqual({
      delivery: 'open',
      measured: true,
      expectedResidents: 12,
      scannedResidents: 7,
    });
    expect(o.clinics[0]?.today).toEqual({
      delivery: 'none',
      measured: false,
      expectedResidents: null,
      scannedResidents: null,
    });
    expect(o.clinics[1]?.lastPacketAt).toBe('2026-09-27T03:05:00.000Z');
  });

  it('ogohlantirish sonlari va oxirgi klinikalar o‘zgarishi vaqti', () => {
    expect(mapOverview(OVERVIEW).warnings).toEqual({
      unresolved: 3,
      ambiguous: 0,
      noSchedule: 1,
      inactiveUser: 0,
      tenantChangedAt: '2026-09-26T10:00:00.000Z',
    });
  });

  it('himoya: son kelmasa null saqlanadi (0 EMAS)', () => {
    const w = mapOverview({ warnings: { ...OVERVIEW_WIRE.warnings, inactiveUser: null } }).warnings;
    expect(w?.inactiveUser).toBeNull();
    const partial = { day: '2026-09-27', unresolved: 1, tenantSetChanged: null };
    expect(mapOverview({ warnings: partial }).warnings).toEqual({
      unresolved: 1,
      ambiguous: null,
      noSchedule: null,
      inactiveUser: null,
      tenantChangedAt: null,
    });
  });

  it('noma’lum liveness/delivery — null; bo‘sh javob yiqitmaydi', () => {
    const o = mapOverview({
      liveness: { state: 'weird' },
      clinics: [{ dbname: 'x', today: { delivery: '??' } }],
    });
    expect(o.liveness).toBeNull();
    expect(o.clinics[0]?.today?.delivery).toBeNull();
    expect(o.clinics[0]?.orgTitle).toBe('x');
    expect(mapOverview({}).clinics).toEqual([]);
    expect(mapOverview({}).warnings).toBeNull();
  });
});

const DAYS_WIRE = {
  from: '2026-09-25',
  to: '2026-09-27',
  deliveredThrough: '2026-09-24',
  resendFrom: null,
  clinics: [
    {
      dbname: 'klinika_a',
      orgTitle: 'Akfa klinikasi',
      firstDay: '2026-01-10',
      gaps: [{ day: '2026-09-26', delivery: 'stale' }],
      days: [
        {
          day: '2026-09-25',
          delivery: 'final',
          measured: true,
          unmeasuredReason: null,
          expectedResidents: 5,
          scannedResidents: 0,
          rosterScanCount: 0,
          coverage: 0,
          coverageStatus: 'low',
          deviceMix: null,
          packetAt: '2026-09-26T01:00:00.000Z',
          receivedAt: '2026-09-26T01:00:03.000Z',
        },
        {
          day: '2026-09-26',
          delivery: 'stale',
          measured: false,
          unmeasuredReason: 'stale',
          expectedResidents: null,
          scannedResidents: null,
          rosterScanCount: null,
          coverage: null,
          coverageStatus: null,
          deviceMix: null,
          packetAt: null,
          receivedAt: null,
        },
        {
          day: '2026-09-27',
          delivery: 'open',
          measured: true,
          unmeasuredReason: null,
          expectedResidents: 5,
          scannedResidents: 2,
          rosterScanCount: 3,
          coverage: 0.4,
          coverageStatus: null,
          deviceMix: null,
          packetAt: '2026-09-27T03:04:40.000Z',
          receivedAt: '2026-09-27T03:05:00.000Z',
        },
      ],
      live: true,
      lastPacketAt: '2026-09-27T03:05:00.000Z',
      deliveredThrough: '2026-09-25',
    },
  ],
};
const DAYS: BackendSamsDays = DAYS_WIRE;

describe('mapGrid', () => {
  const requested = { from: '2026-09-25', to: '2026-09-27' };

  it('qatorlar kun kaliti bo‘yicha Record; xom sonlar saqlanadi', () => {
    const g = mapGrid(DAYS, requested);
    const clinic = g.clinics[0];
    expect(Object.keys(clinic?.cells ?? {})).toEqual(['2026-09-25', '2026-09-26', '2026-09-27']);
    expect(clinic?.cells['2026-09-25']).toMatchObject({
      delivery: 'final',
      measured: true,
      expectedResidents: 5,
      scannedResidents: 0,
      rosterScanCount: 0,
      packetAt: '2026-09-26T01:00:00.000Z',
    });
    expect(clinic?.cells['2026-09-26']?.unmeasuredReason).toBe('stale');
    expect(clinic?.lastPacketAt).toBe('2026-09-27T03:05:00.000Z');
    expect(clinic?.live).toBe(true);
    expect(clinic?.firstDay).toBe('2026-01-10');
    expect(clinic?.deliveredThrough).toBe('2026-09-25');
  });

  it('`delivery: none` qatori — `measured: null` → false (o‘lchanmagan)', () => {
    const g = mapGrid(
      {
        clinics: [
          {
            dbname: 'k',
            days: [
              { day: '2026-09-25', delivery: 'none', measured: null, expectedResidents: null },
            ],
          },
        ],
      },
      requested,
    );
    expect(g.clinics[0]?.cells['2026-09-25']).toMatchObject({
      delivery: 'none',
      measured: false,
      expectedResidents: null,
    });
  });

  it('`days` (D-CAL) yo‘q — oynaning har kuni, working=true', () => {
    expect(mapGrid(DAYS, requested).days).toEqual([
      { day: '2026-09-25', working: true },
      { day: '2026-09-26', working: true },
      { day: '2026-09-27', working: true },
    ]);
  });

  it('server aniq working=false desa — faqat o‘sha kun', () => {
    const g = mapGrid({ ...DAYS, days: [{ day: '2026-09-26', working: false }] }, requested);
    expect(g.days.map((d) => d.working)).toEqual([true, false, true]);
  });

  it('server oynasi bo‘lmasa so‘ralgani olinadi; dbname’siz klinika tashlanadi', () => {
    const g = mapGrid({ clinics: [{ orgTitle: 'Nomsiz' }] }, requested);
    expect(g.from).toBe('2026-09-25');
    expect(g.days).toHaveLength(3);
    expect(g.clinics).toEqual([]);
  });
});

describe('withOverviewPackets — /days + /overview', () => {
  const requested = { from: '2026-09-25', to: '2026-09-27' };

  const oldDays = () => mapGrid({ clinics: [{ dbname: 'klinika_a', days: [] }] }, requested);

  it('/days bermasa — overview’dagisi (dbname bo‘yicha)', () => {
    const overview = mapOverview({
      ...OVERVIEW,
      clinics: [
        { dbname: 'klinika_a', orgTitle: 'Akfa', lastPacketAt: '2026-09-27T03:05:00.000Z' },
      ],
    });
    const merged = withOverviewPackets(oldDays(), overview.clinics);
    expect(merged.clinics[0]?.lastPacketAt).toBe('2026-09-27T03:05:00.000Z');
    expect(withOverviewPackets(oldDays(), []).clinics[0]?.lastPacketAt).toBeNull();
  });

  it('/days o‘zi bersa — o‘shanisi ustun; o‘zgarish yo‘q bo‘lsa o‘sha obyekt', () => {
    const own = mapGrid(
      { clinics: [{ dbname: 'klinika_a', lastPacketAt: '2026-09-27T04:00:00.000Z' }] },
      requested,
    );
    const merged = withOverviewPackets(own, [
      { dbname: 'klinika_a', lastPacketAt: '2026-09-27T03:05:00.000Z' },
    ]);
    expect(merged.clinics[0]?.lastPacketAt).toBe('2026-09-27T04:00:00.000Z');
    expect(merged).toBe(own);
  });
});

const WARNINGS: BackendSamsWarnings = {
  day: '2026-09-27',
  digestDay: '2026-09-27',
  unresolved: {
    count: 2,
    groups: [
      {
        dbname: 'klinika_a',
        orgTitle: 'Akfa klinikasi',
        residents: [
          { resident: 'r1', fullName: 'Aliyev Vali', jshshir: '30101990000011', isNew: true },
        ],
      },
      {
        dbname: null,
        orgTitle: null,
        residents: [{ resident: 'r2', fullName: 'Karimova Nodira', jshshir: '40202990000022' }],
      },
    ],
  },
  ambiguous: {
    count: 1,
    items: [
      {
        resident: 'r3',
        fullName: 'Toshev Bek',
        jshshir: '30303990000033',
        isNew: false,
        clinics: [
          { dbname: 'klinika_a', orgTitle: 'Akfa klinikasi' },
          { dbname: 'klinika_b', orgTitle: 'Respublika klinikasi' },
        ],
      },
    ],
  },
  noSchedule: { count: 0, groups: [] },
  inactiveUser: { count: 0, groups: [] },
  tenantSetChanged: {
    changes: [
      { at: '2026-09-27T04:00:00.000Z', from: 7, to: 6, added: [], removed: ['klinika_c'] },
      {
        at: '2026-09-20T10:00:00.000Z',
        from: 6,
        to: 7,
        added: [{ dbname: 'klinika_c', orgTitle: 'Chilonzor klinikasi' }],
        removed: [],
      },
    ],
  },
};

describe('mapWarnings', () => {
  it('bo‘sh bo‘lim → count 0 (muammo yo‘q); kalit yo‘q → null (himoya, «ma’lumot kelmagan»)', () => {
    const w = mapWarnings(WARNINGS);
    expect(w.inactiveUser).toEqual({ count: 0, groups: [] });
    expect(w.noSchedule).toEqual({ count: 0, groups: [] });
    expect(mapWarnings({ ...WARNINGS, inactiveUser: undefined }).inactiveUser).toBeNull();
  });

  it('guruhlar: klinika + odamlar, isNew faqat haqiqiy true', () => {
    const w = mapWarnings(WARNINGS);
    expect(w.unresolved?.count).toBe(2);
    expect(w.unresolved?.groups[0]).toEqual({
      clinic: { dbname: 'klinika_a', orgTitle: 'Akfa klinikasi' },
      people: [
        { residentId: 'r1', fullName: 'Aliyev Vali', jshshir: '30101990000011', isNew: true },
      ],
    });
    expect(w.unresolved?.groups[1]?.clinic).toEqual({ dbname: null, orgTitle: null });
    expect(w.unresolved?.groups[1]?.people[0]?.isNew).toBe(false);
  });

  it('ambiguous — klinikalar ro‘yxati bilan', () => {
    const item = mapWarnings(WARNINGS).ambiguous?.items[0];
    expect(item?.clinics.map((c) => c.dbname)).toEqual(['klinika_a', 'klinika_b']);
    expect(item?.isNew).toBe(false);
  });
});

describe('mapWarnings — klinikalar o‘zgarishi va buzuq javob', () => {
  it('klinikalar o‘zgarishi: sonlar doim, nomlar bo‘lsa (satr dbname ham)', () => {
    const [first, second] = mapWarnings(WARNINGS).tenantSetChanged ?? [];
    expect(first).toEqual({
      at: '2026-09-27T04:00:00.000Z',
      previousCount: 7,
      currentCount: 6,
      added: [],
      removed: [{ dbname: 'klinika_c', orgTitle: null }],
      isNew: true,
    });
    expect(second?.added).toEqual([{ dbname: 'klinika_c', orgTitle: 'Chilonzor klinikasi' }]);
    expect(second?.isNew).toBe(false);
  });

  it('himoya: server `isNew` boolean bersa — o‘shanisi ustun; ro‘yxat yo‘q → null', () => {
    const [change] =
      mapWarnings({
        digestDay: '2026-09-27',
        tenantSetChanged: {
          changes: [{ at: '2026-09-27T04:00:00.000Z', from: 7, to: 6, isNew: false }],
        },
      }).tenantSetChanged ?? [];
    expect(change?.isNew).toBe(false);
    expect(change?.added).toBeNull();
  });

  it('🔴 real SAMS javobi: `changes[]` da isNew yo‘q — digestDay’ga nisbatan (yangisi yashirinmaydi)', () => {
    const w = mapWarnings({
      day: '2026-09-27',
      digestDay: '2026-09-26',
      tenantSetChanged: {
        changes: [
          { at: '2026-09-27T04:00:00.000Z', from: 7, to: 6, added: [], removed: ['klinika_b'] },
          { at: '2026-09-25T19:30:00.000Z', from: 6, to: 7, added: [], removed: [] },
          { at: '2026-09-25T10:00:00.000Z', from: 7, to: 6, added: [], removed: [] },
        ],
      },
    });
    expect(w.tenantSetChanged?.map((c) => c.isNew)).toEqual([true, true, false]);
    const none = mapWarnings({
      digestDay: null,
      tenantSetChanged: { changes: [{ at: '2026-09-01T04:00:00.000Z', from: 7, to: 6 }] },
    });
    expect(none.tenantSetChanged?.[0]?.isNew).toBe(true);
  });

  it('real SAMS javobi: inactiveUser doim {count:0, groups:[]} — mapper uni «muammo yo‘q» deb o‘qiydi', () => {
    const w = mapWarnings({ day: '2026-09-27', inactiveUser: { count: 0, groups: [] } });
    expect(w.inactiveUser).toEqual({ count: 0, groups: [] });
  });

  it('digestDay va day o‘tadi; buzuq bo‘lim (groups massiv emas) → null', () => {
    const w = mapWarnings({
      digestDay: '2026-09-26',
      unresolved: { count: 3 } as BackendSamsWarnings['unresolved'],
    });
    expect(w.digestDay).toBe('2026-09-26');
    expect(w.unresolved).toBeNull();
    expect(w.tenantSetChanged).toBeNull();
  });

  it('count kelmasa — odamlar sonidan', () => {
    const w = mapWarnings({
      day: '2026-09-27',
      noSchedule: { groups: [{ dbname: 'k', residents: [{ fullName: 'A' }, { fullName: 'B' }] }] },
    });
    expect(w.noSchedule?.count).toBe(2);
  });
});

describe('F4-Q19 — SAMS `day: null` (SAMS ma’lumot kuni yo‘q)', () => {
  const EMPTY_WIRE: BackendSamsWarnings = {
    day: null,
    digestDay: null,
    unresolved: { count: 0, groups: [] },
    ambiguous: { count: 0, items: [] },
    noSchedule: { count: 0, groups: [] },
    inactiveUser: { count: 0, groups: [] },
    tenantSetChanged: {
      changes: [{ at: '2026-09-27T04:00:00.000Z', from: 7, to: 6, added: [], removed: [] }],
    },
  };

  it('🔴 /warnings: shaxs bo‘limlari null («Ma’lumot kelmagan», «Muammo yo‘q» EMAS)', () => {
    const w = mapWarnings(EMPTY_WIRE);
    expect(w.day).toBeNull();
    expect([w.unresolved, w.ambiguous, w.noSchedule, w.inactiveUser]).toEqual([
      null,
      null,
      null,
      null,
    ]);
    expect(w.tenantSetChanged).toHaveLength(1);
  });

  it('🔴 /overview `warnings`: sonlar null (0 EMAS), o‘zgarish vaqti saqlanadi', () => {
    const o = mapOverview({
      warnings: {
        ...OVERVIEW_WIRE.warnings,
        day: null,
        unresolved: 0,
        noSchedule: 0,
      },
    });
    expect(o.warnings).toEqual({
      unresolved: null,
      ambiguous: null,
      noSchedule: null,
      inactiveUser: null,
      tenantChangedAt: '2026-09-26T10:00:00.000Z',
    });
  });
});

const OUTAGE: BackendSamsOutage = {
  _id: '66f0c0ffee0000000000abcd',
  from: '2026-09-20',
  to: '2026-09-22',
  dbname: null,
  orgTitle: null,
  reason: 'SAMS serveri ishlamadi',
  createdBy: { firstName: 'Vali', lastName: 'Aliyev', middleName: 'G‘ani o‘g‘li' },
  createdAt: '2026-09-23T05:00:00.000Z',
  cancelledAt: null,
  cancelledBy: null,
  cancelReason: null,
};

describe('mapOutage', () => {
  it('_id → id, dbname null (barcha klinikalar) saqlanadi, faol', () => {
    const o = mapOutage(OUTAGE);
    expect(o.id).toBe('66f0c0ffee0000000000abcd');
    expect(o.dbname).toBeNull();
    expect(o.status).toBe('active');
    expect(o.createdByName).toBe('Aliyev Vali G‘ani o‘g‘li');
  });

  it('cancelledAt → cancelled, kim va sabab bilan', () => {
    const o = mapOutage({
      ...OUTAGE,
      dbname: 'klinika_a',
      orgTitle: 'Akfa klinikasi',
      cancelledAt: '2026-09-24T06:00:00.000Z',
      cancelledBy: { firstName: 'Nodira', lastName: 'Karimova' },
      cancelReason: 'Xato e’lon qilingan',
    });
    expect(o.status).toBe('cancelled');
    expect(o.cancelledByName).toBe('Karimova Nodira');
    expect(o.cancelReason).toBe('Xato e’lon qilingan');
    expect(o.orgTitle).toBe('Akfa klinikasi');
  });

  it('🔴 natijada `_id` kaliti yo‘q (hech bir mapperda)', () => {
    const all = [
      mapOutage(OUTAGE),
      mapOverview(OVERVIEW),
      mapGrid(DAYS, { from: '2026-09-25', to: '2026-09-27' }),
      mapWarnings(WARNINGS),
    ];
    all.forEach((x) => expect(JSON.stringify(x)).not.toContain('_id'));
  });
});
