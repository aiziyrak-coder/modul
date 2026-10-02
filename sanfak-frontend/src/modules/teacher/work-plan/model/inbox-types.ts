import type { ApprovalStepKey, PersonalPlan } from './types';

export interface WorkPlanInboxRow {
  id: string;
  entityKey: 'personalWorkPlan';
  title: string | null;
  currentStep: ApprovalStepKey | null;
  currentStepLabel: string | null;
  submittedAt: string | null;
  canAct: boolean;
  academicYearTitle: string | null;
  totalHour: number;
}

export function toInboxRow(plan: PersonalPlan, canAct: boolean): WorkPlanInboxRow {
  return {
    id: plan.id,
    entityKey: 'personalWorkPlan',
    title: plan.teacherName,
    currentStep: plan.currentStep,
    currentStepLabel: plan.currentStepLabel,
    submittedAt: plan.submittedAt,
    canAct,
    academicYearTitle: plan.academicYearTitle,
    totalHour: plan.plannedHour,
  };
}
