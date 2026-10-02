import type { ActivitySection, VerificationStatus } from '../model/types';
import type { CompletedWorkItem } from '../model/completed-item-types';

interface BackendPerson {
  _id?: string;
  firstName?: string | null;
  lastName?: string | null;
  middleName?: string | null;
}

interface BackendAcademicYearRef {
  _id?: string;
  title?: string | null;
}

export interface BackendCompletedItem {
  planId: string;
  section: ActivitySection;
  itemId: string;
  title: string;
  teacher?: BackendPerson | null;
  academicYear?: BackendAcademicYearRef | null;
  completedAt?: string | null;
  link?: string | null;
  fileUrl?: string | null;
  status?: VerificationStatus | null;
  verificationComment?: string | null;
}

function extractTeacherName(person: BackendPerson | null | undefined): string | null {
  if (!person) return null;
  return [person.lastName, person.firstName, person.middleName].filter(Boolean).join(' ') || null;
}

export function mapCompletedItem(b: BackendCompletedItem): CompletedWorkItem {
  return {
    planId: b.planId,
    section: b.section,
    itemId: b.itemId,
    title: b.title,
    teacherName: extractTeacherName(b.teacher),
    academicYearTitle: b.academicYear?.title ?? null,
    completedAt: b.completedAt ?? null,
    link: b.link ?? null,
    fileUrl: b.fileUrl ?? null,
    verification: {
      status: b.status ?? 'pending',
      comment: b.verificationComment ?? null,
    },
  };
}
