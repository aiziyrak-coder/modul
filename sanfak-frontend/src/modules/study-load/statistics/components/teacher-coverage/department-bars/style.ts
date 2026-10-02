import styled from 'styled-components';

export type BarTone = 'critical' | 'good';

const TONE_VAR: Record<BarTone, string> = {
  critical: 'var(--brand-error)',
  good: 'var(--brand-primary)',
};

export const Title = styled.h4`
  margin: 0 0 var(--space-3);
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
`;

export const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
`;

export const Row = styled.div`
  display: grid;
  grid-template-columns: minmax(160px, 2fr) minmax(0, 3fr) 48px;
  grid-template-areas: 'name bar value';
  align-items: center;
  column-gap: var(--space-3);
  row-gap: var(--space-1);
  padding: 2px 0;

  @media (max-width: 640px) {
    grid-template-columns: minmax(0, 1fr) 48px;
    grid-template-areas:
      'name value'
      'bar bar';
  }
`;

export const Name = styled.span`
  grid-area: name;
  font-size: 12.5px;
  line-height: 1.3;
  color: var(--color-text);
  overflow-wrap: anywhere;
`;

export const Track = styled.span`
  grid-area: bar;
  display: block;
  height: 8px;
  border-radius: 4px;
  background: var(--color-bg-elevate);
  overflow: hidden;
`;

export const Bar = styled.span<{ $tone: BarTone }>`
  display: block;
  height: 100%;
  border-radius: 4px;
  background: ${(p) => TONE_VAR[p.$tone]};
  transition: width 0.2s ease;
`;

export const Value = styled.span`
  grid-area: value;
  font-size: 12.5px;
  font-weight: 600;
  text-align: right;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

export const Empty = styled.div`
  font-size: 12.5px;
  color: var(--color-text-soft);
`;
