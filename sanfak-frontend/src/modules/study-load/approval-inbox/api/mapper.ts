import type { ApprovalInboxEntity, ApprovalInboxItem, ApprovalInboxRef } from '../model/types';

export interface BackendApprovalInboxRef {
  _id: string;
  title: string;
}

export interface BackendApprovalInboxItem {
  entity: ApprovalInboxEntity;
  id: string;
  title?: string | null;
  step: string;
  department?: BackendApprovalInboxRef | null;
  academicYear?: BackendApprovalInboxRef | null;
  submittedAt?: string | null;
  totalHour?: number | null;
}

function mapRef(ref: BackendApprovalInboxRef | null | undefined): ApprovalInboxRef | null {
  if (!ref) return null;
  return { id: ref._id, title: ref.title };
}

export function mapApprovalInboxItem(b: BackendApprovalInboxItem): ApprovalInboxItem {
  return {
    entity: b.entity,
    id: b.id,
    title: b.title ?? null,
    step: b.step,
    department: mapRef(b.department),
    academicYear: mapRef(b.academicYear),
    submittedAt: b.submittedAt ?? null,
    totalHour: b.totalHour ?? null,
  };
}
