import { describe, it, expect } from 'vitest';
import { parseCourseNumber, courseSelectOptions } from './course-number';

describe('parseCourseNumber', () => {
  it('kanonik "N-kurs" formatini raqamga aylantiradi', () => {
    expect(parseCourseNumber('1-kurs')).toBe(1);
    expect(parseCourseNumber('2-kurs')).toBe(2);
    expect(parseCourseNumber('10-kurs')).toBe(10);
  });

  it('xom raqam formatini ham qabul qiladi', () => {
    expect(parseCourseNumber('1')).toBe(1);
    expect(parseCourseNumber('5')).toBe(5);
  });

  it('raqamga aylanmaydigan matn uchun null qaytaradi', () => {
    expect(parseCourseNumber('Birinchi kurs')).toBeNull();
  });

  it("bo'sh string uchun null qaytaradi", () => {
    expect(parseCourseNumber('')).toBeNull();
  });

  it('0 yoki manfiy uchun null qaytaradi', () => {
    expect(parseCourseNumber('0')).toBeNull();
    expect(parseCourseNumber('-1')).toBeNull();
  });
});

describe('courseSelectOptions', () => {
  it('har bir yozuvdan bitta option quradi', () => {
    const opts = courseSelectOptions([{ title: '1-kurs' }, { title: '2-kurs' }]);
    expect(opts).toEqual([
      { value: 1, label: '1-kurs' },
      { value: 2, label: '2-kurs' },
    ]);
  });

  it('bir xil raqamga tushadigan takroriy yozuvlarni dedupe qiladi ("1" va "1-kurs")', () => {
    const opts = courseSelectOptions([{ title: '1' }, { title: '1-kurs' }, { title: '2-kurs' }]);
    expect(opts).toHaveLength(2);
    expect(opts.filter((o) => o.value === 1)).toHaveLength(1);
    expect(opts.find((o) => o.value === 1)?.label).toBe('1');
  });

  it('raqamga aylanmaydigan yozuvni disabled bilan saqlab qoladi (tashlab yubormaydi)', () => {
    const opts = courseSelectOptions([{ title: '1-kurs' }, { title: 'Birinchi kurs' }]);
    expect(opts).toHaveLength(2);
    const broken = opts.find((o) => o.label === 'Birinchi kurs');
    expect(broken?.disabled).toBe(true);
  });

  it('buzuq yozuvlar uchun unikal sentinel value beradi (antd duplicate-key oldini olish)', () => {
    const opts = courseSelectOptions([{ title: 'Birinchi kurs' }, { title: 'Ikkinchi kurs' }]);
    expect(opts).toHaveLength(2);
    expect(opts.at(0)?.value).not.toBe(opts.at(1)?.value);
  });
});
