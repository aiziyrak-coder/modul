import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { groupByDay, rollupEntries } from './group-by-day';

interface Item {
  id: string;
  eventType: string;
  createdAt: Date;
}

function item(id: string, isoUtc: string, eventType = 'task_assigned'): Item {
  return { id, eventType, createdAt: new Date(isoUtc) };
}

const ORIGINAL_TZ = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'Asia/Tashkent';
});
afterAll(() => {
  process.env.TZ = ORIGINAL_TZ;
});

describe('groupByDay — mahalliy TZ (UTC ISO-slice EMAS)', () => {
  it('UTC kecha kechqurun = mahalliy bugun ertalab → "today" guruhiga tushadi', () => {
    const now = new Date('2026-08-15T02:00:00.000Z');
    const notif = item('n1', '2026-08-14T19:30:00.000Z');

    const groups = groupByDay([notif], now);

    const today = groups.find((g) => g.key === 'today');
    expect(today?.entries).toHaveLength(1);
    expect(groups.find((g) => g.key === 'yesterday')).toBeUndefined();
  });

  it('bugun / kecha / shu hafta / oldingi to\'g\'ri taqsimlanadi', () => {
    const now = new Date('2026-08-15T10:00:00.000Z');
    const items = [
      item('today', '2026-08-15T05:00:00.000Z'),
      item('yesterday', '2026-08-14T05:00:00.000Z'),
      item('thisWeek', '2026-08-10T05:00:00.000Z'),
      item('older', '2026-07-01T05:00:00.000Z'),
    ];

    const groups = groupByDay(items, now);
    const idsOf = (key: string) =>
      groups
        .find((g) => g.key === key)
        ?.entries.map((e) => (e.kind === 'single' ? e.item.id : `rollup:${e.eventType}`)) ?? [];

    expect(idsOf('today')).toEqual(['today']);
    expect(idsOf('yesterday')).toEqual(['yesterday']);
    expect(idsOf('thisWeek')).toEqual(['thisWeek']);
    expect(idsOf('older')).toEqual(['older']);
  });

  it('bo\'sh guruhlar natijada chiqmaydi', () => {
    const now = new Date('2026-08-15T10:00:00.000Z');
    const groups = groupByDay([item('a', '2026-08-15T05:00:00.000Z')], now);
    expect(groups.map((g) => g.key)).toEqual(['today']);
  });
});

describe('rollupEntries — spec §10 (bir kunda ≥3 bir xil eventType)', () => {
  it('≤2 ta bir xil eventType — rollup ISHLAMAYDI, hammasi single', () => {
    const items = [
      item('a', '2026-08-15T01:00:00.000Z', 'task_assigned'),
      item('b', '2026-08-15T02:00:00.000Z', 'task_assigned'),
    ];
    const entries = rollupEntries(items);
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.kind === 'single')).toBe(true);
  });

  it('≥3 ta bir xil eventType — bitta rollup qatoriga yig\'iladi, hech narsa yo\'qolmaydi', () => {
    const items = [
      item('a', '2026-08-15T01:00:00.000Z', 'task_assigned'),
      item('b', '2026-08-15T02:00:00.000Z', 'task_assigned'),
      item('c', '2026-08-15T03:00:00.000Z', 'task_assigned'),
      item('d', '2026-08-15T04:00:00.000Z', 'announcement_new'),
    ];
    const entries = rollupEntries(items);
    expect(entries).toHaveLength(2);

    const rollup = entries.find((e) => e.kind === 'rollup');
    expect(rollup?.kind).toBe('rollup');
    if (rollup?.kind === 'rollup') {
      expect(rollup.items).toHaveLength(3);
      expect(rollup.items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    }

    const single = entries.find((e) => e.kind === 'single');
    expect(single?.kind === 'single' && single.item.id).toBe('d');
  });
});
