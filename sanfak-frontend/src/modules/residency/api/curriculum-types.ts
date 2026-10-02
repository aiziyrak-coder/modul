export type CurriculumProgram = 'magistratura' | 'ordinatura';
export type EducationForm = string;

export interface CurriculumFile {
  url: string;
  name: string | null;
  size: number | null;
  uploadedAt: string | null;
}

export interface Curriculum {
  id: string;
  title: string;
  specialtyId: string | null;
  specialtyTitle: string | null;
  specialtyCode: string | null;
  program: CurriculumProgram;
  educationForm: EducationForm;
  studyPeriod: number | null;
  approvedYear: number | null;
  academicYear: string | null;
  academicYearRef: string | null;
  processFile: CurriculumFile | null;
  planFile: CurriculumFile | null;
  note: string | null;
  createdAt: string | null;
  uploadedAt: string | null;
  active: boolean;
}

export const PROGRAM_LABEL: Record<CurriculumProgram, string> = {
  magistratura: 'Magistr',
  ordinatura: 'Ordinatura',
};


export function formatFileSize(size: number | null): string {
  if (!size || size <= 0) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU');
}
