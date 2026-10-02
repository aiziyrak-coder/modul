export interface Contingent {
  id: string;
  title: string;
  desc: string | null;
  directionId: string | null;
  directionTitle: string | null;
  courseId: string | null;
  courseTitle: string | null;
  langId: string | null;
  langTitle: string | null;
  academicYearId: string | null;
  academicYearTitle: string | null;
  studentNumber: number;
  active: boolean;
}

export interface ContingentFormValues {
  title: string;
  desc: string;
  direction: string;
  course: string;
  lang: string;
  academicYear: string;
  studentNumber: number;
}

export interface RefOption {
  id: string;
  title: string;
}
