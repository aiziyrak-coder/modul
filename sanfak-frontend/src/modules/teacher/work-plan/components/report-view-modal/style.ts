import styled from 'styled-components';

export const Wrapper = styled.div`
  padding: var(--space-4) var(--space-5) var(--space-5);
`;

export const MetaRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
  padding-bottom: var(--space-4);
  margin-bottom: var(--space-4);
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

export const TextBlock = styled.div`
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text, #121926);
  white-space: pre-wrap;
`;

export const FileLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-4);
  color: var(--brand-primary);
`;
