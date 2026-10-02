import { describe, expect, it } from 'vitest';
import { mapStudent } from './student-mapper';

describe('mapStudent', () => {
  it('maps subscription _id → id and listener fields', () => {
    const r = mapStudent({
      _id: 'sub-1',
      educationType: 1,
      listener: { _id: 'l1', fullName: 'Ali Valiyev', passport: 'AA1234567' },
    });
    expect(r.id).toBe('sub-1');
    expect(r.fullName).toBe('Ali Valiyev');
    expect(r.passport).toBe('AA1234567');
    expect(r.educationType).toBe(1);
  });

  it('defaults educationType → 2 (shartnoma) and handles missing listener', () => {
    const r = mapStudent({ _id: 'sub-2' });
    expect(r.educationType).toBe(2);
    expect(r.fullName).toBe('—');
  });
});
