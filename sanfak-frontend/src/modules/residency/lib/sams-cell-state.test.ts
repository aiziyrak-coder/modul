import { describe, expect, it } from 'vitest';
import type { SamsDayCell, SamsGrid, SamsOutage, SamsOverview } from '../api/sams-status-types';
import {
  CELL_STATE_META,
  LEGEND_STATES,
  addDays,
  canDeclareOutage,
  cellText,
  countDayStates,
  coverageOf,
  daySpan,
  defaultGridWindow,
  deriveCellState,
  enumerateDays,
  findCoveringOutage,
  isCoveredByOutage,
  isDayKey,
  outageLayerState,
  packetAgeMinutes,
  shortDay,
  todayCoverage,
  unmeasuredReasonLabel,
  validateGridWindow,
  weekdayShort,
  type CellStateInput,
  type SamsCellState,
} from './sams-cell-state';

const cell = (over: Partial<SamsDayCell> = {}): SamsDayCell => ({
  day: '2026-09-20',
  delivery: 'final',
  measured: true,
  unmeasuredReason: null,
  expectedResidents: 5,
  scannedResidents: 3,
  rosterScanCount: 9,
  packetAt: '2026-09-21T01:00:00.000Z',
  receivedAt: '2026-09-21T01:00:05.000Z',
  ...over,
});

const input = (over: Partial<CellStateInput> = {}): CellStateInput => ({
  cell: cell(),
  working: true,
  isToday: false,
  isFuture: false,
  outageCovered: false,
  ...over,
});

const state = (over: Partial<CellStateInput>) => deriveCellState(input(over));

const outage = (over: Partial<SamsOutage> = {}): SamsOutage => ({
  id: 'o1',
  from: '2026-09-18',
  to: '2026-09-20',
  dbname: 'klinika_a',
  orgTitle: 'Klinika A',
  reason: 'SAMS serveri ishlamadi',
  createdByName: 'Aliyev Vali',
  createdAt: '2026-09-21T05:00:00.000Z',
  status: 'active',
  cancelledAt: null,
  cancelledByName: null,
  cancelReason: null,
  ...over,
});

describe('deriveCellState — ustuvorlik', () => {
  it('kelajak kuni — qator bo‘lsa ham «future»', () => {
    expect(state({ isFuture: true, outageCovered: true })).toBe('future');
  });

  it('uzilish har holatdan ustun (zeroScan va full ustidan ham)', () => {
    expect(state({ cell: cell({ scannedResidents: 0 }), outageCovered: true })).toBe('outage');
    expect(state({ cell: cell({ scannedResidents: 5 }), outageCovered: true })).toBe('outage');
    expect(state({ cell: null, outageCovered: true })).toBe('outage');
  });
});

describe('deriveCellState — 🔴 uzilish qatlami noma’lum (null)', () => {
  const zero = cell({ scannedResidents: 0 });

  it('yopilgan 0 skan — qizil EMAS, «tekshirib bo‘lmadi» (neytral) va bosilmaydi', () => {
    const s = state({ cell: zero, outageCovered: null });
    expect(s).toBe('zeroScanUnverified');
    expect(CELL_STATE_META[s].tone).not.toBe('danger');
    expect(canDeclareOutage(s)).toBe(false);
    expect(state({ cell: zero, outageCovered: false })).toBe('zeroScan');
  });

  it('boshqa holatlar o‘zgarmaydi (faqat qizil yumshatiladi)', () => {
    expect(state({ cell: cell(), outageCovered: null })).toBe('partial');
    expect(state({ cell: null, outageCovered: null })).toBe('noData');
    expect(state({ isFuture: true, outageCovered: null })).toBe('future');
  });
});

