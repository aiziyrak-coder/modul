export const WORKLOAD_CONTENT_EDITABLE_STATUSES: readonly string[] = [
  'draft',
  'new',
];

export function isWorkloadContentEditable(status: string | null | undefined): boolean {
  if (!status) return false;
  return WORKLOAD_CONTENT_EDITABLE_STATUSES.includes(status);
}

export function canReopenWorkload(
  status: string | null | undefined,
  hasSubmitRole: boolean,
): boolean {
  return status === 'rejected' && hasSubmitRole;
}
