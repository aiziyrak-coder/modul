import styled from 'styled-components';

export const FieldRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 140px 110px 36px;
  gap: var(--space-2, 8px);
  align-items: start;
  margin-bottom: var(--space-2, 8px);
`;

export const DrawerFooter = styled.div`
  display: flex;
  gap: var(--space-3, 12px);

  button {
    flex: 1;
    height: 44px;
    font-weight: 600;
  }
`;
