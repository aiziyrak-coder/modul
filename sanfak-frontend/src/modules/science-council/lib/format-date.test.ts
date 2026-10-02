import { describe, expect, it } from 'vitest';
import { formatDate } from './format-date';

describe('science-council formatDate (D-071)', () => {
  it('ISO satrni faqat sana qismiga qisqartiradi', () => {
    expect(formatDate('2026-09-01T00:00:00.000Z')).toBe('2026-09-01');
  });

  it('T belgisiz sana satrini o`zgartirmaydi', () => {
    expect(formatDate('2026-09-01')).toBe('2026-09-01');
  });

  it('bo`sh/undefined/null qiymatda "—" qaytaradi (Invalid Date emas)', () => {
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate(null)).toBe('—');
    expect(formatDate('')).toBe('—');
  });
});