describe('deriveCellState — 🔴 D-MODE 1: o‘lchanmagan kun qizil EMAS', () => {
  it('qatorsiz: ish kuni → noData, dam kuni → nonWorking', () => {
    expect(state({ cell: null })).toBe('noData');
    expect(state({ cell: null, working: false })).toBe('nonWorking');
  });

  it('delivery «none» — qatorsiz bilan bir xil', () => {
    expect(state({ cell: cell({ delivery: 'none', scannedResidents: 0 }) })).toBe('noData');
  });

  it('🔴 measured=false, expected>0, scanned=0 → unmeasured (HECH QACHON zeroScan)', () => {
    expect(state({ cell: cell({ measured: false, scannedResidents: 0 }) })).toBe('unmeasured');
  });

  it('🔴 stale (watchdog) — yopilgan sonlar bo‘lsa ham unmeasured', () => {
    expect(state({ cell: cell({ delivery: 'stale', scannedResidents: 0 }) })).toBe('unmeasured');
  });

  it('🔴 noma‘lum delivery (kontrakt drifti) — unmeasured', () => {
    expect(state({ cell: cell({ delivery: null, scannedResidents: 0 }) })).toBe('unmeasured');
  });

  it('🔴 o‘tgan kun hali OCHIQ, 0 skan — awaitingClose (qizil emas)', () => {
    expect(state({ cell: cell({ delivery: 'open', scannedResidents: 0 }) })).toBe('awaitingClose');
  });

  it('klinika ufqidan oldin — notStarted', () => {
    expect(state({ cell: cell({ delivery: 'not_started', measured: false }) })).toBe('notStarted');
  });

  it('sonlar yo‘q (drift) — unmeasured', () => {
    expect(state({ cell: cell({ expectedResidents: null }) })).toBe('unmeasured');
  });

  it('hech bir o‘lchanmagan holat danger rangida emas', () => {
    const safe: SamsCellState[] = [
      'noData',
      'unmeasured',
      'awaitingClose',
      'notStarted',
      'nonWorking',
    ];
    safe.forEach((s) => expect(CELL_STATE_META[s].tone).not.toBe('danger'));
  });
});

describe('deriveCellState — o‘lchangan sonlar', () => {
  it('expected=0 → noResidents', () => {
    expect(state({ cell: cell({ expectedResidents: 0, scannedResidents: 0 }) })).toBe(
      'noResidents',
    );
  });

  it('yopilgan o‘tgan ish kuni, 0 skan → zeroScan', () => {
    expect(state({ cell: cell({ scannedResidents: 0 }) })).toBe('zeroScan');
  });

  it('bugun, 0 skan → pendingToday (yopilgan bo‘lsa ham, ochiq bo‘lsa ham)', () => {
    expect(state({ cell: cell({ scannedResidents: 0 }), isToday: true })).toBe('pendingToday');
    expect(state({ cell: cell({ delivery: 'open', scannedResidents: 0 }), isToday: true })).toBe(
      'pendingToday',
    );
  });

  it('bugun, skan bor — dastlabki (awaitingClose)', () => {
    expect(state({ cell: cell({ delivery: 'open', scannedResidents: 5 }), isToday: true })).toBe(
      'awaitingClose',
    );
  });

  it('dam kuni, 0 skan → nonWorking', () => {
    expect(state({ cell: cell({ scannedResidents: 0 }), working: false })).toBe('nonWorking');
  });

  it('scanned ≥ expected → full; 0 < s < e → partial', () => {
    expect(state({ cell: cell({ scannedResidents: 5 }) })).toBe('full');
    expect(state({ cell: cell({ scannedResidents: 6 }) })).toBe('full');
    expect(state({ cell: cell({ scannedResidents: 2 }) })).toBe('partial');
  });
});

