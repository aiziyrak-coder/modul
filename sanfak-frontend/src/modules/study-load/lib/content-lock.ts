const LOCKED_STATUSES = ['in_review', 'approved'];

export function isContentEditable(status: string | null | undefined): boolean {
  if (!status) return false;
  return !LOCKED_STATUSES.includes(status);
}
