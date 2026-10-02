export function parseCourseNumber(title: string): number | null {
  const n = parseInt(title, 10);
  if (Number.isNaN(n) || n <= 0) return null;
  return n;
}

export interface CourseOption {
  value: number;
  label: string;
  disabled?: boolean;
}

export function courseSelectOptions(items: { title: string }[]): CourseOption[] {
  const seen = new Set<number>();
  const opts: CourseOption[] = [];
  let brokenSeq = 0;
  for (const item of items) {
    const n = parseCourseNumber(item.title);
    if (n === null) {
      opts.push({ value: -1 - brokenSeq, label: item.title, disabled: true });
      brokenSeq += 1;
      continue;
    }
    if (seen.has(n)) continue;
    seen.add(n);
    opts.push({ value: n, label: item.title });
  }
  return opts;
}
