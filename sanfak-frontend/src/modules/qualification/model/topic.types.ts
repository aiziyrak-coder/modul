export type LessonKind = 1 | 2;
export const LESSON_KIND = { THEORY: 1, PRACTICE: 2 } as const;

export interface Topic {
  id: string;
  title: string;
  code: string;
  orderNumber: number;
  kind: LessonKind;
  duration: number;
}

export interface TopicInput {
  title: string;
  code?: string;
  orderNumber: number;
  kind: LessonKind;
  duration: number;
  course: string;
}
