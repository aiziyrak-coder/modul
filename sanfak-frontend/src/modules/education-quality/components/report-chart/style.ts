import styled from 'styled-components';

export const ChartCard = styled.div`
  background: var(--color-bg-container, #fff);
  border: 1px solid var(--color-border, #f0f0f0);
  border-radius: var(--radius-lg, 12px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  padding: 18px 20px;
  margin-bottom: var(--space-4, 16px);

  .recharts-wrapper,
  .recharts-surface,
  .recharts-wrapper *:focus,
  .recharts-wrapper *:focus-visible {
    outline: none;
  }

  .chart-title {
    font-weight: 700;
    font-size: 15px;
    margin-bottom: 14px;
  }
`;

export const Medal = styled.span<{ $rank: number }>`
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-weight: 700;
  font-size: 13px;
  color: ${({ $rank }) => ($rank > 3 ? 'var(--color-text-secondary, #475467)' : '#fff')};
  background: ${({ $rank }) =>
    $rank === 1
      ? '#F79009'
      : $rank === 2
        ? '#98A2B3'
        : $rank === 3
          ? '#B54708'
          : 'var(--color-fill-quaternary, #EAECF0)'};
`;

export const TableCard = styled.div`
  background: var(--color-bg-container, #fff);
  border: 1px solid var(--color-border, #f0f0f0);
  border-radius: var(--radius-lg, 12px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  padding: var(--space-4, 16px);
`;
