import type { LessonKind, Topic } from '../model/topic.types';

export interface BackendTopic {
  _id: string;
  title: string;
  code?: string;
  orderNumber: number;
  kind: number;
  duration: number;
}

export function mapTopic(b: BackendTopic): Topic {
  return {
    id: b._id,
    title: b.title,
    code: b.code ?? '',
    orderNumber: b.orderNumber,
    kind: (b.kind === 2 ? 2 : 1) as LessonKind,
    duration: b.duration,
  };
}
