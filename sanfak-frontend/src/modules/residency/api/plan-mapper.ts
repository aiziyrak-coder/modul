import type { ResidentBrief } from './types';
import type {
  AppNotification,
  PlanStatus,
  ProofStatus,
  WorkPlan,
  WorkPlanProof,
  WorkPlanTask,
} from './plan-types';
import { nameOf } from './user-name';

interface RawUser {
  _id: string;
  firstName?: string;
  lastName?: string;
}
type MaybeUser = string | RawUser | null | undefined;

const asPlanStatus = (s?: string): PlanStatus => {
  const ok = ['yangi', 'yuborilgan', 'jarayonda', 'rad_etilgan', 'bajarilgan'];
  return (s && ok.includes(s) ? s : 'yangi') as PlanStatus;
};
const asProofStatus = (s?: string): ProofStatus =>
  s === 'approved' ? 'approved' : s === 'rejected' ? 'rejected' : 'pending';

interface RawBrief {
  _id: string;
  fullName?: string;
  program?: string;
  specialtyTitle?: string | null;
  departmentTitle?: string | null;
  courseNumber?: number | null;
  group?: string | { _id: string } | null;
  groupTitle?: string | null;
}
interface RawProof {
  fileUrl?: string | null;
  url?: string | null;
  comment?: string | null;
  createdAt?: string | null;
  workDate?: string | null;
  lateUpload?: boolean;
  status?: string;
  reviewedBy?: MaybeUser;
  reviewedAt?: string | null;
  reviewComment?: string | null;
}
interface RawTask {
  category: string;
  title: string;
  targetCount?: number;
  dueDate?: string | null;
  proofs?: RawProof[];
}
interface RawApproval {
  role: string;
  user?: MaybeUser;
  signedAt?: string | null;
  eriKey?: string | null;
  eriSerialNumber?: string | null;
}
export interface BackendWorkPlan {
  _id: string;
  resident?: string | RawBrief | null;
  supervisor?: MaybeUser;
  title: string;
  academicYear?: string | null;
  academicYearRef?: string | null;
  tasks?: RawTask[];
  status?: string;
  approvals?: RawApproval[];
  rejectionReason?: string | null;
  createdAt?: string | null;
}

const mapBrief = (r: string | RawBrief | null | undefined): ResidentBrief | null => {
  if (!r || typeof r !== 'object') return null;
  return {
    id: r._id,
    fullName: r.fullName ?? '',
    program: r.program === 'magistratura' ? 'magistratura' : 'ordinatura',
    specialtyTitle: r.specialtyTitle ?? null,
    departmentTitle: r.departmentTitle ?? null,
    courseNumber: r.courseNumber ?? null,
    groupId: typeof r.group === 'string' ? r.group : (r.group?._id ?? null),
    groupTitle: r.groupTitle ?? null,
  };
};

const mapProof = (p: RawProof): WorkPlanProof => ({
  fileUrl: p.fileUrl ?? null,
  url: p.url ?? null,
  comment: p.comment ?? null,
  createdAt: p.createdAt ?? null,
  workDate: p.workDate ?? null,
  lateUpload: !!p.lateUpload,
  status: asProofStatus(p.status),
  reviewedByName: nameOf(p.reviewedBy),
  reviewedAt: p.reviewedAt ?? null,
  reviewComment: p.reviewComment ?? null,
});

const mapTask = (t: RawTask): WorkPlanTask => ({
  category: t.category,
  title: t.title,
  targetCount: t.targetCount ?? 1,
  dueDate: t.dueDate ?? null,
  proofs: (t.proofs ?? []).map(mapProof),
});

export const mapWorkPlan = (b: BackendWorkPlan): WorkPlan => ({
  id: b._id,
  residentId:
    b.resident && typeof b.resident === 'object'
      ? b.resident._id
      : typeof b.resident === 'string'
        ? b.resident
        : '',
  resident: mapBrief(b.resident),
  supervisorName: nameOf(b.supervisor),
  title: b.title,
  academicYear: b.academicYear ?? null,
  academicYearRef: b.academicYearRef ?? null,
  tasks: (b.tasks ?? []).map(mapTask),
  status: asPlanStatus(b.status),
  approvals: (b.approvals ?? []).map((a) => ({
    role: a.role,
    userName: nameOf(a.user),
    signedAt: a.signedAt ?? null,
    eriKey: a.eriKey ?? null,
    eriSerialNumber: a.eriSerialNumber ?? null,
  })),
  rejectionReason: b.rejectionReason ?? null,
  createdAt: b.createdAt ?? null,
});

export const toWorkPlanPayload = (p: {
  resident?: string;
  title?: string;
  academicYear?: string | null;
  academicYearRef?: string | null;
  tasks?: WorkPlanTask[];
}): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  if (p.resident) out.resident = p.resident;
  if (p.title !== undefined) out.title = p.title;
  if (p.academicYear !== undefined) out.academicYear = p.academicYear;
  if (p.tasks !== undefined) {
    out.tasks = p.tasks.map((t) => ({
      category: t.category,
      title: t.title,
      targetCount: t.targetCount,
      ...(t.dueDate ? { dueDate: t.dueDate } : {}),
    }));
  }
  return out;
};

export interface BackendNotification {
  _id: string;
  title: string;
  body?: string | null;
  link?: string | null;
  read?: boolean;
  createdAt?: string | null;
  eventType: string;
}
export const mapNotification = (b: BackendNotification): AppNotification => ({
  id: b._id,
  title: b.title,
  body: b.body ?? null,
  link: b.link ?? null,
  read: !!b.read,
  createdAt: b.createdAt ?? null,
  eventType: b.eventType,
});
