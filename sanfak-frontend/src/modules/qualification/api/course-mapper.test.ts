import { describe, expect, it } from 'vitest';
import { mapCourse } from './course-mapper';

describe('mapCourse', () => {
  it('maps _id → id and keeps numeric form/status', () => {
    const r = mapCourse({
      _id: 'c-1',
      title: 'Pediatriya (144 soat)',
      creditHours: 144,
      price: 650000,
      form: 1,
      listenersLimit: 25,
      startDate: '2026-02-01',
      endDate: '2026-04-01',
      status: 2,
      totalSubscribers: 7,
      courseType: { _id: 'ct-1', title: 'Malaka oshirish guvohnomasi' },
    });
    expect(r.id).toBe('c-1');
    expect(r.form).toBe(1);
    expect(r.status).toBe(2);
    expect(r.totalSubscribers).toBe(7);
    expect(r.courseTypeTitle).toBe('Malaka oshirish guvohnomasi');
  });

  it('defaults form → 1, status → 1, subscribers → 0', () => {
    const r = mapCourse({
      _id: 'c-2',
      title: 'X',
      creditHours: 72,
      price: 0,
      form: 9,
      listenersLimit: 30,
    });
    expect(r.form).toBe(1);
    expect(r.status).toBe(1);
    expect(r.totalSubscribers).toBe(0);
    expect(r.courseTypeTitle).toBe('');
  });
});
