export interface WeekStatInput {
  _id?: string;
  key?: string | null;
  slug?: string;
  title?: string;
}

export interface DerivedWeekStats {
  statistics: Record<string, number>;
  total: number;
}

const HAMMASI_SLUG = 'hammasi';
const HAMMASI_TITLE = 'hammasi';
const TATIL_SLUG_PREFIX = 'tatil';
const GPA_SLUG_PREFIX = 'gpa';

const norm = (value: string | null | undefined): string => (value ?? '').trim();

export function deriveWeekStats(
  weeks: Record<string, string | null | undefined>,
  statistics: WeekStatInput[],
): DerivedWeekStats {
  const weekNums = Object.keys(weeks)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  let lastMeaningful = 0;
  for (const n of weekNums) {
    if (norm(weeks[String(n)])) lastMeaningful = n;
  }

  const counts: Record<string, number> = {};
  let considered = 0;
  for (const n of weekNums) {
    if (n > lastMeaningful) continue;
    considered += 1;
    const letter = norm(weeks[String(n)]);
    counts[letter] = (counts[letter] ?? 0) + 1;
  }

  const isHammasi = (stat: WeekStatInput): boolean =>
    norm(stat.slug) === HAMMASI_SLUG ||
    (norm(stat.key) === '' && norm(stat.title).toLowerCase() === HAMMASI_TITLE);

  const derived: Record<string, number> = {};
  let tatil = 0;
  let gpa = 0;

  for (const stat of statistics) {
    const value = isHammasi(stat) ? considered : (counts[norm(stat.key)] ?? 0);
    const slug = norm(stat.slug);
    if (slug.startsWith(TATIL_SLUG_PREFIX)) tatil = value;
    if (slug.startsWith(GPA_SLUG_PREFIX)) gpa = value;
    if (stat._id) derived[stat._id] = value;
  }

  return { statistics: derived, total: considered - tatil - gpa };
}
