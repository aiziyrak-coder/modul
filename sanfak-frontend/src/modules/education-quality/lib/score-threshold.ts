export const PERIOD_MIN_SCORE = 25;

export function periodScoreColor(total: number, periodSelected: boolean): string {
  if (!periodSelected) return 'var(--color-text, #121926)';
  return total < PERIOD_MIN_SCORE
    ? 'var(--brand-error, #F04438)'
    : 'var(--brand-primary, #0B843F)';
}
