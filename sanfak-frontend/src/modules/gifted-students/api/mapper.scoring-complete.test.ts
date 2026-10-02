import { describe, expect, it } from 'vitest';
import { mapScholarship, type BackendScholarship } from './mapper';

const scholarship: BackendScholarship = {
  _id: 'SCH-1',
  name: "Rektor yo'nalishi",
  type: 'rektor',
};

describe('mapScholarship — scoringComplete', () => {
  it('true uzatiladi', () => {
    expect(mapScholarship({ ...scholarship, scoringComplete: true }).scoringComplete).toBe(true);
  });

  it('false ham uzatiladi', () => {
    expect(mapScholarship({ ...scholarship, scoringComplete: false }).scoringComplete).toBe(false);
  });

  it('🔴 maydon YO\u2018Q — `undefined` qoladi, `false` ga AYLANMAYDI', () => {
    expect(mapScholarship(scholarship).scoringComplete).toBeUndefined();
  });
});
