import type { Contingent } from '../model/types';

export interface BackendGroup {
  _id: string;
  title: string;
  desc?: string | null;
  direction?: { _id: string; title: string } | string | null;
  course?: { _id: string; title: string } | string | null;
  lang?: { _id: string; title: string; active?: boolean } | string | null;
  academicYear?: { _id: string; title: string } | string | null;
  studentNumber?: number;
  active?: boolean;
}

function extractRef(
  ref: { _id: string; title: string } | string | null | undefined,
): { id: string | null; title: string | null } {
  if (!ref) return { id: null, title: null };
  if (typeof ref === 'string') return { id: ref, title: null };
  return { id: ref._id ?? null, title: ref.title ?? null };
}

export function mapGroup(b: BackendGroup): Contingent {
  const direction = extractRef(b.direction);
  const course = extractRef(b.course);
  const lang = extractRef(b.lang);
  const academicYear = extractRef(b.academicYear);

  return {
    id: b._id,
    title: b.title,
    desc: b.desc ?? null,
    directionId: direction.id,
    directionTitle: direction.title,
    courseId: course.id,
    courseTitle: course.title,
    langId: lang.id,
    langTitle: lang.title,
    academicYearId: academicYear.id,
    academicYearTitle: academicYear.title,
    studentNumber: b.studentNumber ?? 0,
    active: b.active ?? true,
  };
}
