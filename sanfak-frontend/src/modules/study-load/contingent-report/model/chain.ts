export const REPORT_STEP_ROLES: Record<string, string> = {
  dean: 'dekan',
};

export const REPORT_SUBMITTER_ROLES = ['dekan', 'fakultet_kengash_kotibi'] as const;

export const REPORT_EDITABLE_STATUSES = ['draft', 'rejected'] as const;

export const FACULTY_LEVEL_ROLES = ['dekan', 'fakultet_kengash_kotibi'] as const;

export interface ReportTurn {
  canSubmit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canReopen: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export function reportTurn(
  status: string,
  currentStep: string | null,
  role: string | undefined,
  isSuper: boolean,
): ReportTurn {
  const isSubmitter = isSuper || (REPORT_SUBMITTER_ROLES as readonly string[]).includes(role ?? '');
  const editable = (REPORT_EDITABLE_STATUSES as readonly string[]).includes(status);
  const isChainTurn =
    status === 'in_review' &&
    Boolean(currentStep) &&
    (isSuper || role === REPORT_STEP_ROLES[currentStep as string]);
  return {
    canSubmit: status === 'draft' && isSubmitter,
    canApprove: isChainTurn,
    canReject: isChainTurn,
    canReopen: status === 'rejected' && isSubmitter,
    canEdit: editable && isSubmitter,
    canDelete: editable,
  };
}

export function canSeeInstituteSummary(role: string | undefined, isSuper: boolean): boolean {
  if (isSuper) return true;
  return !(FACULTY_LEVEL_ROLES as readonly string[]).includes(role ?? '');
}
