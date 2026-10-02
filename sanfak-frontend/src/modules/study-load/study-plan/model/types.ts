export type StudyPlanStatus = 'new' | 'created';

export interface StudyPlanLearningProcess {
  _id: string;
  title?: string | null;
  direction?: { _id: string; title: string } | string | null;
  year?: string | null;
}

export interface StudyPlan {
  id: string;
  learningProcessId: string | null;
  title: string | null;
  directionTitle: string | null;
  directionId: string | null;
  academicYear: string | null;
  status: StudyPlanStatus;
  createdAt: string;
  active: boolean;
}

export interface DirectionRef {
  id: string;
  title: string;
  knowledgeArea?: string;
  educationArea?: string;
}
