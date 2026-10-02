import { mapRefOption } from './mapper';
import type { RefOption, Specialty } from './types';

export interface BackendRefRow {
  _id: string;
  title: string;
  active?: boolean;
}

export interface BackendNamedRow {
  _id: string;
  title?: string;
  name?: string;
}

export interface BackendRoomRow extends BackendRefRow {
  building?: string | null;
  capacity?: number | null;
}

export interface AcademicYearOption {
  id: string;
  title: string;
}

export interface CourseOption {
  id: string;
  number: number;
  title: string;
}

export interface EducationFormOption {
  id: string;
  value: string;
  title: string;
}

export interface RoomOption {
  id: string;
  title: string;
  label: string;
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

const isActive = (row: { active?: boolean }): boolean => row.active !== false;

export function activeWithCurrent<T extends { id: string; active?: boolean }>(
  rows: readonly T[],
  currentId?: string | null,
): T[] {
  const active = rows.filter(isActive);
  if (!currentId) return active;
  if (active.some((r) => r.id === currentId)) return active;
  const current = rows.find((r) => r.id === currentId);
  return current ? [current, ...active] : active;
}

export function toAcademicYearOptions(rows: readonly BackendRefRow[]): AcademicYearOption[] {
  return dedupeBy(
    rows.filter(isActive).map((r) => ({ id: r._id, title: r.title })),
    (y) => y.id,
  ).sort((a, b) => b.title.localeCompare(a.title));
}

export function toCourseOptions(rows: readonly BackendRefRow[]): CourseOption[] {
  return dedupeBy(
    rows
      .filter(isActive)
      .map((r) => {
        const m = String(r.title).match(/\d+/);
        return m ? { id: r._id, number: Number(m[0]), title: r.title } : null;
      })
      .filter((x): x is CourseOption => x !== null),
    (c) => String(c.number),
  ).sort((a, b) => a.number - b.number);
}

export function toEducationFormOptions(rows: readonly BackendRefRow[]): EducationFormOption[] {
  return dedupeBy(
    rows.filter(isActive).map((r) => ({
      id: r._id,
      value: String(r.title).trim().toLowerCase(),
      title: r.title,
    })),
    (ef) => ef.value,
  );
}

export function toRoomOptions(rows: readonly BackendRoomRow[]): RoomOption[] {
  return dedupeBy(
    rows.filter(isActive).map((r) => ({
      id: r._id,
      title: r.title,
      label: [r.title, r.building, r.capacity ? `${r.capacity} o‘rin` : null]
        .filter(Boolean)
        .join(' · '),
    })),
    (r) => r.id,
  );
}

export function toRefOptions(rows: readonly BackendNamedRow[]): RefOption[] {
  return dedupeBy(rows.map(mapRefOption), (r) => r.id);
}

export function toSpecialtyOptions(rows: readonly Specialty[]): Specialty[] {
  return dedupeBy(rows, (s) => s.id);
}
