export type SyllabusStatus = 'draft' | 'new' | 'in_review' | 'approved' | 'rejected';

export interface SyllabusListItem {
  id: string;
  scienceName: string | null;
  semester: number | null;
  year: number | null;
  status: SyllabusStatus;
  createdAt: string | null;
  rejectedReason: string | null;
  currentStep: string | null;
}

export interface SyllabusScience {
  id: string;
  name: string;
  code: string | null;
  scienceType: string | null;
  year: number | null;
  semester: number | null;
  totalHour: number | null;
  lectureHour: number | null;
  practicalHour: number | null;
  labHour: number | null;
  seminarHour: number | null;
  independentHour: number | null;
  credits: number | null;
  syllabusExists: boolean;
  syllabusId: string | null;
  syllabusStatus: SyllabusStatus | null;
}

export interface ScienceProgramOption {
  value: string;
  label: string;
  isV142: boolean;
  disabled: boolean;
}

export interface TopicHourItem {
  topic: string;
  hour: number | string;
}

export interface GradingCriterion {
  slug: string;
  title: string;
  desc: string;
}

export interface SyllabusFormValues {
  science: string;
  scienceProgram: string;
  evaluationForm: string;
  scienceLang: string;
  educationForm: string;
  prerequisiteKnowledge: string;

  knowledgeOutcomes: string[];
  skillOutcomes: string[];
  lectures: TopicHourItem[];
  seminars: TopicHourItem[];

  independentWorks: TopicHourItem[];
  criteria5: string;
  criteria4: string;
  criteria3: string;
  criteria2: string;
  reviewer: string;
}

export interface SyllabusPayload {
  science: string;
  faculty?: string;
  scienceProgram: string;
  evaluationForm?: string;
  scienceLang?: string;
  educationForm?: string;
  year?: number;
  semester?: number;
  prerequisiteKnowledge?: { desc: string };
  learningOutcome?: {
    knowledgeOutcomes?: string[];
    skillOutcomes?: string[];
  };
  scienceContent?: {
    topics?: Array<{ topic: string; hour: number }>;
  };
  trainingSeminar?: {
    topics?: Array<{ topic: string; hour: number }>;
  };
  independent?: {
    topics?: Array<{ topic: string; hour: number }>;
  };
  evaluationCriteria?: {
    criteria?: GradingCriterion[];
  };
  author?: {
    reviewer?: { desc: string };
  };
  finalize?: boolean;
}
