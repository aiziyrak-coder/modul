import type { WorkingSchedule, WorkingScheduleStatus } from '../model/types';
import { mapApprovalStep, type BackendApprovalStep } from '../../distribution/api/mapper';

export interface BackendWorkingSchedule {
  _id: string;
  title?: string | null;
  direction?:
    | {
        _id: string;
        title?: string | null;
        directionCode?: string | null;
      }
    | string
    | null;
  courseRef?:
    | {
        _id: string;
        title?: string | null;
      }
    | string
    | null;
  academicYear?:
    | {
        _id: string;
        title?: string | null;
      }
    | string
    | null;
  stage?: string | null;
  date?: string | null;
  status?: WorkingScheduleStatus;
  createdAt: string;
  file?: string | null;
  approvalHistory?: BackendApprovalStep[];
  currentStep?: string | null;
}

function extractTitle<T extends { _id: string; title?: string | null }>(
  ref: T | string | null | undefined,
): string | null {
  if (!ref || typeof ref === 'string') return null;
  return ref.title ?? null;
}

export function mapWorkingSchedule(b: BackendWorkingSchedule): WorkingSchedule {
  return {
    id: b._id,
    title: b.title ?? null,
    directionTitle: extractTitle(
      typeof b.direction === 'object' && b.direction !== null
        ? (b.direction as { _id: string; title?: string | null })
        : null,
    ),
    courseTitle: extractTitle(
      typeof b.courseRef === 'object' && b.courseRef !== null
        ? (b.courseRef as { _id: string; title?: string | null })
        : null,
    ),
    academicYearTitle: extractTitle(
      typeof b.academicYear === 'object' && b.academicYear !== null
        ? (b.academicYear as { _id: string; title?: string | null })
        : null,
    ),
    stage: b.stage ?? null,
    date: b.date ?? null,
    status: b.status ?? 'draft',
    createdAt: b.createdAt,
    file: b.file ?? null,
    approvalHistory: b.approvalHistory
      ? b.approvalHistory.map(mapApprovalStep)
      : undefined,
    currentStep: b.currentStep ?? null,
  };
}
