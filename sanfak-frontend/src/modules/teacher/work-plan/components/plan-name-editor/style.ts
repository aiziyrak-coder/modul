import styled from 'styled-components';

export const Row = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg, #fff);
  border: 1px solid var(--color-border, #e3e8ef);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);

  .name-text {
    flex: 1;
    min-width: 0;
    font-weight: 500;
    font-size: 15px;
    color: var(--color-text, #121926);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .name-input {
    flex: 1;
    min-width: 0;
  }

  .name-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }
`;
