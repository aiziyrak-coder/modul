export const SURVEY_TYPE = {
  CHOICE: 1,
  RATING: 2,
  TEXT: 3,
} as const;

export type SurveyType = (typeof SURVEY_TYPE)[keyof typeof SURVEY_TYPE];

export interface SurveyOption {
  text: string;
}

export interface SurveyQuestion {
  _id: string;
  question: string;
  type: SurveyType;
  options: SurveyOption[];
  required: boolean;
  order: number;
  active: boolean;
}

export interface SurveyQuestionInput {
  question: string;
  type: SurveyType;
  options?: SurveyOption[];
  required?: boolean;
  order?: number;
}

export interface SurveySummary {
  _id: string;
  question: string;
  type: SurveyType;
  total: number;
  counts?: { text: string; count: number }[];
  average?: number | null;
  texts?: { text: string; listener: string | null }[];
}

export interface SurveyAnswerRow {
  _id: string;
  fullName: string;
  submittedAt: string | null;
}

export interface SurveySubmissionAnswer {
  question: string;
  type: SurveyType;
  optionText: string;
  rating: number | null;
  text: string;
}

export interface SurveySubmission {
  id: string;
  listenerName: string;
  courseName: string;
  submittedAt: string | null;
  answers: SurveySubmissionAnswer[];
}
