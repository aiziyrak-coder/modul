import { describe, expect, it } from 'vitest';
import { mapCompletedItem, type BackendCompletedItem } from './completed-items-mapper';

const backendRow: BackendCompletedItem = {
  planId: 'p1',
  section: 'researchWork',
  itemId: 'a1',
  title: 'Maqola nashri',
  teacher: { _id: 'u1', firstName: 'Laziz', lastName: 'Karimov', middleName: 'Azizovich' },
  academicYear: { _id: 'y1', title: '2025-2026' },
  completedAt: '2026-02-11T00:00:00.000Z',
  link: 'https://scopus.com/x',
  fileUrl: '/uploads/x.pdf',
  status: 'pending',
};

describe('completed-items mapper', () => {
  it('maps a fully-populated row, joining lastName+firstName+middleName', () => {
    const item = mapCompletedItem(backendRow);
    expect(item.planId).toBe('p1');
    expect(item.itemId).toBe('a1');
    expect(item.section).toBe('researchWork');
    expect(item.teacherName).toBe('Karimov Laziz Azizovich');
    expect(item.academicYearTitle).toBe('2025-2026');
    expect(item.link).toBe('https://scopus.com/x');
    expect(item.verification.status).toBe('pending');
  });

  it('falls back status to "pending" and comment to null when backend omits them', () => {
    const item = mapCompletedItem({ ...backendRow, status: null, teacher: null, academicYear: null });
    expect(item.verification.status).toBe('pending');
    expect(item.verification.comment).toBeNull();
    expect(item.teacherName).toBeNull();
    expect(item.academicYearTitle).toBeNull();
  });

  it('never surfaces a rejection comment — the list endpoint does not return one', () => {
    const item = mapCompletedItem({ ...backendRow, status: 'rejected' });
    expect(item.verification.status).toBe('rejected');
    expect(item.verification.comment).toBeNull();
  });
});
