import { describe, expect, it } from 'vitest';
import { vacancyReasonLabel } from './vacancy-reason';

describe('vacancyReasonLabel — "Sabab va muddat" ustuni (D-6)', () => {
  const tr = (key: string, opts?: Record<string, unknown>): string => {
    if (key === 'studyLoad.vacancy.reason.since') return `${String(opts?.date)} dan`;
    const labels: Record<string, string> = {
      'studyLoad.vacancy.reason.leave': "Ta'til",
      'studyLoad.vacancy.reason.resignation': "Ishdan bo'shash",
    };
    return labels[key] ?? key;
  };
  const d = (iso: string): string => new Date(iso).toLocaleDateString('uz-UZ');
  const FROM = '2024-04-10T00:00:00.000Z';
  const TO = '2024-04-15T00:00:00.000Z';

  it("ta'til — turi va sana oralig'i", () => {
    const v = { vacancyReason: 'leave', leave: { type: 'leave', fromDate: FROM, toDate: TO } };
    expect(vacancyReasonLabel(v, tr)).toBe(`Ta'til: ${d(FROM)} – ${d(TO)}`);
  });

  it('faqat boshlanish sanasi (ishdan ketish) — «… dan»', () => {
    const v = { vacancyReason: null, leave: { type: 'resignation', fromDate: FROM, toDate: null } };
    expect(vacancyReasonLabel(v, tr)).toBe(`Ishdan bo'shash: ${d(FROM)} dan`);
  });

  it("ariza yo'q — `vacancyReason`; noma'lum qiymat xom holda (i18n key sizmaydi)", () => {
    expect(vacancyReasonLabel({ vacancyReason: 'leave', leave: null }, tr)).toBe("Ta'til");
    expect(vacancyReasonLabel({ vacancyReason: 'qo`lda', leave: null }, tr)).toBe('qo`lda');
  });

  it("hech narsa yo'q — chiziqcha", () => {
    expect(vacancyReasonLabel({ vacancyReason: null, leave: null }, tr)).toBe('—');
  });
});
