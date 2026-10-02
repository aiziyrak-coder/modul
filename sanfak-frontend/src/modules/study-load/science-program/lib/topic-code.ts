import type { TopicType } from '../model/types';

export const TOPIC_CODE_PREFIX: Record<TopicType, string> = {
  maruza: 'M',
  amaliy: 'A',
  seminar: 'S',
  laboratoriya: 'L',
  klinik_amaliyot: 'K',
};

function isTopicType(v: unknown): v is TopicType {
  return typeof v === 'string' && v in TOPIC_CODE_PREFIX;
}

export function renumberTopicCodes<T extends { type: TopicType | '' | undefined }>(
  topics: readonly T[],
): (T & { code: string })[] {
  const counters: Partial<Record<TopicType, number>> = {};
  return topics.map((topic) => {
    if (!isTopicType(topic.type)) return { ...topic, code: '' };
    const next = (counters[topic.type] ?? 0) + 1;
    counters[topic.type] = next;
    return { ...topic, code: `${TOPIC_CODE_PREFIX[topic.type]}${next}` };
  });
}

export function outcomeCode(position: number): string {
  return `TN${position}`;
}

export function effectiveCode(manual: string | null | undefined, auto: string): string {
  const m = (manual ?? '').trim();
  return m || auto;
}

export function manualCodeOrEmpty(stored: string | null | undefined, auto: string): string {
  const s = (stored ?? '').trim();
  return s && s !== auto ? s : '';
}
