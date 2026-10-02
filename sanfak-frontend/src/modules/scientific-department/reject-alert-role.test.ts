import { describe, expect, it } from 'vitest';

const sources = import.meta.glob('./**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const ALERT_HEADING = "{t('scientificDepartment.rejectReason')}:";

describe('rad etish alerti — bosqich roli', () => {
  it('alert render qiluvchi har bir fayl `rejecterRoleLabel` ishlatadi', () => {
    const alerts = Object.entries(sources).filter(([, src]) => src.includes(ALERT_HEADING));

    const offenders = alerts
      .filter(([, src]) => !src.includes('rejecterRoleLabel'))
      .map(([path]) => path)
      .sort();

    expect(Object.keys(sources).length).toBeGreaterThan(20);
    expect(alerts.length).toBeGreaterThanOrEqual(7);
    expect(offenders).toEqual([]);
  });
});
