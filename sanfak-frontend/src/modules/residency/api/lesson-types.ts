export interface LessonGroup {
  id: string;
  title: string;
}

export interface Lesson {
  id: string;
  academicYear: string | null;
  academicYearRef: string | null;
  courseNumber: number | null;
  scienceId: string | null;
  scienceTitle: string | null;
  departmentId: string | null;
  departmentTitle: string | null;
  teacherId: string | null;
  teacherName: string | null;
  groups: LessonGroup[];
  startDate: string | null;
  endDate: string | null;
  active: boolean;
}