describe('katak matni va meta', () => {
  it('har holat uchun label, legendda future yo‘q', () => {
    Object.values(CELL_STATE_META).forEach((m) => expect(m.label.length).toBeGreaterThan(0));
    expect(LEGEND_STATES).not.toContain('future');
    expect(new Set(LEGEND_STATES).size).toBe(Object.keys(CELL_STATE_META).length - 1);
  });

  it('N/M, uzilish «U», o‘lchanmagan «—», qatorsiz bo‘sh', () => {
    expect(cellText('partial', cell())).toBe('3/5');
    expect(cellText('zeroScan', cell({ scannedResidents: 0 }))).toBe('0/5');
    expect(cellText('outage', cell())).toBe('U');
    expect(cellText('unmeasured', cell())).toBe('—');
    expect(cellText('noData', null)).toBe('');
  });

  it('o‘lchanmaganlik sababi matni; noma’lum kod o‘zgarishsiz', () => {
    expect(unmeasuredReasonLabel('stale')).toMatch(/eskirgan/);
    expect(unmeasuredReasonLabel('new_code')).toBe('new_code');
    expect(unmeasuredReasonLabel(null)).toBeNull();
  });

  it('canDeclareOutage — kelajak, qoplangan va qatlami noma’lum kun uchun yo‘q', () => {
    expect(canDeclareOutage('zeroScan')).toBe(true);
    expect(canDeclareOutage('noData')).toBe(true);
    expect(canDeclareOutage('future')).toBe(false);
    expect(canDeclareOutage('outage')).toBe(false);
    expect(canDeclareOutage('zeroScanUnverified')).toBe(false);
  });
});

describe('isCoveredByOutage', () => {
  it('dbname=null — barcha klinikalarni qoplaydi', () => {
    expect(isCoveredByOutage('klinika_b', '2026-09-19', [outage({ dbname: null })])).toBe(true);
  });

  it('klinika oynasi faqat o‘zini qoplaydi', () => {
    expect(isCoveredByOutage('klinika_a', '2026-09-19', [outage()])).toBe(true);
    expect(isCoveredByOutage('klinika_b', '2026-09-19', [outage()])).toBe(false);
  });

  it('chegaralar kiradi, tashqarisi yo‘q', () => {
    expect(isCoveredByOutage('klinika_a', '2026-09-18', [outage()])).toBe(true);
    expect(isCoveredByOutage('klinika_a', '2026-09-20', [outage()])).toBe(true);
    expect(isCoveredByOutage('klinika_a', '2026-09-17', [outage()])).toBe(false);
    expect(isCoveredByOutage('klinika_a', '2026-09-21', [outage()])).toBe(false);
  });

  it('bekor qilingan oyna e‘tiborsiz', () => {
    expect(isCoveredByOutage('klinika_a', '2026-09-19', [outage({ status: 'cancelled' })])).toBe(
      false,
    );
  });

  it('findCoveringOutage — qoplagan faol oynaning o‘zi (sababi tooltipda)', () => {
    const list = [outage({ id: 'x', status: 'cancelled' }), outage({ id: 'y', dbname: null })];
    expect(findCoveringOutage('klinika_a', '2026-09-19', list)?.id).toBe('y');
    expect(findCoveringOutage('klinika_a', '2026-09-25', list)).toBeNull();
  });
});

const TODAY = '2026-09-22';

function grid(): SamsGrid {
  return {
    from: '2026-09-18',
    to: '2026-09-23',
    days: [
      { day: '2026-09-18', working: true },
      { day: '2026-09-19', working: true },
      { day: '2026-09-20', working: false },
      { day: '2026-09-21', working: true },
      { day: '2026-09-22', working: true },
      { day: '2026-09-23', working: true },
    ],
    clinics: [
      {
        dbname: 'klinika_a',
        orgTitle: 'Klinika A',
        live: true,
        firstDay: '2026-01-01',
        lastPacketAt: null,
        deliveredThrough: null,
        cells: {
          '2026-09-19': cell({ day: '2026-09-19', scannedResidents: 0 }),
          '2026-09-20': cell({ day: '2026-09-20', scannedResidents: 0 }),
          '2026-09-21': cell({ day: '2026-09-21', measured: false }),
          '2026-09-22': cell({ day: '2026-09-22', delivery: 'open', scannedResidents: 0 }),
        },
      },
      {
        dbname: 'klinika_b',
        orgTitle: 'Klinika B',
        live: true,
        firstDay: '2026-01-01',
        lastPacketAt: null,
        deliveredThrough: null,
        cells: {
          '2026-09-18': cell({ day: '2026-09-18', scannedResidents: 0 }),
          '2026-09-19': cell({ day: '2026-09-19', scannedResidents: 0 }),
          '2026-09-21': cell({ day: '2026-09-21', scannedResidents: 5 }),
        },
      },
    ],
  };
}

