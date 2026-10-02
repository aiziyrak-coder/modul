import type {
  SamsDay,
  SamsDayCell,
  SamsGrid,
  SamsOutage,
  SamsOverview,
} from '../api/sams-status-types';

export type SamsCellState =
  | 'full'
  | 'partial'
  | 'zeroScan'
  | 'zeroScanUnverified'
  | 'pendingToday'
  | 'awaitingClose'
  | 'noResidents'
  | 'unmeasured'
  | 'noData'
  | 'notStarted'
  | 'nonWorking'
  | 'outage'
  | 'future';

export type SamsCellTone =
  'success' | 'neutral' | 'warning' | 'danger' | 'info' | 'muted' | 'outage' | 'blank';

export interface CellStateMeta {
  label: string;
  tone: SamsCellTone;
  fixed: string | null;
  sample: string;
}

export const CELL_STATE_META: Record<SamsCellState, CellStateMeta> = {
  full: { label: 'To‘liq qamrov', tone: 'success', fixed: null, sample: '5/5' },
  partial: { label: 'Qisman qamrov', tone: 'neutral', fixed: null, sample: '3/5' },
  zeroScan: {
    label: 'Hech kim skanerlanmadi — uzilish bo‘lishi mumkin',
    tone: 'danger',
    fixed: null,
    sample: '0/5',
  },
  zeroScanUnverified: {
    label:
      'Hech kim skanerlanmadi — uzilish oynalari yuklanmagan yoki to‘liq emas, tekshirib bo‘lmadi',
    tone: 'neutral',
    fixed: null,
    sample: '0/5',
  },
  pendingToday: { label: 'Bugun hali skan yo‘q', tone: 'warning', fixed: null, sample: '0/5' },
  awaitingClose: {
    label: 'Kun hali yopilmagan — dastlabki son (yakuniy paket kutilmoqda)',
    tone: 'info',
    fixed: null,
    sample: '2/5',
  },
  noResidents: { label: 'Bu klinikada rezident topilmadi', tone: 'blank', fixed: '0', sample: '0' },
  unmeasured: {
    label: 'O‘lchanmagan (SAMS javobi eskirgan yoki rezidentlar aniqlanmagan)',
    tone: 'muted',
    fixed: '—',
    sample: '—',
  },
  noData: { label: 'Ma’lumot yo‘q — o‘lchanmagan', tone: 'muted', fixed: '', sample: '' },
  notStarted: {
    label: 'Kuzatuv boshlanmagan (klinika ma’lumoti keyinroq boshlangan)',
    tone: 'blank',
    fixed: '·',
    sample: '·',
  },
  nonWorking: { label: 'Ish kuni emas', tone: 'blank', fixed: '', sample: '' },
  outage: {
    label: 'Uzilish oynasi (bo‘lim e’lon qilgan)',
    tone: 'outage',
    fixed: 'U',
    sample: 'U',
  },
  future: { label: '—', tone: 'blank', fixed: '', sample: '' },
};

export const LEGEND_STATES: readonly SamsCellState[] = [
  'full',
  'partial',
  'zeroScan',
  'zeroScanUnverified',
  'pendingToday',
  'awaitingClose',
  'noResidents',
  'unmeasured',
  'noData',
  'notStarted',
  'nonWorking',
  'outage',
];

const UNMEASURED_REASON_LABEL: Record<string, string> = {
  stale: 'paket eskirgan (watchdog)',
  before_horizon: 'klinika ma’lumot ufqidan oldin',
  before_registration: 'rezident SAMS’da ro‘yxatdan o‘tmasdan oldin',
  unresolved: 'JSHSHIR SAMS’da topilmadi',
  ambiguous: 'JSHSHIR bir necha klinikada',
  no_schedule: 'SAMS’da smena biriktirilmagan',
};

export function unmeasuredReasonLabel(code: string | null): string | null {
  if (!code) return null;
  return UNMEASURED_REASON_LABEL[code] ?? code;
}

export interface CellStateInput {
  cell: SamsDayCell | null;
  working: boolean;
  isToday: boolean;
  isFuture: boolean;
  outageCovered: boolean | null;
}

const isCountable = (row: Pick<SamsDayCell, 'measured' | 'delivery'>): boolean =>
  row.measured && (row.delivery === 'final' || row.delivery === 'open');

function noScanState({ working, isToday }: CellStateInput, final: boolean): SamsCellState {
  if (!final) return isToday ? 'pendingToday' : 'awaitingClose';
  if (!working) return 'nonWorking';
  return isToday ? 'pendingToday' : 'zeroScan';
}

function measuredState(cell: SamsDayCell, input: CellStateInput): SamsCellState {
  const expected = cell.expectedResidents;
  const scanned = cell.scannedResidents;
  if (expected === null || scanned === null) return 'unmeasured';
  if (expected <= 0) return 'noResidents';
  const final = cell.delivery === 'final';
  if (scanned === 0) return noScanState(input, final);
  if (!final) return 'awaitingClose';
  return scanned >= expected ? 'full' : 'partial';
}

function rowState(input: CellStateInput): SamsCellState {
  const { cell, working } = input;
  if (!cell || cell.delivery === 'none') return working ? 'noData' : 'nonWorking';
  if (cell.delivery === 'not_started') return 'notStarted';
  if (!isCountable(cell)) return working ? 'unmeasured' : 'nonWorking';
  return measuredState(cell, input);
}

export function deriveCellState(input: CellStateInput): SamsCellState {
  if (input.isFuture) return 'future';
  if (input.outageCovered === true) return 'outage';
  const state = rowState(input);
  return state === 'zeroScan' && input.outageCovered === null ? 'zeroScanUnverified' : state;
}

