import type {
  Contract,
  ContractOrg,
  ContractStatus,
  ContractStudentLite,
  DistrictRef,
  EriSignature,
  NotificationItem,
  PracticeBase,
  PracticeRole,
  PracticeStudent,
  RefItem,
  RepresentativeRef,
} from '../model/types';

interface BackendRef {
  _id: string;
  title: string;
}
const ref = (r?: BackendRef | null): RefItem =>
  r ? { id: r._id, title: r.title } : { id: '', title: '' };

interface BackendUserLite {
  _id: string;
  firstName?: string;
  lastName?: string;
  position?: { _id: string; title: string } | null;
}
const mapRepresentative = (u: BackendUserLite): RepresentativeRef => ({
  id: u._id,
  firstName: u.firstName ?? '',
  lastName: u.lastName ?? '',
  position: u.position?.title ?? null,
});

type MaybeBackendUserLite = BackendUserLite | string | null | undefined;
const isPopulatedUser = (u: MaybeBackendUserLite): u is BackendUserLite =>
  typeof u === 'object' && u !== null && typeof u._id === 'string' && u._id.length > 0;

interface BackendDistrict {
  _id: string;
  title: string;
  province?: BackendRef | null;
}
export const mapDistrict = (d: BackendDistrict): DistrictRef => ({
  id: d._id,
  title: d.title,
  region: ref(d.province),
});

interface BackendBase {
  _id: string;
  title: string;
  orgType?: BackendRef | null;
  stir: string;
  region?: BackendRef | null;
  district?: BackendRef | null;
  address: string;
  headName: string;
  headJshshir: string;
  headPhone: string;
  email?: string | null;
  capacity?: number | null;
  responsibleUsers?: MaybeBackendUserLite[] | null;
  active: boolean;
  createdAt?: string;
}
export const mapBase = (b: BackendBase): PracticeBase => ({
  id: b._id,
  title: b.title,
  orgType: ref(b.orgType),
  stir: b.stir,
  region: ref(b.region),
  district: ref(b.district),
  address: b.address,
  headName: b.headName,
  headJshshir: b.headJshshir,
  headPhone: b.headPhone,
  email: b.email ?? null,
  capacity: b.capacity ?? null,
  responsibleUsers: (b.responsibleUsers ?? []).filter(isPopulatedUser).map(mapRepresentative),
  active: b.active,
  createdAt: b.createdAt ? b.createdAt.slice(0, 10) : undefined,
});

interface BackendStudent {
  _id: string;
  fish: string;
  academicYear?: BackendRef | null;
  direction?: BackendRef | null;
  course: number;
  group: string;
  region?: BackendRef | null;
  district?: BackendRef | null;
  active: boolean;
}
export const mapStudent = (s: BackendStudent): PracticeStudent => ({
  id: s._id,
  fish: s.fish,
  academicYear: ref(s.academicYear),
  direction: ref(s.direction),
  course: s.course,
  group: s.group,
  region: ref(s.region),
  district: ref(s.district),
  active: s.active,
});

interface BackendOrg {
  _id: string;
  title: string;
  stir?: string;
  region?: BackendRef | null;
  district?: BackendRef | null;
}
const mapOrg = (o?: BackendOrg | null): ContractOrg =>
  o
    ? {
        id: o._id,
        title: o.title,
        stir: o.stir,
        region: ref(o.region),
        district: ref(o.district),
      }
    : { id: '', title: '', region: ref(null), district: ref(null) };

interface BackendSigner {
  _id?: string;
  firstName?: string;
  lastName?: string;
}
interface BackendEri {
  signed?: boolean;
  signer?: BackendSigner | string | null;
  signedAt?: string | null;
  certInfo?: { serialNumber?: string | null; subject?: string | null } | null;
}
const mapEri = (e?: BackendEri | null): EriSignature => {
  if (!e) return { signed: false };
  let signer: string | null = null;
  if (e.signer && typeof e.signer === 'object') {
    signer = [e.signer.firstName, e.signer.lastName].filter(Boolean).join(' ') || null;
  } else if (typeof e.signer === 'string') {
    signer = e.signer;
  }
  return {
    signed: !!e.signed,
    signer,
    signedAt: e.signedAt ?? null,
    certInfo: e.certInfo ?? null,
  };
};

interface BackendStudentLite {
  _id: string;
  fish: string;
  group?: string;
}
interface BackendHistory {
  at: string;
  actor?: string;
  action?: string;
  reason?: string;
}
interface BackendContract {
  _id: string;
  number: string;
  organization?: BackendOrg | null;
  direction?: BackendRef | null;
  academicYear?: BackendRef | null;
  course?: number | null;
  group?: string | null;
  students?: BackendStudentLite[];
  studentsCount?: number;
  startDate: string;
  endDate: string;
  note?: string | null;
  status: ContractStatus;
  rector?: BackendEri | null;
  orgHead?: BackendEri | null;
  rejectReason?: string | null;
  rejectedBy?: 'rektor' | 'org_head' | null;
  history?: BackendHistory[];
  createdAt?: string;
}
export const mapContract = (c: BackendContract): Contract => ({
  id: c._id,
  number: c.number,
  organization: mapOrg(c.organization),
  direction: ref(c.direction),
  academicYear: ref(c.academicYear),
  course: c.course ?? null,
  group: c.group ?? null,
  students: (c.students ?? []).map(
    (s): ContractStudentLite => ({ id: s._id, fish: s.fish, group: s.group }),
  ),
  studentsCount: c.studentsCount ?? (c.students?.length ?? 0),
  startDate: c.startDate,
  endDate: c.endDate,
  note: c.note ?? null,
  status: c.status,
  rector: mapEri(c.rector),
  orgHead: mapEri(c.orgHead),
  rejectReason: c.rejectReason ?? null,
  rejectedBy: c.rejectedBy ?? null,
  history: (c.history ?? []).map((h) => ({
    at: h.at,
    actor: h.actor,
    action: h.action,
    reason: h.reason,
  })),
  createdAt: c.createdAt,
});

interface BackendNotification {
  _id: string;
  eventType?: string;
  title: string;
  body?: string | null;
  link?: string | null;
  read?: boolean;
  createdAt: string;
}
export const mapNotification = (
  n: BackendNotification,
  role: PracticeRole,
): NotificationItem => ({
  id: n._id,
  eventType: n.eventType ?? '',
  title: n.title,
  body: n.body ?? null,
  link: n.link ?? null,
  read: !!n.read,
  createdAt: n.createdAt,
  forRole: role,
});
