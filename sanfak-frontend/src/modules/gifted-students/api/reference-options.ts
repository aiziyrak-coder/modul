import { canonicalAcademicYear } from '../lib/academic-years';

export interface RefOption {
  id: string;
  title: string;
}

export interface AcademicYearOption extends RefOption {
  title: string;
}

export interface CourseOption extends RefOption {
  number: number;
}

export interface DirectionOption extends RefOption {
  facultyTitle: string;
}

export interface GroupOption extends RefOption {
  directionTitle: string;
  course: number;
  courseId: string;
}

export interface DepartmentOption extends RefOption {
  facultyTitle: string;
}

export interface BackendRefRow {
  _id: string;
  title: string;
}

export interface BackendChildRefRow extends BackendRefRow {
  faculty?: { title?: string } | null;
}

export interface BackendGroupRow extends BackendRefRow {
  course?: { _id?: string; title?: string } | string | null;
  direction?: { title?: string } | null;
}

function dedupeBy<T>(rows: readonly T[], keyOf: (row: T) => string): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = keyOf(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const compositeKey = (...parts: readonly string[]): string => JSON.stringify(parts);

export function toAcademicYearOptions(rows: readonly BackendRefRow[]): AcademicYearOption[] {
  return dedupeBy(
    rows.map((y) => ({ id: y._id, title: canonicalAcademicYear(y.title) })),
    (y) => y.title,
  ).sort((a, b) => b.title.localeCompare(a.title));
}

export function toCourseOptions(rows: readonly BackendRefRow[]): CourseOption[] {
  return dedupeBy(
    rows
      .map((c) => ({ id: c._id, title: c.title, number: parseInt(c.title, 10) || 0 }))
      .filter((c) => c.number > 0),
    (c) => String(c.number),
  ).sort((a, b) => a.number - b.number);
}

export function toFacultyOptions(rows: readonly BackendRefRow[]): RefOption[] {
  return dedupeBy(
    rows.map((f) => ({ id: f._id, title: f.title })),
    (f) => f.title,
  );
}

export function toDirectionOptions(rows: readonly BackendChildRefRow[]): DirectionOption[] {
  return dedupeBy(
    rows.map((d) => ({ id: d._id, title: d.title, facultyTitle: d.faculty?.title ?? '' })),
    (d) => compositeKey(d.facultyTitle, d.title),
  );
}

export function toGroupOptions(rows: readonly BackendGroupRow[]): GroupOption[] {
  return dedupeBy(
    rows.map((g) => {
      const c = typeof g.course === 'object' && g.course ? g.course : null;
      return {
        id: g._id,
        title: g.title,
        directionTitle: g.direction?.title ?? '',
        courseId: c?._id ?? (typeof g.course === 'string' ? g.course : ''),
        course: parseInt(c?.title ?? '', 10) || 0,
      };
    }),
    (g) => compositeKey(g.directionTitle, g.courseId, g.title),
  );
}

export function toDepartmentOptions(rows: readonly BackendChildRefRow[]): DepartmentOption[] {
  return dedupeBy(
    rows.map((d) => ({ id: d._id, title: d.title, facultyTitle: d.faculty?.title ?? '' })),
    (d) => d.id,
  );
}
