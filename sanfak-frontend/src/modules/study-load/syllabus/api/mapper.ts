import type { SyllabusListItem, SyllabusStatus, SyllabusScience, SyllabusFormValues, TopicHourItem } from '../model/types';
import type { ApprovalStep } from '../../distribution/model/types';
import { mapApprovalStep, type BackendApprovalStep } from '../../distribution/api/mapper';

export interface BackendSyllabusListItem {
  _id: string;
  science?: { _id: string; title?: string | null } | string | null;
  scienceTitle?: string | null;
  semester?: number | null;
  year?: number | null;
  status?: string | null;
  createdAt?: string | null;
  approvalSteps?: Array<{ status: string; comment?: string | null }>;
  currentStep?: string | null;
}

export interface BackendSyllabusScience {
  science: string | null;
  scienceName?: string | null;
  scienceCode?: string | null;
  scienceType?: string | null;
  year?: number | null;
  course?: number | null;
  semester?: number | null;
  totalHour?: number | null;
  classTypes?: Array<{ slug?: string | null; stream?: number | null }> | null;
  items?: Array<{ slug?: string | null; hour?: number | null }> | null;
  credits?: number | null;
  syllabusExists?: boolean;
  syllabusId?: string | null;
  syllabusStatus?: string | null;
}

export interface BackendSyllabusDetail {
  _id: string;
  science?: { _id: string; title?: string | null } | string | null;
  scienceProgram?:
    | { _id?: string | null; scienceCode?: string | null; status?: string | null }
    | string
    | null;
  evaluationForm?: string | null;
  scienceLang?: string | null;
  educationForm?: string | null;
  prerequisiteKnowledge?: { desc?: string | null } | null;
  learningOutcome?: {
    knowledgeOutcomes?: string[];
    skillOutcomes?: string[];
  } | null;
  scienceContent?: {
    topics?: Array<{ topic?: string | null; hour?: number }>;
  } | null;
  trainingSeminar?: {
    topics?: Array<{ topic?: string | null; hour?: number }>;
  } | null;
  independent?: {
    topics?: Array<{ topic?: string | null; hour?: number }>;
  } | null;
  evaluationCriteria?: {
    criteria?: Array<{ slug?: string; title?: string; desc?: string | null }>;
  } | null;
  author?: {
    reviewer?: { desc?: string | null } | null;
  } | null;
  status?: string | null;
  approvalSteps?: BackendApprovalStep[];
}

function extractScienceName(
  s: { _id: string; title?: string | null } | string | null | undefined,
  fallback?: string | null,
): string | null {
  if (!s) return fallback ?? null;
  if (typeof s === 'string') return fallback ?? null;
  return s.title ?? fallback ?? null;
}

function extractScienceProgramId(
  sp: { _id?: string | null } | string | null | undefined,
): string {
  if (!sp) return '';
  if (typeof sp === 'string') return sp;
  return sp._id ?? '';
}

function extractRejectedReason(
  steps: Array<{ status: string; comment?: string | null }> | undefined,
): string | null {
  if (!steps) return null;
  const rejected = steps.find((s) => s.status === 'rejected');
  return rejected?.comment ?? null;
}

export function mapSyllabus(b: BackendSyllabusListItem): SyllabusListItem {
  return {
    id: b._id,
    scienceName: extractScienceName(b.science, b.scienceTitle),
    semester: b.semester ?? null,
    year: b.year ?? null,
    status: (b.status as SyllabusStatus) ?? 'draft',
    createdAt: b.createdAt ?? null,
    rejectedReason: extractRejectedReason(b.approvalSteps),
    currentStep: b.currentStep ?? null,
  };
}

export function mapSyllabusScience(b: BackendSyllabusScience): SyllabusScience {
  const findClassHour = (slug: string): number | null => {
    const ct = b.classTypes?.find((c) => c.slug === slug);
    return ct?.stream ?? null;
  };

  const independentHour: number | null =
    b.items?.find((i) => i.slug === 'mustaqil')?.hour ??
    findClassHour('mustaqil');

  return {
    id: b.science ?? '',
    name: b.scienceName ?? b.science ?? '—',
    code: b.scienceCode ?? null,
    scienceType: b.scienceType ?? null,
    year: b.year ?? b.course ?? null,
    semester: b.semester ?? null,
    totalHour: b.totalHour ?? null,
    lectureHour: findClassHour('maruza'),
    practicalHour: findClassHour('amaliy'),
    labHour: findClassHour('laboratoriya'),
    seminarHour: findClassHour('seminar'),
    independentHour,
    credits: b.credits ?? null,
    syllabusExists: b.syllabusExists ?? false,
    syllabusId: b.syllabusId ?? null,
    syllabusStatus: (b.syllabusStatus as SyllabusStatus) ?? null,
  };
}

function mapTopics(
  arr: Array<{ topic?: string | null; hour?: number }> | undefined,
): TopicHourItem[] {
  if (!arr || arr.length === 0) return [{ topic: '', hour: 0 }];
  return arr.map((t) => ({ topic: t.topic ?? '', hour: t.hour ?? 0 }));
}

export function mapSyllabusDetail(b: BackendSyllabusDetail): SyllabusFormValues {
  const criteria = b.evaluationCriteria?.criteria ?? [];
  const findCriteria = (slug: string): string =>
    criteria.find((c) => c.slug === slug)?.desc ?? '';

  const scienceId = typeof b.science === 'object' && b.science !== null
    ? b.science._id
    : (b.science as string | undefined) ?? '';

  const knowledgeOutcomes = b.learningOutcome?.knowledgeOutcomes ?? [];
  const skillOutcomes = b.learningOutcome?.skillOutcomes ?? [];

  return {
    science: scienceId,
    scienceProgram: extractScienceProgramId(b.scienceProgram),
    evaluationForm: b.evaluationForm ?? '',
    scienceLang: b.scienceLang ?? '',
    educationForm: b.educationForm ?? '',
    prerequisiteKnowledge: b.prerequisiteKnowledge?.desc ?? '',

    knowledgeOutcomes: knowledgeOutcomes.length > 0 ? knowledgeOutcomes : [''],
    skillOutcomes: skillOutcomes.length > 0 ? skillOutcomes : [''],
    lectures: mapTopics(b.scienceContent?.topics),
    seminars: mapTopics(b.trainingSeminar?.topics),

    independentWorks: mapTopics(b.independent?.topics),
    criteria5: findCriteria('5'),
    criteria4: findCriteria('4'),
    criteria3: findCriteria('3'),
    criteria2: findCriteria('2'),
    reviewer: b.author?.reviewer?.desc ?? '',
  };
}

export function mapSyllabusApprovalSteps(b: BackendSyllabusDetail): ApprovalStep[] {
  return (b.approvalSteps ?? []).map(mapApprovalStep);
}
