import { describe, expect, it } from 'vitest';
import { mapHrProfileDetail, mapHrProfileListItem, type BackendHrProfile } from './mapper';

function buildBackend(overrides: Partial<BackendHrProfile> = {}): BackendHrProfile {
  return {
    _id: 'p1',
    user: {
      _id: 'u1',
      firstName: 'Ali',
      lastName: 'Valiyev',
      middleName: null,
      photo: null,
      phone: '998900000000',
      email: 'old@example.com',
      degrees: null,
    },
    department: { _id: 'd1', title: 'Ichki kasalliklar' },
    faculty: { _id: 'f1', title: 'Davolash' },
    position: { _id: 'pos1', title: 'Dotsent' },
    hrApprovalStatus: 'pending',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('mapHrProfileListItem — contactInfo seam (D-2)', () => {
  it("contactInfo bo'lmasa user.phone'ni ishlatadi (backward-compat)", () => {
    const item = mapHrProfileListItem(buildBackend({ contactInfo: null }));
    expect(item.phone).toBe('998900000000');
  });

  it("contactInfo.phone bo'lsa — o'qituvchi tahrirlagan qiymat user.phone'dan USTUN turadi", () => {
    const item = mapHrProfileListItem(
      buildBackend({ contactInfo: { phone: '998911111111', email: 'new@example.com' } }),
    );
    expect(item.phone).toBe('998911111111');
  });
});

describe('mapHrProfileDetail — contactInfo seam (D-2)', () => {
  it("contactInfo bo'lmasa user.phone/email'ni ishlatadi", () => {
    const detail = mapHrProfileDetail(buildBackend({ contactInfo: null }));
    expect(detail.phone).toBe('998900000000');
    expect(detail.email).toBe('old@example.com');
  });

  it("contactInfo.phone/email bo'lsa — yangilangan qiymat ko'rsatiladi", () => {
    const detail = mapHrProfileDetail(
      buildBackend({ contactInfo: { phone: '998922222222', email: 'updated@example.com' } }),
    );
    expect(detail.phone).toBe('998922222222');
    expect(detail.email).toBe('updated@example.com');
  });
});
