import type { PlanHourItem, TopicType } from '../model/types';
import { TOPIC_TYPES } from './v142-defaults';

export type TopicHoursState = 'ok' | 'under' | 'over' | 'unplanned' | 'noPlan';

export interface TopicHoursRow {
  type: TopicType;
  used: number;
  plan: number | null;
  state: TopicHoursState;
}

export interface TopicHoursInput {
  type: TopicType | '' | undefined;
  hours: number | null | undefined;
}

function isTopicType(v: unknown): v is TopicType {
  return typeof v === 'string' && (TOPIC_TYPES as readonly string[]).includes(v);
}

function toHours(v: number | null | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

export function sumHoursByType(topics: readonly TopicHoursInput[]): Map<TopicType, number> {
  const used = new Map<TopicType, number>();
  for (const t of topics) {
    if (!isTopicType(t.type)) continue;
    used.set(t.type, (used.get(t.type) ?? 0) + toHours(t.hours));
  }
  return used;
}

export function summarizeTopicHours(
  topics: readonly TopicHoursInput[],
  planItems: readonly PlanHourItem[] | null | undefined,
): TopicHoursRow[] {
  const used = sumHoursByType(topics);
  const hasPlan = Array.isArray(planItems) && planItems.length > 0;

  const plan = new Map<TopicType, number>();
  if (hasPlan) {
    for (const item of planItems) {
      if (!isTopicType(item.slug)) continue;
      const value = Number(item.value);
      plan.set(item.slug, Number.isFinite(value) && value > 0 ? value : 0);
    }
  }

  const rows: TopicHoursRow[] = [];
  for (const type of TOPIC_TYPES) {
    const usedHours = used.get(type) ?? 0;
    const inPlan = plan.has(type);
    const hasTopics = used.has(type);

    if (!hasPlan) {
      if (hasTopics) rows.push({ type, used: usedHours, plan: null, state: 'noPlan' });
      continue;
    }

    if (!inPlan) {
      if (hasTopics) rows.push({ type, used: usedHours, plan: null, state: 'unplanned' });
      continue;
    }

    const planHours = plan.get(type) ?? 0;
    const state: TopicHoursState =
      usedHours === planHours ? 'ok' : usedHours < planHours ? 'under' : 'over';
    rows.push({ type, used: usedHours, plan: planHours, state });
  }
  return rows;
}

export function hasHoursMismatch(rows: readonly TopicHoursRow[]): boolean {
  return rows.some((r) => r.state === 'under' || r.state === 'over' || r.state === 'unplanned');
}

export function mismatchedRows(rows: readonly TopicHoursRow[]): TopicHoursRow[] {
  return rows.filter((r) => r.state === 'under' || r.state === 'over' || r.state === 'unplanned');
}
