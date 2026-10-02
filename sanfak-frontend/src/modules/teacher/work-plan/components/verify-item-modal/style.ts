import styled from 'styled-components';

export const Wrapper = styled.div`
  padding: var(--space-4) var(--space-5) var(--space-5);
`;

export const TitleRow = styled.div`
  padding-bottom: var(--space-3);
  margin-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border, #e3e8ef);

  .label {
    font-size: 12px;
    color: var(--color-text-soft, #6b7280);
    margin-bottom: 4px;
  }

  .value {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text, #121926);
  }
`;

export const MetaRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4) var(--space-5);
  margin-bottom: var(--space-2);

  .label {
    font-size: 12px;
    color: var(--color-text-soft, #6b7280);
    margin-bottom: 4px;
  }

  .value {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text, #121926);

    a {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      color: var(--brand-primary);
      font-weight: 500;
    }
  }
`;
