import { describe, expect, it } from 'vitest';
import type { TeachingScience } from '../model/types';
import { cellOf, otherHoursOf } from './teaching-hours';

const row = (over: Partial<TeachingScience> = {}, hours: Partial<TeachingScience['hoursByType']> = {}): TeachingScience => ({
  id: 's1',
  scienceName: 'Odam anatomiyasi',
  course: 2,
  semester: 1,
  totalHour: 226,
  stavka: 0.5,
  streamCount: null,
  groupCount: null,
  decomposed: false,
  hoursByType: {
    lecture: 24,
    seminar: 192,
    laboratory: 0,
    practical: 0,
    independent: 10,
    on: null,
    yan: null,
    retake: null,
    practiceLead: null,
    otherWork: null,
    adjustment: null,
    ...hours,
  },
  ...over,
});

describe('otherHoursOf — «Boshqa» ustuni', () => {
  it('eski qator: auditoriyadan tashqari jami (independent), avvalgidek', () => {
    expect(otherHoursOf(row())).toBe(10);
  });

  it('yangi qator (test4 defekti): qayta topshirish o\'z ustunida — «Boshqa» 0', () => {
    const r = row({ decomposed: true }, { retake: 10, on: 0, yan: 0, practiceLead: 0, otherWork: 0, adjustment: 0 });
    expect(otherHoursOf(r)).toBe(0);
    const h = r.hoursByType;
    const sum = h.lecture + h.seminar + h.laboratory + h.practical + (h.on ?? 0) + (h.yan ?? 0) + (h.retake ?? 0) + (h.practiceLead ?? 0) + otherHoursOf(r);
    expect(sum).toBe(r.totalHour);
  });

  it('yangi qator: boshqa ishlar + manfiy tuzatish yig\'iladi', () => {
    const r = row({ decomposed: true }, { on: 0, yan: 0, retake: 0, practiceLead: 0, otherWork: 12, adjustment: -2 });
    expect(otherHoursOf(r)).toBe(10);
  });
});

describe('cellOf — yangi ustun katagi', () => {
  it('eski qator (null) va 0 — «—»; son — o\'zi', () => {
    expect(cellOf(null)).toBe('—');
    expect(cellOf(0)).toBe('—');
    expect(cellOf(7)).toBe(7);
  });
});
