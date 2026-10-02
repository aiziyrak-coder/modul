export interface CourseRow {
  id: string;
  number: number;
  title: string;
}

export interface CourseChoice {
  value: string;
  label: string;
}

export function courseChoices(rows: readonly CourseRow[]): CourseChoice[] {
  return rows.map((c) => ({ value: String(c.number), label: c.title }));
}

export function courseLabel(rows: readonly CourseRow[], value: string): string {
  return rows.find((c) => String(c.number) === String(value))?.title ?? value;
}

export function courseNumbers(rows: readonly CourseRow[]): number[] {
  return rows.map((c) => c.number);
}
