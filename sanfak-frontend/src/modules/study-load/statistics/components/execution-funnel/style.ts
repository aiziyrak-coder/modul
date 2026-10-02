import styled from 'styled-components';

export const SectionTitle = styled.div`
  font-size: 10.5px;
  font-weight: 700;
  color: var(--color-text-soft);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--space-2);
`;

export const Row = styled.div`
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr) 64px;
  align-items: center;
  gap: var(--space-2);
  padding: 3px 0;
`;

export const Label = styled.span`
  font-size: 12.5px;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const Track = styled.span`
  height: 8px;
  border-radius: var(--radius-sm);
  background: var(--color-bg-elevate);
  display: block;
  position: relative;
`;

export const Fill = styled.span<{ $percent: number; $tone: 'soft' | 'solid' }>`
  position: absolute;
  inset: 0;
  width: ${(p) => p.$percent}%;
  border-radius: var(--radius-sm);
  background: var(--brand-info);
  opacity: ${(p) => (p.$tone === 'soft' ? 0.35 : 1)};
  transition: width 0.15s ease;
`;

export const Count = styled.span`
  font-size: 11px;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
  text-align: right;

  b {
    font-weight: 700;
  }
  span {
    color: var(--color-text-soft);
  }
`;
