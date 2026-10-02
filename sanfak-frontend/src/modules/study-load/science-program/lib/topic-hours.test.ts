import { describe, expect, it } from 'vitest';
import {
  hasHoursMismatch,
  mismatchedRows,
  summarizeTopicHours,
  sumHoursByType,
} from './topic-hours';
import type { PlanHourItem } from '../model/types';

const PLAN: PlanHourItem[] = [
  { slug: 'maruza', title: "Ma'ruza", value: 10 },
  { slug: 'amaliy', title: 'Amaliy', value: 20 },
  { slug: 'laboratoriya', title: 'Laboratoriya', value: 0 },
];

describe('summarizeTopicHours — beshta holat', () => {
  it('ok — used === plan', () => {
    const rows = summarizeTopicHours(
      [
        { type: 'amaliy', hours: 12 },
        { type: 'amaliy', hours: 8 },
      ],
      PLAN,
    );

    expect(rows.find((r) => r.type === 'amaliy')).toEqual({
      type: 'amaliy',
      used: 20,
      plan: 20,
      state: 'ok',
    });
  });

  it('under — used < plan (8/10)', () => {
    const rows = summarizeTopicHours([{ type: 'maruza', hours: 8 }], PLAN);

    expect(rows.find((r) => r.type === 'maruza')).toEqual({
      type: 'maruza',
      used: 8,
      plan: 10,
      state: 'under',
    });
  });

  it('over — used > plan (12/10)', () => {
    const rows = summarizeTopicHours([{ type: 'maruza', hours: 12 }], PLAN);

    expect(rows.find((r) => r.type === 'maruza')?.state).toBe('over');
  });

  it("unplanned — rejada BU TUR yo'q, lekin mavzu kiritilgan (klinik amaliyot, R-2)", () => {
    const rows = summarizeTopicHours([{ type: 'klinik_amaliyot', hours: 24 }], PLAN);

    expect(rows.find((r) => r.type === 'klinik_amaliyot')).toEqual({
      type: 'klinik_amaliyot',
      used: 24,
      plan: null,
      state: 'unplanned',
    });
  });

  it("noPlan — reja yo'q (`null`) → belgisiz, faqat kiritilgan turlar, ogohlantirish YO'Q", () => {
    const rows = summarizeTopicHours(
      [
        { type: 'maruza', hours: 4 },
        { type: 'seminar', hours: 2 },
      ],
      null,
    );

    expect(rows).toEqual([
      { type: 'maruza', used: 4, plan: null, state: 'noPlan' },
      { type: 'seminar', used: 2, plan: null, state: 'noPlan' },
    ]);
    expect(hasHoursMismatch(rows)).toBe(false);
  });

  it("bo'sh `items[]` ham «reja yo'q» deb qaraladi (reja approved bo'lmasa §1 butunlay bo'sh)", () => {
    const rows = summarizeTopicHours([{ type: 'maruza', hours: 4 }], []);

    expect(rows[0]?.state).toBe('noPlan');
  });
});

describe('summarizeTopicHours — qator tanlovi va tartib', () => {
  it("rejada bor tur mavzusiz ham ko'rinadi (0/10 under); rejada yo'q va ishlatilmagan tur ko'rinmaydi", () => {
    const rows = summarizeTopicHours([], PLAN);

    expect(rows.map((r) => r.type)).toEqual(['maruza', 'amaliy', 'laboratoriya']);
    expect(rows[0]).toEqual({ type: 'maruza', used: 0, plan: 10, state: 'under' });
    expect(rows[2]).toEqual({ type: 'laboratoriya', used: 0, plan: 0, state: 'ok' });
  });

  it('tartib DOIM TOPIC_TYPES bo`yicha — kiritish tartibiga bog`liq emas', () => {
    const rows = summarizeTopicHours(
      [
        { type: 'klinik_amaliyot', hours: 1 },
        { type: 'maruza', hours: 1 },
      ],
      PLAN,
    );

    expect(rows.map((r) => r.type)).toEqual([
      'maruza',
      'amaliy',
      'laboratoriya',
      'klinik_amaliyot',
    ]);
  });

  it("turi tanlanmagan / manfiy / NaN soatli qatorlar yig'indiga kirmaydi", () => {
    const used = sumHoursByType([
      { type: '', hours: 5 },
      { type: undefined, hours: 5 },
      { type: 'maruza', hours: -3 },
      { type: 'maruza', hours: Number.NaN },
      { type: 'maruza', hours: null },
      { type: 'maruza', hours: 2 },
    ]);

    expect(used.get('maruza')).toBe(2);
    expect(used.size).toBe(1);
  });
});

describe('hasHoursMismatch / mismatchedRows — confirm darvozasi (D-10)', () => {
  it("under/over/unplanned bo'lsa confirm kerak; ok/noPlan bo'lsa kerak emas", () => {
    const rows = summarizeTopicHours(
      [
        { type: 'maruza', hours: 8 },
        { type: 'amaliy', hours: 20 },
        { type: 'klinik_amaliyot', hours: 24 },
      ],
      PLAN,
    );

    expect(hasHoursMismatch(rows)).toBe(true);
    expect(mismatchedRows(rows).map((r) => r.type)).toEqual(['maruza', 'klinik_amaliyot']);

    const allOk = summarizeTopicHours(
      [
        { type: 'maruza', hours: 10 },
        { type: 'amaliy', hours: 20 },
      ],
      PLAN,
    );
    expect(hasHoursMismatch(allOk)).toBe(false);
    expect(mismatchedRows(allOk)).toEqual([]);
  });
});
