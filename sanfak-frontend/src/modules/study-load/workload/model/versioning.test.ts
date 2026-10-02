import { describe, expect, it } from 'vitest';
import {
  extractOpenVersionConflict,
  isWorkloadSuperseded,
  workloadVersionLabel,
} from './versioning';

describe('extractOpenVersionConflict', () => {
  const axiosLike = (status: number, data: unknown) => ({ response: { status, data } });

  it('409 open_version_exists → backend matni + openWorkloadId', () => {
    const c = extractOpenVersionConflict(
      axiosLike(409, {
        status: 'error',
        statusCode: 409,
        message: 'Bu kafedra va o`quv yili uchun ochiq versiya bor — bitta ochiq versiya',
        detail: 'Mavjud yuklama holati: "draft".',
        reason: 'open_version_exists',
        openWorkloadId: 'w9',
        openStatus: 'draft',
      }),
    );
    expect(c).toEqual({
      message: 'Bu kafedra va o`quv yili uchun ochiq versiya bor — bitta ochiq versiya',
      openWorkloadId: 'w9',
      openStatus: 'draft',
    });
  });

  it("openWorkloadId yo'q → null id (havola chizilmaydi)", () => {
    const c = extractOpenVersionConflict(axiosLike(409, { reason: 'open_version_exists', message: 'x' }));
    expect(c?.openWorkloadId).toBeNull();
  });

  it('boshqa 409 / boshqa status / xom xato → null', () => {
    expect(extractOpenVersionConflict(axiosLike(409, { reason: 'newer_version_approved' }))).toBeNull();
    expect(extractOpenVersionConflict(axiosLike(400, { reason: 'open_version_exists' }))).toBeNull();
    expect(extractOpenVersionConflict(new Error('network'))).toBeNull();
    expect(extractOpenVersionConflict(null)).toBeNull();
  });
});

describe('workloadVersionLabel / isWorkloadSuperseded', () => {
  it('faqat v2+ da belgi', () => {
    expect(workloadVersionLabel(1)).toBeNull();
    expect(workloadVersionLabel(undefined)).toBeNull();
    expect(workloadVersionLabel(2)).toBe('v2');
  });

  it('superseded aniqlanadi', () => {
    expect(isWorkloadSuperseded('superseded')).toBe(true);
    expect(isWorkloadSuperseded('approved')).toBe(false);
    expect(isWorkloadSuperseded(null)).toBe(false);
  });
});
