import type { StudyPlan, StudyPlanStatus } from '../model/types';

export interface BackendStudyPlan {
  _id: string;
  status?: StudyPlanStatus;
  learningProcess?:
    | {
        _id: string;
        title?: string | null;
        year?: string | null;
        direction?: { _id: string; title: string } | string | null;
      }
    | string
    | null;
  active?: boolean;
  createdAt: string;
}

function extractLpId(lp: BackendStudyPlan['learningProcess']): string | null {
  if (!lp) return null;
  if (typeof lp === 'string') return lp;
  return lp._id ?? null;
}

function extractLearningProcess(lp: BackendStudyPlan['learningProcess']): {
  title: string | null;
  directionTitle: string | null;
  directionId: string | null;
  academicYear: string | null;
} {
  if (!lp || typeof lp === 'string') {
    return { title: null, directionTitle: null, directionId: null, academicYear: null };
  }

  const dir = lp.direction;
  const directionTitle =
    dir && typeof dir === 'object' && 'title' in dir ? (dir.title ?? null) : null;
  const directionId =
    dir && typeof dir === 'object' && '_id' in dir ? (dir._id ?? null) : null;

  return {
    title: lp.title ?? null,
    directionTitle,
    directionId,
    academicYear: lp.year ?? null,
  };
}

export function mapStudyPlan(b: BackendStudyPlan): StudyPlan {
  const lp = extractLearningProcess(b.learningProcess);
  return {
    id: b._id,
    learningProcessId: extractLpId(b.learningProcess),
    title: lp.title,
    directionTitle: lp.directionTitle,
    directionId: lp.directionId,
    academicYear: lp.academicYear,
    status: b.status ?? 'new',
    createdAt: b.createdAt,
    active: b.active ?? false,
  };
}
