import { describe, it, expect } from 'vitest';
import { mapCalendarPlan } from './calendar-plan-mapper';

describe('mapCalendarPlan', () => {
  it('_id→id, file→fileUrl, createdAt→uploadedAt', () => {
    const r = mapCalendarPlan({
      _id: 'a1',
      title: '2026 bahor reja',
      file: 'http://x/files/file/qualification-calendar-plans/1.pdf',
      createdAt: '2026-06-01T00:00:00.000Z',
    });
    expect(r).toEqual({
      id: 'a1',
      title: '2026 bahor reja',
      fileUrl: 'http://x/files/file/qualification-calendar-plans/1.pdf',
      uploadedAt: '2026-06-01T00:00:00.000Z',
    });
  });

  it('fayl bo\'lmasa fileUrl "#" bo\'ladi', () => {
    const r = mapCalendarPlan({ _id: 'b2', title: 'x', file: '' });
    expect(r.fileUrl).toBe('#');
  });
});