export function coverageText(cell: SamsDayCell | null): string {
  if (!cell || cell.expectedResidents === null || cell.scannedResidents === null) return '';
  return `${cell.scannedResidents}/${cell.expectedResidents}`;
}

export function cellText(state: SamsCellState, cell: SamsDayCell | null): string {
  return CELL_STATE_META[state].fixed ?? coverageText(cell);
}

export function findCoveringOutage(
  dbname: string,
  day: SamsDay,
  outages: readonly SamsOutage[],
): SamsOutage | null {
  return (
    outages.find(
      (o) =>
        o.status === 'active' &&
        o.from <= day &&
        day <= o.to &&
        (o.dbname === null || o.dbname === dbname),
    ) ?? null
  );
}

export function coverageOf(found: SamsOutage | null, layerKnown: boolean): boolean | null {
  if (found) return true;
  return layerKnown ? false : null;
}

export type OutageLayerState = 'known' | 'partial' | 'loading' | 'failed';

export function outageLayerState(
  failed: boolean,
  outages: readonly SamsOutage[] | null,
  complete: boolean,
): OutageLayerState {
  if (failed) return 'failed';
  if (outages === null) return 'loading';
  return complete ? 'known' : 'partial';
}

export function isCoveredByOutage(
  dbname: string,
  day: SamsDay,
  outages: readonly SamsOutage[],
): boolean {
  return findCoveringOutage(dbname, day, outages) !== null;
}

export function canDeclareOutage(state: SamsCellState): boolean {
  return state !== 'future' && state !== 'outage' && state !== 'zeroScanUnverified';
}

export interface DayStateCounts {
  unmeasured: number;
  suspect: number | null;
}

export function countDayStates(
  grid: SamsGrid,
  outages: readonly SamsOutage[] | null,
  today: SamsDay,
  complete: boolean,
): DayStateCounts {
  const known = outages !== null && complete;
  let unmeasured = 0;
  let suspect = 0;
  const pastWorking = grid.days.filter((d) => d.day < today && d.working);
  for (const clinic of grid.clinics) {
    for (const { day } of pastWorking) {
      const found = outages ? findCoveringOutage(clinic.dbname, day, outages) : null;
      const state = deriveCellState({
        cell: clinic.cells[day] ?? null,
        working: true,
        isToday: false,
        isFuture: false,
        outageCovered: coverageOf(found, known),
      });
      if (state === 'noData' || state === 'unmeasured') unmeasured += 1;
      if (state === 'zeroScan') suspect += 1;
    }
  }
  return { unmeasured, suspect: known ? suspect : null };
}

export function todayCoverage(
  overview: SamsOverview,
): { scanned: number; expected: number } | null {
  let scanned = 0;
  let expected = 0;
  let counted = 0;
  for (const { today } of overview.clinics) {
    if (!today || !isCountable(today)) continue;
    if (today.expectedResidents === null || today.scannedResidents === null) continue;
    scanned += today.scannedResidents;
    expected += today.expectedResidents;
    counted += 1;
  }
  return counted > 0 ? { scanned, expected } : null;
}

export function packetAgeMinutes(serverNow: string | null, at: string | null): number | null {
  if (!serverNow || !at) return null;
  const diff = Date.parse(serverNow) - Date.parse(at);
  return Number.isNaN(diff) ? null : Math.max(0, Math.floor(diff / 60_000));
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const MAX_ENUMERATE = 400;

const dayMs = (day: string): number => Date.parse(`${day}T00:00:00.000Z`);

export function isDayKey(v: unknown): v is SamsDay {
  if (typeof v !== 'string' || !DAY_RE.test(v)) return false;
  const t = dayMs(v);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === v;
}

export function addDays(day: SamsDay, n: number): SamsDay {
  return new Date(dayMs(day) + n * DAY_MS).toISOString().slice(0, 10);
}

export function daySpan(from: SamsDay, to: SamsDay): number | null {
  if (!isDayKey(from) || !isDayKey(to) || from > to) return null;
  return Math.round((dayMs(to) - dayMs(from)) / DAY_MS) + 1;
}

export function enumerateDays(from: SamsDay, to: SamsDay): SamsDay[] {
  const span = daySpan(from, to);
  if (span === null) return [];
  const count = Math.min(span, MAX_ENUMERATE);
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}

const WEEKDAYS = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'] as const;

export function weekdayShort(day: SamsDay): string {
  return isDayKey(day) ? (WEEKDAYS[new Date(dayMs(day)).getUTCDay()] ?? '') : '';
}

export function shortDay(day: SamsDay): string {
  return isDayKey(day) ? `${day.slice(8, 10)}.${day.slice(5, 7)}` : day;
}

export const GRID_DEFAULT_DAYS = 14;
export const GRID_MAX_DAYS = 31;

export function defaultGridWindow(today: SamsDay): { from: SamsDay; to: SamsDay } {
  return { from: addDays(today, -(GRID_DEFAULT_DAYS - 1)), to: today };
}

export function validateGridWindow(from: SamsDay, to: SamsDay): string | null {
  if (!isDayKey(from) || !isDayKey(to)) return 'Sana noto‘g‘ri';
  if (from > to) return 'Boshlanish sanasi tugash sanasidan keyin bo‘lmasin';
  const span = daySpan(from, to) ?? 0;
  if (span > GRID_MAX_DAYS) return `Oyna ${GRID_MAX_DAYS} kundan oshmasin (tanlangan: ${span} kun)`;
  return null;
}
