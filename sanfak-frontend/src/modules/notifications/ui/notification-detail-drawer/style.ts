import styled from 'styled-components';

export const DetailHeader = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;
  margin-bottom: var(--space-2);
`;

export const DetailTitle = styled.div`
  margin-bottom: var(--space-2);
  overflow-wrap: anywhere;
`;

export const DetailSection = styled.div`
  margin-top: var(--space-3);
`;

export const DetailTime = styled.div`
  margin-top: var(--space-2);
`;

export const DetailActions = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-top: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
`;
