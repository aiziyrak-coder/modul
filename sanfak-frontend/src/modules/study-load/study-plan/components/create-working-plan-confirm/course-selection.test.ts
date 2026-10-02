import { describe, expect, it } from 'vitest';
import { coursesParam, planCourseNumbers } from './course-selection';

describe('planCourseNumbers', () => {
  it('courseNum ustun, takrorsiz va o`sish tartibida', () => {
    expect(
      planCourseNumbers([
        { courseNum: 3, course: '3-kurs' },
        { courseNum: 1, course: '1-kurs' },
        { courseNum: 1, course: '1-kurs' },
      ]),
    ).toEqual([1, 3]);
  });

  it('courseNum 0/yo`q bo`lsa `course` matnidan olinadi, aniqlanmagani tashlanadi', () => {
    expect(
      planCourseNumbers([
        { courseNum: 0, course: '5-kurs' },
        { course: '2' },
        { course: 'kurs' },
        {},
      ]),
    ).toEqual([2, 5]);
  });
});

describe('coursesParam', () => {
  const all = [1, 2, 3, 4, 5, 6];

  it('hammasi tanlangan — undefined (so`rov avvalgidek, param yo`q)', () => {
    expect(coursesParam(all, [6, 5, 4, 3, 2, 1])).toBeUndefined();
  });

  it('qisman tanlov — faqat tanlanganlar, tartiblangan', () => {
    expect(coursesParam(all, [6, 5])).toEqual([5, 6]);
    expect(coursesParam(all, [4, 1, 2, 3])).toEqual([1, 2, 3, 4]);
  });

  it('rejada yo`q kurs tashlanadi; bo`sh tanlov — [] (UI bloklaydi)', () => {
    expect(coursesParam(all, [2, 9])).toEqual([2]);
    expect(coursesParam(all, [])).toEqual([]);
  });
});
