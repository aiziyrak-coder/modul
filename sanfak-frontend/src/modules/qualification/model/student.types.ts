export type EduType = 1 | 2;
export const EDU_TYPE = { GRANT: 1, CONTRACT: 2 } as const;

export interface CourseStudent {
  id: string;
  fullName: string;
  passport?: string;
  province?: string;
  region?: string;
  institution?: string;
  phone?: string;
  educationType: EduType;
}