describe('countDayStates', () => {
  it('bugun/kelajak/dam kuni chiqariladi; noData+unmeasured → unmeasured; zeroScan → suspect', () => {
    expect(countDayStates(grid(), [], TODAY, true)).toEqual({ unmeasured: 2, suspect: 3 });
  });

  it('uzilish qoplagan kun sanalmaydi', () => {
    const covered = [outage({ from: '2026-09-18', to: '2026-09-19', dbname: 'klinika_b' })];
    expect(countDayStates(grid(), covered, TODAY, true)).toEqual({ unmeasured: 2, suspect: 1 });
  });

  it('🔴 F4-Q18: qatlam to‘liq emas — qoplangani sanalmaydi, shubhali son `null` (1 EMAS)', () => {
    const covered = [outage({ from: '2026-09-18', to: '2026-09-19', dbname: 'klinika_b' })];
    expect(countDayStates(grid(), covered, TODAY, false)).toEqual({ unmeasured: 2, suspect: null });
  });

  it('🔴 qatlam noma’lum (null) — shubhali son `null` («—»), 0 yoki 3 EMAS', () => {
    expect(countDayStates(grid(), null, TODAY, true)).toEqual({ unmeasured: 2, suspect: null });
  });
});

describe('uzilish qoplami — uch holat (F4-Q10, F4-Q18)', () => {
  it('coverageOf: topilgan oyna — doim true; topilmadi — to‘liq ma’lum bo‘lsa false, aks holda null', () => {
    expect(coverageOf(outage(), false)).toBe(true);
    expect(coverageOf(outage(), true)).toBe(true);
    expect(coverageOf(null, true)).toBe(false);
    expect(coverageOf(null, false)).toBeNull();
  });

  it('outageLayerState: yiqilgan > yuklanmoqda > to‘liq emas > ma’lum', () => {
    expect(outageLayerState(true, [outage()], true)).toBe('failed');
    expect(outageLayerState(false, null, true)).toBe('loading');
    expect(outageLayerState(false, [], false)).toBe('partial');
    expect(outageLayerState(false, [], true)).toBe('known');
  });
});

