import { nameOf } from './user-name';
import type {
  BackendAmbiguousSection,
  BackendClinicRef,
  BackendClinicToday,
  BackendDayRow,
  BackendDaysClinic,
  BackendGroupedSection,
  BackendOverviewClinic,
  BackendSamsDays,
  BackendSamsOutage,
  BackendSamsOverview,
  BackendSamsWarnings,
  BackendTenantChange,
  BackendWarnGroup,
  BackendWarnPerson,
  BackendWarningCounts,
} from './sams-status-backend-types';
import {
  SAMS_DELIVERIES,
  SAMS_LIVENESS,
  type SamsAmbiguousPerson,
  type SamsAmbiguousSection,
  type SamsClinicRef,
  type SamsClinicRow,
  type SamsClinicSummary,
  type SamsClinicToday,
  type SamsDay,
  type SamsDayCell,
  type SamsDayInfo,
  type SamsGrid,
  type SamsGroupedSection,
  type SamsOutage,
  type SamsOverview,
  type SamsTenantChange,
  type SamsWarnGroup,
  type SamsWarnPerson,
  type SamsWarningCounts,
  type SamsWarnings,
} from './sams-status-types';
import { enumerateDays } from '../lib/sams-cell-state';
import { uzDayKey } from '../lib/uz-day';

export type {
  BackendSamsDays,
  BackendSamsOutage,
  BackendSamsOverview,
  BackendSamsWarnings,
} from './sams-status-backend-types';

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const flag = (v: unknown): boolean => v === true;
const isObj = <T>(v: T | null | undefined): v is T =>
  !!v && typeof v === 'object' && !Array.isArray(v);

function oneOf<T extends string>(values: readonly T[], v: unknown): T | null {
  return typeof v === 'string' && (values as readonly string[]).includes(v) ? (v as T) : null;
}

const byTitle = (
  a: { orgTitle: string; dbname: string },
  b: { orgTitle: string; dbname: string },
) => a.orgTitle.localeCompare(b.orgTitle, 'uz') || a.dbname.localeCompare(b.dbname);

const NO_PERSON_DATA = {
  unresolved: null,
  ambiguous: null,
  noSchedule: null,
  inactiveUser: null,
} as const;

function mapClinicToday(b: BackendClinicToday | null | undefined): SamsClinicToday | null {
  if (!isObj(b)) return null;
  return {
    delivery: oneOf(SAMS_DELIVERIES, b.delivery),
    measured: flag(b.measured),
    expectedResidents: num(b.expectedResidents),
    scannedResidents: num(b.scannedResidents),
  };
}

function mapOverviewClinic(b: BackendOverviewClinic): SamsClinicSummary | null {
  const dbname = str(b.dbname);
  if (!dbname) return null;
  return {
    dbname,
    orgTitle: str(b.orgTitle) ?? dbname,
    live: flag(b.live),
    lastPacketAt: str(b.lastPacketAt),
    deliveredThrough: str(b.deliveredThrough),
    gapCount: num(b.gapCount),
    today: mapClinicToday(b.today),
  };
}

function mapWarningCounts(b: BackendWarningCounts | null | undefined): SamsWarningCounts | null {
  if (!isObj(b)) return null;
  const tenantChangedAt = isObj(b.tenantSetChanged) ? str(b.tenantSetChanged.at) : null;
  if (str(b.day) === null) return { ...NO_PERSON_DATA, tenantChangedAt };
  return {
    unresolved: num(b.unresolved),
    ambiguous: num(b.ambiguous),
    noSchedule: num(b.noSchedule),
    inactiveUser: num(b.inactiveUser),
    tenantChangedAt,
  };
}

export function mapOverview(b: BackendSamsOverview): SamsOverview {
  const packet = b.liveness?.lastPacket;
  return {
    now: str(b.now),
    today: str(b.today),
    liveness: oneOf(SAMS_LIVENESS, b.liveness?.state),
    lastPacket: isObj(packet)
      ? { receivedAt: str(packet.receivedAt), emittedAt: str(packet.emittedAt) }
      : null,
    deliveredThrough: str(b.delivery?.deliveredThrough),
    gapDays: num(b.delivery?.gapDays),
    oldestGap: str(b.delivery?.oldestGap),
    clinics: (Array.isArray(b.clinics) ? b.clinics : [])
      .map(mapOverviewClinic)
      .filter((c): c is SamsClinicSummary => c !== null)
      .sort(byTitle),
    warnings: mapWarningCounts(b.warnings),
  };
}

function mapDayRow(b: BackendDayRow): SamsDayCell | null {
  const day = str(b.day);
  if (!day) return null;
  return {
    day,
    delivery: oneOf(SAMS_DELIVERIES, b.delivery),
    measured: flag(b.measured),
    unmeasuredReason: str(b.unmeasuredReason),
    expectedResidents: num(b.expectedResidents),
    scannedResidents: num(b.scannedResidents),
    rosterScanCount: num(b.rosterScanCount),
    packetAt: str(b.packetAt),
    receivedAt: str(b.receivedAt),
  };
}

function mapDaysClinic(b: BackendDaysClinic): SamsClinicRow | null {
  const dbname = str(b.dbname);
  if (!dbname) return null;
  const cells: Record<SamsDay, SamsDayCell> = {};
  for (const row of Array.isArray(b.days) ? b.days : []) {
    const cell = isObj(row) ? mapDayRow(row) : null;
    if (cell) cells[cell.day] = cell;
  }
  return {
    dbname,
    orgTitle: str(b.orgTitle) ?? dbname,
    live: flag(b.live),
    firstDay: str(b.firstDay),
    lastPacketAt: str(b.lastPacketAt),
    deliveredThrough: str(b.deliveredThrough),
    cells,
  };
}

