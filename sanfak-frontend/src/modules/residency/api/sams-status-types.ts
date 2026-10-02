export type SamsDay = string;

export const SAMS_DELIVERIES = ['not_started', 'none', 'open', 'stale', 'final'] as const;
export type SamsDelivery = (typeof SAMS_DELIVERIES)[number];

export const SAMS_LIVENESS = ['ok', 'stale', 'never'] as const;
export type SamsLiveness = (typeof SAMS_LIVENESS)[number];

export interface SamsLastPacket {
  receivedAt: string | null;
  emittedAt: string | null;
}

export interface SamsClinicToday {
  delivery: SamsDelivery | null;
  measured: boolean;
  expectedResidents: number | null;
  scannedResidents: number | null;
}

export interface SamsClinicSummary {
  dbname: string;
  orgTitle: string;
  live: boolean;
  lastPacketAt: string | null;
  deliveredThrough: SamsDay | null;
  gapCount: number | null;
  today: SamsClinicToday | null;
}

export interface SamsWarningCounts {
  unresolved: number | null;
  ambiguous: number | null;
  noSchedule: number | null;
  inactiveUser: number | null;
  tenantChangedAt: string | null;
}

export interface SamsOverview {
  now: string | null;
  today: SamsDay | null;
  liveness: SamsLiveness | null;
  lastPacket: SamsLastPacket | null;
  deliveredThrough: SamsDay | null;
  gapDays: number | null;
  oldestGap: SamsDay | null;
  clinics: SamsClinicSummary[];
  warnings: SamsWarningCounts | null;
}

export interface SamsDayInfo {
  day: SamsDay;
  working: boolean;
}

export interface SamsDayCell {
  day: SamsDay;
  delivery: SamsDelivery | null;
  measured: boolean;
  unmeasuredReason: string | null;
  expectedResidents: number | null;
  scannedResidents: number | null;
  rosterScanCount: number | null;
  packetAt: string | null;
  receivedAt: string | null;
}

export interface SamsClinicRow {
  dbname: string;
  orgTitle: string;
  live: boolean;
  firstDay: SamsDay | null;
  lastPacketAt: string | null;
  deliveredThrough: SamsDay | null;
  cells: Record<SamsDay, SamsDayCell>;
}

export interface SamsGrid {
  from: SamsDay;
  to: SamsDay;
  days: SamsDayInfo[];
  clinics: SamsClinicRow[];
}

export interface SamsClinicRef {
  dbname: string | null;
  orgTitle: string | null;
}

export interface SamsWarnPerson {
  residentId: string | null;
  fullName: string;
  jshshir: string | null;
  isNew: boolean;
}

export interface SamsWarnGroup {
  clinic: SamsClinicRef;
  people: SamsWarnPerson[];
}

export interface SamsGroupedSection {
  count: number;
  groups: SamsWarnGroup[];
}

export interface SamsAmbiguousPerson extends SamsWarnPerson {
  clinics: SamsClinicRef[];
}

export interface SamsAmbiguousSection {
  count: number;
  items: SamsAmbiguousPerson[];
}

export interface SamsTenantChange {
  at: string | null;
  previousCount: number | null;
  currentCount: number | null;
  added: SamsClinicRef[] | null;
  removed: SamsClinicRef[] | null;
  isNew: boolean;
}

export interface SamsWarnings {
  day: SamsDay | null;
  digestDay: SamsDay | null;
  unresolved: SamsGroupedSection | null;
  ambiguous: SamsAmbiguousSection | null;
  noSchedule: SamsGroupedSection | null;
  inactiveUser: SamsGroupedSection | null;
  tenantSetChanged: SamsTenantChange[] | null;
}

export type SamsOutageStatus = 'active' | 'cancelled';
export type SamsOutageStatusFilter = SamsOutageStatus | 'all';

export interface SamsOutage {
  id: string;
  from: SamsDay;
  to: SamsDay;
  dbname: string | null;
  orgTitle: string | null;
  reason: string;
  createdByName: string | null;
  createdAt: string | null;
  status: SamsOutageStatus;
  cancelledAt: string | null;
  cancelledByName: string | null;
  cancelReason: string | null;
}

export interface SamsOutageDraft {
  from: SamsDay;
  to: SamsDay;
  dbname: string;
  reason: string;
}

export interface SamsOutagePayload {
  from: SamsDay;
  to: SamsDay;
  dbname: string | null;
  reason: string;
}
