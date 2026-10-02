export const SUMMARY_STEP_ROLES: Record<string, string> = {
  methodical: 'oquv_uslubiy_boshqarma',
  financial: 'reja_moliya',
  prorektor: 'prorektor',
  rektor: 'rektor',
};

export const SUMMARY_SUBMIT_ROLE = 'oquv_uslubiy_boshqarma';

export const SUMMARY_LOCKED_STATUSES = ['approved', 'superseded'] as const;

export interface SummaryTurn {
  canSubmit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canReopen: boolean;
  canDelete: boolean;
}

export function summaryTurn(
  status: string,
  currentStep: string | null,
  role: string | undefined,
  isSuper: boolean,
): SummaryTurn {
  const isSubmitRole = isSuper || role === SUMMARY_SUBMIT_ROLE;
  const isChainTurn =
    status === 'in_review' &&
    Boolean(currentStep) &&
    (isSuper || role === SUMMARY_STEP_ROLES[currentStep as string]);
  return {
    canSubmit: status === 'draft' && isSubmitRole,
    canApprove: isChainTurn,
    canReject: isChainTurn,
    canReopen: status === 'rejected' && isSubmitRole,
    canDelete: status === 'draft' || status === 'rejected',
  };
}
