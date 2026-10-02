import styled from 'styled-components';

export const Panel = styled.div`
  margin-top: var(--space-5);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
`;

export const ActionBar = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-2);

  .ant-btn {
    min-width: 140px;
  }
`;
