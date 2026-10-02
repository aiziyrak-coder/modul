import styled from 'styled-components';

export type TileTone = 'default' | 'good' | 'critical';

const TONE_VAR: Record<TileTone, string> = {
  default: 'var(--brand-info)',
  good: 'var(--brand-primary)',
  critical: 'var(--brand-error)',
};

export const Tile = styled.div<{ $tone: TileTone }>`
  flex: 1 1 160px;
  min-width: 160px;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevate);
  border-left: 3px solid ${(p) => TONE_VAR[p.$tone]};
`;

export const TileValue = styled.div`
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
  margin-bottom: 2px;
`;
