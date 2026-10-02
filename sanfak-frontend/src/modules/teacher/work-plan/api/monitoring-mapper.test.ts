import { describe, expect, it } from 'vitest';
import { mapMonitoringRow, type BackendMonitoringRow } from './monitoring-mapper';

const backendRow: BackendMonitoringRow = {
  planId: 'p1',
  teacherId: 'u1',
  teacherName: 'Karimov Laziz Azizovich',
  department: { _id: 'd1', title: 'Ichki kasalliklar kafedrasi' },
  academicYear: { _id: 'y1', title: '2025-2026' },
  submitStatus: 'submitted',
  totalItems: 10,
  completedItems: 6,
  completionPercent: 60,
  overdueCount: 2,
  totalResearch: 3,
  completedResearch: 2,
  totalMentoring: 2,
  completedMentoring: 1,
  totalOrg: 5,
  completedOrg: 3,
};

describe('monitoring mapper', () => {
  it('maps a fully-populated row', () => {
    const row = mapMonitoringRow(backendRow);
    expect(row.planId).toBe('p1');
    expect(row.teacherName).toBe('Karimov Laziz Azizovich');
    expect(row.departmentTitle).toBe('Ichki kasalliklar kafedrasi');
    expect(row.academicYearTitle).toBe('2025-2026');
    expect(row.submitStatus).toBe('submitted');
    expect(row.totalItems).toBe(10);
    expect(row.completedItems).toBe(6);
    expect(row.completionPercent).toBe(60);
    expect(row.overdueCount).toBe(2);
  });

  it('accepts academicYear as a plain string', () => {
    const row = mapMonitoringRow({ ...backendRow, academicYear: '2025-2026' });
    expect(row.academicYearTitle).toBe('2025-2026');
  });

  it('falls back planId to _id when planId is missing', () => {
    const row = mapMonitoringRow({ ...backendRow, planId: null, _id: 'plan-fallback' });
    expect(row.planId).toBe('plan-fallback');
  });

  it('falls back planId to null when neither planId nor _id is present', () => {
    const row = mapMonitoringRow({ ...backendRow, planId: null, _id: null });
    expect(row.planId).toBeNull();
  });

  it('defends against a fully-empty backend row — every numeric field falls back to 0, refs to null', () => {
    const row = mapMonitoringRow({});
    expect(row.planId).toBeNull();
    expect(row.teacherName).toBeNull();
    expect(row.departmentTitle).toBeNull();
    expect(row.academicYearTitle).toBeNull();
    expect(row.submitStatus).toBe('draft');
    expect(row.totalItems).toBe(0);
    expect(row.completedItems).toBe(0);
    expect(row.completionPercent).toBe(0);
    expect(row.overdueCount).toBe(0);
    expect(row.totalResearch).toBe(0);
    expect(row.completedResearch).toBe(0);
    expect(row.totalMentoring).toBe(0);
    expect(row.completedMentoring).toBe(0);
    expect(row.totalOrg).toBe(0);
    expect(row.completedOrg).toBe(0);
  });
});
