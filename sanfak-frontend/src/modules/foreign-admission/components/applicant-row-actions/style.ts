import styled from 'styled-components';

export const RowActions = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;

  button:has(.anticon-eye),
  button:has(.anticon-rollback) {
    color: var(--color-text, #121926);

    &:hover {
      color: var(--brand-primary);
    }
  }
`;
