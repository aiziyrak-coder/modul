export interface LpRef {
  id: string;
  title: string;
}

export interface LpProcessKey {
  id: string;
  key: string;
  title: string;
  week: number | string;
  semester: string | null;
}

export interface LpMonth {
  _id?: string;
  month?: string;
  weeks?: { week?: number; key?: string; _id?: string }[];
}

export interface LpStatItem {
  _id?: string;
  key?: string | null;
  slug?: string;
  title?: string;
  value?: number;
}

export interface LpCourse {
  _id?: string;
  course?: string;
  courseNum?: number;
  months?: LpMonth[];
  weeks?: Record<string, string>;
  total?: number;
  statistics?: LpStatItem[];
}

export interface LpLegendKey {
  _id?: string;
  key?: string;
  title?: string;
}

export interface LpAllValueStat {
  _id?: string;
  slug?: string;
  title?: string;
  value?: number;
}

export interface LpAllValues {
  total?: number;
  statistics?: LpAllValueStat[];
}

export interface StudyPlanDetail {
  id: string;
  title: string | null;
  direction: LpRef | null;
  academicLevel: LpRef | null;
  educationForm: LpRef | null;
  readingForm: LpRef | null;
  specialization: LpRef | null;
  studyPeriod: LpRef | null;
  year: string | null;
  comment: string | null;
  file: string | null;
  planFile: string | null;
  keys: LpLegendKey[];
  courses: LpCourse[];
  allValues?: LpAllValues;
  learningProcess: {
    keys: LpProcessKey[];
    title: string | null;
  };
}
