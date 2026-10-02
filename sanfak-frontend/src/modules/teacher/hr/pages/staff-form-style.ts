import styled from 'styled-components';

export const FormLabel = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-soft);
  margin-bottom: var(--space-1);

  .required {
    color: var(--brand-error);
    margin-left: 2px;
  }
`;

export const PassportRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);

  > *:first-child {
    flex: 0 0 80px;
  }
  > *:last-child {
    flex: 1;
  }
`;

export const ErrorText = styled.div`
  font-size: 12px;
  color: var(--brand-error);
  margin-top: var(--space-1);
`;
