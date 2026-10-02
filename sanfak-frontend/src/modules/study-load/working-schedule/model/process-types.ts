export interface LegendKey {
  _id?: string;
  key: string;
  title: string;
}

export interface ProcessWeek {
  week: number;
  key: string;
}

export interface ProcessMonth {
  _id?: string;
  month: string;
  weeks: ProcessWeek[];
}

export interface ProcessStatItem {
  _id?: string;
  key: string | null;
  slug: string;
  title: string;
  value: number;
}

export interface ProcessCourse {
  _id: string;
  course: string;
  courseNum: number;
  months: ProcessMonth[];
  weeks: Record<string, string>;
  total: number;
  statistics: ProcessStatItem[];
}

export interface WorkingScheduleProcess {
  _id: string;
  keys: LegendKey[];
  courses: ProcessCourse[];
}
