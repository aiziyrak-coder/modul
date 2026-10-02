import type { MaybeUserName } from './user-name';

export interface BackendLastPacket {
  receivedAt?: string | null;
  emittedAt?: string | null;
}

export interface BackendClinicToday {
  delivery?: string | null;
  measured?: boolean | null;
  expectedResidents?: number | null;
  scannedResidents?: number | null;
}

export interface BackendOverviewClinic {
  dbname?: string | null;
  orgTitle?: string | null;
  live?: boolean | null;
  lastPacketAt?: string | null;
  deliveredThrough?: string | null;
  gapCount?: number | null;
  today?: BackendClinicToday | null;
}

export interface BackendWarningCounts {
  day?: string | null;
  unresolved?: number | null;
  ambiguous?: number | null;
  noSchedule?: number | null;
  inactiveUser?: number | null;
  tenantSetChanged?: { at?: string | null } | null;
}

export interface BackendSamsOverview {
  now?: string | null;
  today?: string | null;
  liveness?: { state?: string | null; lastPacket?: BackendLastPacket | null } | null;
  delivery?: {
    deliveredThrough?: string | null;
    gapDays?: number | null;
    oldestGap?: string | null;
  } | null;
  clinics?: BackendOverviewClinic[] | null;
  warnings?: BackendWarningCounts | null;
}

export interface BackendDayRow {
  day?: string | null;
  delivery?: string | null;
  measured?: boolean | null;
  unmeasuredReason?: string | null;
  expectedResidents?: number | null;
  scannedResidents?: number | null;
  rosterScanCount?: number | null;
  packetAt?: string | null;
  receivedAt?: string | null;
}

export interface BackendDaysClinic {
  dbname?: string | null;
  orgTitle?: string | null;
  live?: boolean | null;
  firstDay?: string | null;
  lastPacketAt?: string | null;
  deliveredThrough?: string | null;
  days?: BackendDayRow[] | null;
}

export interface BackendSamsDays {
  from?: string | null;
  to?: string | null;
  days?: Array<{ day?: string | null; working?: boolean | null }> | null;
  clinics?: BackendDaysClinic[] | null;
}

export interface BackendClinicRef {
  dbname?: string | null;
  orgTitle?: string | null;
}

export interface BackendWarnPerson {
  resident?: string | { _id?: string } | null;
  fullName?: string | null;
  jshshir?: string | null;
  isNew?: boolean | null;
}

export interface BackendWarnGroup extends BackendClinicRef {
  residents?: BackendWarnPerson[] | null;
}

export interface BackendGroupedSection {
  count?: number | null;
  groups?: BackendWarnGroup[] | null;
}

export interface BackendAmbiguousItem extends BackendWarnPerson {
  clinics?: BackendClinicRef[] | null;
}

export interface BackendAmbiguousSection {
  count?: number | null;
  items?: BackendAmbiguousItem[] | null;
}

export interface BackendTenantChange {
  at?: string | null;
  from?: number | null;
  to?: number | null;
  added?: Array<BackendClinicRef | string> | null;
  removed?: Array<BackendClinicRef | string> | null;
  isNew?: boolean | null;
}

export interface BackendSamsWarnings {
  day?: string | null;
  digestDay?: string | null;
  unresolved?: BackendGroupedSection | null;
  ambiguous?: BackendAmbiguousSection | null;
  noSchedule?: BackendGroupedSection | null;
  inactiveUser?: BackendGroupedSection | null;
  tenantSetChanged?: { changes?: BackendTenantChange[] | null } | null;
}

export interface BackendSamsOutage {
  _id: string;
  from?: string | null;
  to?: string | null;
  dbname?: string | null;
  orgTitle?: string | null;
  reason?: string | null;
  createdBy?: MaybeUserName;
  createdAt?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: MaybeUserName;
  cancelReason?: string | null;
}