function mapDayInfos(b: BackendSamsDays, from: SamsDay, to: SamsDay): SamsDayInfo[] {
  const nonWorking = new Set(
    (Array.isArray(b.days) ? b.days : [])
      .filter((d) => isObj(d) && d.working === false)
      .map((d) => str(d.day)),
  );
  return enumerateDays(from, to).map((day) => ({ day, working: !nonWorking.has(day) }));
}

export function withOverviewPackets(
  grid: SamsGrid,
  clinics: readonly Pick<SamsClinicSummary, 'dbname' | 'lastPacketAt'>[],
): SamsGrid {
  const byDb = new Map(clinics.map((c) => [c.dbname, c.lastPacketAt]));
  let changed = false;
  const rows = grid.clinics.map((row) => {
    const lastPacketAt = row.lastPacketAt ?? byDb.get(row.dbname) ?? null;
    if (lastPacketAt === row.lastPacketAt) return row;
    changed = true;
    return { ...row, lastPacketAt };
  });
  return changed ? { ...grid, clinics: rows } : grid;
}

export function mapGrid(b: BackendSamsDays, requested: { from: SamsDay; to: SamsDay }): SamsGrid {
  const from = str(b.from) ?? requested.from;
  const to = str(b.to) ?? requested.to;
  return {
    from,
    to,
    days: mapDayInfos(b, from, to),
    clinics: (Array.isArray(b.clinics) ? b.clinics : [])
      .map(mapDaysClinic)
      .filter((c): c is SamsClinicRow => c !== null)
      .sort(byTitle),
  };
}

function residentIdOf(v: BackendWarnPerson['resident']): string | null {
  if (typeof v === 'string') return str(v);
  return isObj(v) ? str(v._id) : null;
}

function mapPerson(b: BackendWarnPerson): SamsWarnPerson {
  return {
    residentId: residentIdOf(b.resident),
    fullName: str(b.fullName) ?? 'Noma’lum rezident',
    jshshir: str(b.jshshir),
    isNew: flag(b.isNew),
  };
}

function mapClinicRef(b: BackendClinicRef | string): SamsClinicRef {
  if (typeof b === 'string') return { dbname: str(b), orgTitle: null };
  return isObj(b)
    ? { dbname: str(b.dbname), orgTitle: str(b.orgTitle) }
    : { dbname: null, orgTitle: null };
}

const objects = <T>(v: T[] | null | undefined): T[] =>
  (Array.isArray(v) ? v : []).filter((x): boolean => isObj(x));

function mapGroup(b: BackendWarnGroup): SamsWarnGroup {
  return { clinic: mapClinicRef(b), people: objects(b.residents).map(mapPerson) };
}

function mapGroupedSection(b: BackendGroupedSection | null | undefined): SamsGroupedSection | null {
  if (!isObj(b) || !Array.isArray(b.groups)) return null;
  const groups = objects(b.groups).map(mapGroup);
  const people = groups.reduce((n, g) => n + g.people.length, 0);
  return { count: num(b.count) ?? people, groups };
}

function mapAmbiguous(b: BackendAmbiguousSection | null | undefined): SamsAmbiguousSection | null {
  if (!isObj(b) || !Array.isArray(b.items)) return null;
  const items: SamsAmbiguousPerson[] = objects(b.items).map((it) => ({
    ...mapPerson(it),
    clinics: objects(it.clinics).map(mapClinicRef),
  }));
  return { count: num(b.count) ?? items.length, items };
}

const refList = (v: BackendTenantChange['added']): SamsClinicRef[] | null =>
  Array.isArray(v)
    ? v.map(mapClinicRef).filter((r) => r.dbname !== null || r.orgTitle !== null)
    : null;

function tenantIsNew(c: BackendTenantChange, digestDay: SamsDay | null): boolean {
  if (typeof c.isNew === 'boolean') return c.isNew;
  const day = uzDayKey(str(c.at));
  return digestDay === null || day === null || day >= digestDay;
}

function mapTenantChanges(
  b: BackendSamsWarnings['tenantSetChanged'],
  digestDay: SamsDay | null,
): SamsTenantChange[] | null {
  if (!isObj(b) || !Array.isArray(b.changes)) return null;
  return objects(b.changes).map((c) => ({
    at: str(c.at),
    previousCount: num(c.from),
    currentCount: num(c.to),
    added: refList(c.added),
    removed: refList(c.removed),
    isNew: tenantIsNew(c, digestDay),
  }));
}

export function mapWarnings(b: BackendSamsWarnings): SamsWarnings {
  const day = str(b.day);
  const digestDay = str(b.digestDay);
  const people =
    day === null
      ? NO_PERSON_DATA
      : {
          unresolved: mapGroupedSection(b.unresolved),
          ambiguous: mapAmbiguous(b.ambiguous),
          noSchedule: mapGroupedSection(b.noSchedule),
          inactiveUser: mapGroupedSection(b.inactiveUser),
        };
  return {
    day,
    digestDay,
    ...people,
    tenantSetChanged: mapTenantChanges(b.tenantSetChanged, digestDay),
  };
}

export function mapOutage(b: BackendSamsOutage): SamsOutage {
  const cancelledAt = str(b.cancelledAt);
  return {
    id: b._id,
    from: str(b.from) ?? '',
    to: str(b.to) ?? '',
    dbname: str(b.dbname),
    orgTitle: str(b.orgTitle),
    reason: str(b.reason) ?? '',
    createdByName: nameOf(b.createdBy),
    createdAt: str(b.createdAt),
    status: cancelledAt ? 'cancelled' : 'active',
    cancelledAt,
    cancelledByName: nameOf(b.cancelledBy),
    cancelReason: str(b.cancelReason),
  };
}
