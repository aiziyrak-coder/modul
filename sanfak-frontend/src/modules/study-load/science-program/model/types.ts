export interface ScienceProgram {
  id: string;
  scienceName: string | null;
  semester: string | number | null;
  academicYearTitle: string | null;
  status: ScienceProgramStatus;
  createdAt: string | null;
  rejectedReason: string | null;
  currentStep: string | null;
  formVersion: ScienceProgramFormVersion;
}

export type ScienceProgramStatus = 'draft' | 'in_review' | 'approved' | 'rejected';

export type ScienceProgramFormVersion = 'v259' | 'v142';

export interface ScienceOption {
  id: string;
  name: string;
  code: string | null;
  academicYear: string | null;
  semester: string | null;
  programExists: boolean;
  programId: string | null;
  programStatus: ScienceProgramStatus | null;
  programCode: string | null;
  assignedHours: AssignedHours | null;
}

export interface TopicInput {
  order: number;
  title: string;
  desc: string;
}

export interface ScienceProgramFormValues {
  science: string;
  knowledgeArea: string[];
  educationArea: string[];
  directions: string[];
  sciencePurpose: string;
  scienceTasks: string;
  responsible: string;
  topics: TopicInput[];

  seminarRecommendationDesc: string;
  independentTaskDesc: string;
  learningOutcomeDesc: string;
  teachingMethodsDesc: string;
  creditRequirementsDesc: string;

  guidanceLiteratureDesc: string;
  primaryLiteratureDesc: string;
  additionalLiteratureDesc: string;
  reviewerDesc: string;
  informationSourceDesc: string;

  formVersion?: ScienceProgramFormVersion;

  language: string;
}

export interface ScienceProgramPayload {
  science: string;
  formVersion?: ScienceProgramFormVersion;

  language?: string;
  academicYear?: string;
  semester?: string;
  knowledgeArea?: string[];
  educationArea?: string[];
  directions?: string[];
  sciencePurpose?: { desc: string };
  scienceTasks?: { desc: string };
  responsible?: { title: string; desc: string };
  topics?: TopicInput[];
  seminarRecommendation?: { desc: string };
  independentTask?: { desc: string };
  learningOutcome?: { desc: string };
  teachingMethods?: { desc: string };
  creditRequirements?: { desc: string };
  guidanceLiterature?: { desc: string };
  primaryLiterature?: { desc: string };
  additionalLiterature?: { desc: string };
  informationSource?: { desc: string };
  reviewer?: { desc: string };
}

export type TopicType = 'maruza' | 'amaliy' | 'seminar' | 'laboratoriya' | 'klinik_amaliyot';

export interface PlanHourItem {
  slug: string;
  title: string;
  value: number;
}

export interface PlanHours {
  items: PlanHourItem[];
  classroomHours: number | null;
  independentHours: number | null;
  totalHours: number | null;
  credits: number | null;
  weeklyHours: number | null;
  semester: string | null;
  code: string | null;
  serialNumber: string | null;
  moduleType: string | null;
  warnings: string[];
  clinicalUnknown: boolean;
}

export interface WorkingPlanStatus {
  hasWorkingPlan: boolean;
  warning: string | null;
  planHours: PlanHours | null;
}

export interface AssignedHours {
  byType: Record<TopicType, number | null>;
  independent: number | null;
  total: number | null;
}

export interface PersonInput {
  fio: string;
  degree: string;
  title: string;
  department: string;
  position: string;
}

export interface StaffPerson {
  id: string;
  fio: string;
  fullName: string;
  degree: string;
  title: string;
  department: string;
  position: string;
}

export interface PrerequisiteInput {
  code: string;
  title: string;
}

export interface CodeTextInput {
  code: string;
  text: string;
}

export interface V142TopicInput {
  type: TopicType | '';
  code: string;
  title: string;
  hours: number;
  refs: string;
}

export interface V142IndependentTaskInput {
  order: number;
  title: string;
  hours: number;
}

export interface ProtocolInput {
  date: string | null;
  number: string;
}

export interface V142FormValues {
  science: string;
  language: string;
  educationForm: string;
  knowledgeArea: string[];
  educationArea: string[];
  directions: string[];
  councilProtocol: ProtocolInput;
  departmentProtocol: ProtocolInput;
  authors: PersonInput[];
  reviewers: PersonInput[];

  sciencePurpose: string;
  scienceTasks: string;
  prerequisites: PrerequisiteInput[];
  competencies: CodeTextInput[];
  skills: CodeTextInput[];

  topics: V142TopicInput[];
  independentTasks: V142IndependentTaskInput[];
  independentNote: string;

  techMethods: string[];
  creditRequirements: string;
  grading: { a: string[]; b: string[]; d: string[]; e: string[] };

  primaryLiterature: string[];
  additionalLiterature: string[];
  informationSources: string[];
}

export interface V142PersonPayload {
  fio: string;
  degree: string | null;
  title: string | null;
  department: string | null;
  position: string | null;
}

export interface V142TopicPayload {
  type: TopicType;
  code: string;
  title: string;
  hours: number;
  refs: number[];
}

export interface V142Block {
  educationForm: string;
  prerequisites: { code: string | null; title: string }[];
  outcomes: {
    competencies: { code: string | null; text: string }[];
    skills: { code: string | null; text: string }[];
  };
  topics: V142TopicPayload[];
  independentTasks: V142IndependentTaskInput[];
  independentNote: string | null;
  techMethods: string[];
  grading: { a: string[]; b: string[]; d: string[]; e: string[] };
  authors: V142PersonPayload[];
  reviewers: V142PersonPayload[];
  councilProtocol: { date: string | null; number: string | null };
  departmentProtocol: { date: string | null; number: string | null };
}

export interface LiteratureGroupPayload {
  slug: 'primary' | 'additional' | 'information';
  title: string;
  literatures: string[];
}

export interface V142Payload {
  science: string;
  formVersion?: 'v142';
  academicYear?: string;
  semester?: string;
  knowledgeArea?: string[];
  educationArea?: string[];
  directions?: string[];
  language?: string;
  sciencePurpose?: { desc: string };
  scienceTasks?: { desc: string };
  creditRequirements?: { desc: string };
  literatureGroups?: LiteratureGroupPayload[];
  v142: V142Block;
}
