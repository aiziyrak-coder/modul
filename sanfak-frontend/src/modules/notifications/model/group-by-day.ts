import dayjs from 'dayjs';

export type DayGroupKey = 'today' | 'yesterday' | 'thisWeek' | 'older';

export const DAY_GROUP_ORDER: readonly DayGroupKey[] = ['today', 'yesterday', 'thisWeek', 'older'];

interface HasCreatedAt {
  createdAt: Date;
}
interface HasEventType {
  eventType: string;
}

export interface SingleEntry<T> {
  kind: 'single';
  item: T;
}
export interface RollupEntry<T> {
  kind: 'rollup';
  eventType: string;
  items: T[];
}
export type FeedEntry<T> = SingleEntry<T> | RollupEntry<T>;

export interface DayGroup<T> {
  key: DayGroupKey;
  entries: FeedEntry<T>[];
}

export function rollupEntries<T extends HasEventType>(items: readonly T[]): FeedEntry<T>[] {
  const byType = new Map<string, T[]>();
  for (const item of items) {
    const bucket = byType.get(item.eventType);
    if (bucket) bucket.push(item);
    else byType.set(item.eventType, [item]);
  }

  const emitted = new Set<string>();
  const entries: FeedEntry<T>[] = [];
  for (const item of items) {
    const bucket = byType.get(item.eventType) ?? [item];
    if (bucket.length >= 3) {
      if (!emitted.has(item.eventType)) {
        emitted.add(item.eventType);
        entries.push({ kind: 'rollup', eventType: item.eventType, items: bucket });
      }
      continue;
    }
    entries.push({ kind: 'single', item });
  }
  return entries;
}

export function groupByDay<T extends HasCreatedAt & HasEventType>(
  items: readonly T[],
  now: Date = new Date(),
): DayGroup<T>[] {
  const today = dayjs(now).startOf('day');
  const yesterday = today.subtract(1, 'day');
  const weekStart = today.subtract(6, 'day');

  const buckets: Record<DayGroupKey, T[]> = { today: [], yesterday: [], thisWeek: [], older: [] };
  for (const item of items) {
    const day = dayjs(item.createdAt).startOf('day');
    if (day.isSame(today, 'day')) buckets.today.push(item);
    else if (day.isSame(yesterday, 'day')) buckets.yesterday.push(item);
    else if (!day.isBefore(weekStart)) buckets.thisWeek.push(item);
    else buckets.older.push(item);
  }

  return DAY_GROUP_ORDER.map((key) => ({ key, entries: rollupEntries(buckets[key]) })).filter(
    (group) => group.entries.length > 0,
  );
}
