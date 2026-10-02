import styled from 'styled-components';

export const InfoBox = styled.div`
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  background: var(--color-bg-elevate, #f5f7fb);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);

  .icon {
    color: var(--color-text-soft);
    font-size: 15px;
    margin-top: 2px;
    flex-shrink: 0;
  }

  .label {
    font-size: 12px;
    color: var(--color-text-soft);
    margin-bottom: 2px;
  }

  .value {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text);
  }
`;
