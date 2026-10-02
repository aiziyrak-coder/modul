import type { LessonType } from '../api/types';

export const LESSON_TYPES: readonly LessonType[] = [
  'maruza',
  'amaliy',
  'test',
  'oraliq_nazorat',
  'yakuniy_nazorat',
];

export const LESSON_LABEL: Record<LessonType, string> = {
  maruza: "Ma'ruza",
  amaliy: 'Amaliy',
  test: 'Test',
  oraliq_nazorat: 'Oraliq nazorat',
  yakuniy_nazorat: 'Yakuniy nazorat',
};

export const lessonLabel = (l: LessonType | null | undefined): string =>
  l ? LESSON_LABEL[l] : '—';

export const isLessonTypeGraded = (l: LessonType | null | undefined): boolean => l !== 'amaliy';

export const asLessonType = (v: unknown): LessonType | null =>
  typeof v === 'string' && (LESSON_TYPES as readonly string[]).includes(v)
    ? (v as LessonType)
    : null;
