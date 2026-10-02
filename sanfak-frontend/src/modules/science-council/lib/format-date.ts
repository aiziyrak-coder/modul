export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const [datePart] = value.split('T');
  return datePart ?? '—';
}
