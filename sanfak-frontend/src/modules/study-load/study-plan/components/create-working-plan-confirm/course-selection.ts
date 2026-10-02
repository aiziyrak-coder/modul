import type { LpCourse } from '../../model/detail-types';

export function planCourseNumbers(courses: LpCourse[]): number[] {
  const nums = new Set<number>();
  for (const c of courses) {
    const fromNum = typeof c.courseNum === 'number' && c.courseNum > 0 ? c.courseNum : null;
    const fromText = /^\s*(\d+)/.exec(c.course ?? '')?.[1];
    const num = fromNum ?? (fromText !== undefined ? Number(fromText) : null);
    if (num !== null && Number.isInteger(num) && num > 0) nums.add(num);
  }
  return [...nums].sort((a, b) => a - b);
}

export function coursesParam(all: number[], selected: number[]): number[] | undefined {
  const picked = [...new Set(selected)].filter((n) => all.includes(n)).sort((a, b) => a - b);
  const isAll = all.length > 0 && all.every((n) => picked.includes(n));
  return isAll ? undefined : picked;
}
