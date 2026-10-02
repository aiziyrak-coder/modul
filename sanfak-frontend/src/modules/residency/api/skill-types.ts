export const SEMESTERS = [
  '1-semestr',
  '2-semestr',
  '3-semestr',
  '4-semestr',
  '5-semestr',
  '6-semestr',
] as const;
export type Semester = (typeof SEMESTERS)[number];

export interface TheoryTopic {
  id: string;
  title: string;
  active: boolean;
}

export interface Skill {
  id: string;
  specialtyId: string | null;
  specialtyTitle: string | null;
  semester: string;
  theoryTopicId: string | null;
  theoryTopicTitle: string | null;
  practicalSkill: string;
  patientCount: number;
  active: boolean;
}

export interface SkillProgressRow {
  residentId: string;
  fullName: string;
  courseNumber: number | null;
  groupTitle: string | null;
  specialtyTitle: string | null;
  skillId: string;
  semester: string;
  theoryTopicTitle: string | null;
  practicalSkill: string;
  target: number;
  completed: number;
  done: boolean;
}
