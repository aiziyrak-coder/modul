import styled from 'styled-components';

export const ParentBar = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  font-size: 14px;
  font-weight: 500;

  .left {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    min-width: 0;
  }

  .toggle {
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 4px;
    display: inline-flex;
    align-items: center;
    color: var(--color-text-soft, #697586);
    font-size: 12px;
  }

  .who {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 250px;
  }

  .stat {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    white-space: nowrap;
  }
  .stat .label {
    color: var(--color-text-soft, #9aa4b2);
  }
  .stat .value {
    color: var(--color-text, #121926);
  }

  .right {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    flex-shrink: 0;
  }
`;

export const WarnBadge = styled.div<{ $tone?: 'under' | 'over' | 'info' }>`
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  height: 38px;
  padding: 0 var(--space-4);
  border-radius: var(--radius-md, 8px);
  white-space: nowrap;

  background: ${({ $tone }) =>
    $tone === 'over' ? '#FEF3F2' : $tone === 'info' ? '#e6f4ff' : '#fef6ee'};
  border: 1px solid
    ${({ $tone }) => ($tone === 'over' ? '#FECDCA' : $tone === 'info' ? '#91caff' : '#f9dbaf')};
  color: ${({ $tone }) => ($tone === 'over' ? '#F04438' : $tone === 'info' ? '#1677ff' : '#ef6820')};

  b {
    margin-left: var(--space-2);
  }
`;
