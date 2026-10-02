import type { TeacherLeave, TeacherLeaveStatus, TeacherLeaveType } from '../model/types';

export interface BackendTeacherLeaveTeacher {
  _id: string;
  firstName?: string | null;
  lastName?: string | null;
}

export interface BackendTeacherLeave {
  _id: string;
  teacher?: BackendTeacherLeaveTeacher | string | null;
  type?: string | null;
  reason?: string | null;
  distribution?: string | { _id: string } | null;
  teacherEntryId?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  status?: string | null;
  approvedBy?: string | null;
  approvalDate?: string | null;
  approvalComment?: string | null;
  active?: boolean;
  createdAt?: string | null;
}

function extractTeacherName(
  t: BackendTeacherLeaveTeacher | string | null | undefined,
): string | null {
  if (!t) return null;
  if (typeof t === 'string') return null;
  const parts = [t.lastName, t.firstName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
}

function extractDistributionId(
  d: string | { _id: string } | null | undefined,
): string | null {
  if (!d) return null;
  if (typeof d === 'string') return d;
  return d._id ?? null;
}

export function mapTeacherLeave(b: BackendTeacherLeave): TeacherLeave {
  return {
    id: b._id,
    teacherName: extractTeacherName(b.teacher),
    type: (b.type as TeacherLeaveType) ?? null,
    reason: b.reason ?? null,
    fromDate: b.fromDate ?? null,
    toDate: b.toDate ?? null,
    status: (b.status as TeacherLeaveStatus) ?? 'pending',
    approvalComment: b.approvalComment ?? null,
    approvedBy: b.approvedBy ?? null,
    approvalDate: b.approvalDate ?? null,
    distributionId: extractDistributionId(b.distribution),
    teacherEntryId: b.teacherEntryId ?? null,
    active: b.active ?? true,
    createdAt: b.createdAt ?? null,
  };
}
