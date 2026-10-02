import { describe, expect, it } from 'vitest';
import { mapApprovalInboxItem, type BackendApprovalInboxItem } from './mapper';

describe('mapApprovalInboxItem', () => {
  it('to\'liq backend obyektni frontend tipiga to\'g\'ri map qiladi', () => {
    const backend: BackendApprovalInboxItem = {
      entity: 'distribution',
      id: 'd1',
      title: 'Taqsimot #1',
      step: 'kafedra',
      department: { _id: 'dep1', title: 'Terapiya kafedrasi' },
      academicYear: { _id: 'ay1', title: '2025-2026' },
      submittedAt: '2026-07-01T00:00:00.000Z',
      totalHour: 320,
    };

    const result = mapApprovalInboxItem(backend);

    expect(result).toEqual({
      entity: 'distribution',
      id: 'd1',
      title: 'Taqsimot #1',
      step: 'kafedra',
      department: { id: 'dep1', title: 'Terapiya kafedrasi' },
      academicYear: { id: 'ay1', title: '2025-2026' },
      submittedAt: '2026-07-01T00:00:00.000Z',
      totalHour: 320,
    });
  });

  it('department/academicYear/title/totalHour null bo\'lsa xatosiz null qaytaradi (workingSchedule kabi)', () => {
    const backend: BackendApprovalInboxItem = {
      entity: 'workingSchedule',
      id: 'ws1',
      title: null,
      step: 'dean',
      department: null,
      academicYear: null,
      submittedAt: null,
      totalHour: null,
    };

    const result = mapApprovalInboxItem(backend);

    expect(result.department).toBeNull();
    expect(result.academicYear).toBeNull();
    expect(result.title).toBeNull();
    expect(result.totalHour).toBeNull();
  });

  it('ixtiyoriy maydonlar butunlay tushmasa ham (undefined) fallback null beradi', () => {
    const backend: BackendApprovalInboxItem = {
      entity: 'workload',
      id: 'wl1',
      step: 'financial',
    };

    const result = mapApprovalInboxItem(backend);

    expect(result.title).toBeNull();
    expect(result.department).toBeNull();
    expect(result.academicYear).toBeNull();
    expect(result.submittedAt).toBeNull();
    expect(result.totalHour).toBeNull();
  });
});
