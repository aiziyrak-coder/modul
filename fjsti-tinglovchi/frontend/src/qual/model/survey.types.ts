export const SURVEY_TYPE = {
  CHOICE: 1,
  RATING: 2,
  TEXT: 3,
} as const;

export type SurveyType = (typeof SURVEY_TYPE)[keyof typeof SURVEY_TYPE];

export interface SurveyQuestion {
  _id: string;
  question: string;
  type: SurveyType;
  options: { text: string }[];
  required: boolean;
  order: number;
}

export interface MySurvey {
  required: boolean;
  submitted: boolean;
  questions: SurveyQuestion[];
}

export interface SurveyAnswer {
  question: string;
  optionIndex?: number;
  rating?: number;
  text?: string;
}