describe('todayCoverage', () => {
  const overview = (clinics: SamsOverview['clinics']): SamsOverview => ({
    now: null,
    today: TODAY,
    liveness: 'ok',
    lastPacket: null,
    deliveredThrough: null,
    gapDays: null,
    oldestGap: null,
    clinics,
    warnings: null,
  });
  const clinic = (today: SamsOverview['clinics'][number]['today']) => ({
    dbname: 'k',
    orgTitle: 'K',
    live: true,
    lastPacketAt: null,
    deliveredThrough: null,
    gapCount: null,
    today,
  });

  it('faqat o‘lchangan qatorlar yig‘iladi', () => {
    const o = overview([
      clinic({ delivery: 'open', measured: true, expectedResidents: 4, scannedResidents: 3 }),
      clinic({ delivery: 'stale', measured: false, expectedResidents: 9, scannedResidents: 0 }),
      clinic({ delivery: 'open', measured: true, expectedResidents: 2, scannedResidents: 0 }),
    ]);
    expect(todayCoverage(o)).toEqual({ scanned: 3, expected: 6 });
  });

  it('o‘lchangan qator yo‘q — null («—», 0/0 emas)', () => {
    expect(todayCoverage(overview([clinic(null)]))).toBeNull();
  });

  it('🔴 `stale` qator `measured: true` bo‘lsa ham sanalmaydi (jadvalda ham «o‘lchanmagan»)', () => {
    const staleToday = {
      delivery: 'stale' as const,
      measured: true,
      expectedResidents: 50,
      scannedResidents: 0,
    };
    expect(todayCoverage(overview([clinic(staleToday)]))).toBeNull();
    expect(
      deriveCellState(input({ cell: cell({ ...staleToday, day: TODAY }), isToday: true })),
    ).toBe('unmeasured');
    const mixed = overview([
      clinic(staleToday),
      clinic({ delivery: 'open', measured: true, expectedResidents: 4, scannedResidents: 1 }),
    ]);
    expect(todayCoverage(mixed)).toEqual({ scanned: 1, expected: 4 });
  });

  it('noma’lum `delivery` (null) — sanalmaydi', () => {
    const o = overview([
      clinic({ delivery: null, measured: true, expectedResidents: 3, scannedResidents: 3 }),
    ]);
    expect(todayCoverage(o)).toBeNull();
  });
});

describe('packetAgeMinutes', () => {
  it('server vaqtiga nisbatan butun daqiqa; manfiy bo‘lmaydi; noma’lum → null', () => {
    expect(packetAgeMinutes('2026-09-27T03:20:00.000Z', '2026-09-27T03:05:30.000Z')).toBe(14);
    expect(packetAgeMinutes('2026-09-27T03:00:00.000Z', '2026-09-27T03:05:00.000Z')).toBe(0);
    expect(packetAgeMinutes(null, '2026-09-27T03:05:00.000Z')).toBeNull();
    expect(packetAgeMinutes('x', '2026-09-27T03:05:00.000Z')).toBeNull();
  });
});

describe('kun kaliti arifmetikasi', () => {
  it('weekdayShort(2026-09-27) — yakshanba «Ya»', () => {
    expect(weekdayShort('2026-09-27')).toBe('Ya');
    expect(weekdayShort('2026-09-28')).toBe('Du');
    expect(weekdayShort('x')).toBe('');
  });

  it('enumerateDays — oy chegarasi, 4 kun', () => {
    expect(enumerateDays('2026-09-29', '2026-10-02')).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ]);
  });

  it('enumerateDays — teskari yoki buzuq oraliq bo‘sh', () => {
    expect(enumerateDays('2026-10-02', '2026-09-29')).toEqual([]);
    expect(enumerateDays('x', '2026-09-29')).toEqual([]);
  });

  it('isDayKey — mavjud bo‘lmagan kun rad', () => {
    expect(isDayKey('2026-02-28')).toBe(true);
    expect(isDayKey('2026-02-30')).toBe(false);
    expect(isDayKey('2026-9-1')).toBe(false);
  });

  it('addDays / daySpan / shortDay', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(daySpan('2026-09-01', '2026-09-01')).toBe(1);
    expect(daySpan('2026-09-02', '2026-09-01')).toBeNull();
    expect(shortDay('2026-09-05')).toBe('05.09');
  });
});

describe('jadval oynasi', () => {
  it('standart — oxirgi 14 kun, bugun kiradi', () => {
    expect(defaultGridWindow('2026-09-27')).toEqual({ from: '2026-09-14', to: '2026-09-27' });
  });

  it('31 kun o‘tadi, 32 — xato; teskari — xato', () => {
    expect(validateGridWindow('2026-09-01', '2026-10-01')).toBeNull();
    expect(validateGridWindow('2026-09-01', '2026-10-02')).toMatch(/31 kundan/);
    expect(validateGridWindow('2026-09-10', '2026-09-01')).not.toBeNull();
  });
});
