const SEP = '/';

export function currentAcademicYear(now: Date = new Date()): string {
  const startYear = now.getMonth() + 1 >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}${SEP}${startYear + 1}`;
}

export function academicYearOf(dateStr: string): string {
  if (!dateStr) return currentAcademicYear();
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return currentAcademicYear();
  return currentAcademicYear(d);
}

export function canonicalAcademicYear(value: string | null | undefined): string {
  if (!value) return '';
  const m = String(value).trim().match(/^(\d{4})\s*[-/–—]\s*(\d{4})$/);
  return m ? `${m[1]}${SEP}${m[2]}` : String(value).trim();
}

export const DEFAULT_ACADEMIC_YEAR = currentAcademicYear();

export function resolveDefaultYear(titles: readonly string[]): string {
  if (!titles.length) return DEFAULT_ACADEMIC_YEAR;
  const current = currentAcademicYear();
  if (titles.includes(current)) return current;
  return [...titles].sort().reverse()[0] ?? DEFAULT_ACADEMIC_YEAR;
}
