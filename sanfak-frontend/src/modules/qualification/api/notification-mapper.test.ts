import { describe, it, expect } from 'vitest';
import { mapNotification } from './notification-mapper';

describe('mapNotification', () => {
  it('title→text, _id→id', () => {
    expect(
      mapNotification({ _id: 'n1', title: 'Salom tinglovchilar', createdAt: '2026-06-01T00:00:00.000Z' }),
    ).toEqual({ id: 'n1', text: 'Salom tinglovchilar', createdAt: '2026-06-01T00:00:00.000Z' });
  });
});
