import styled from 'styled-components';

export const Panel = styled.div`
  .ant-tabs-tab + .ant-tabs-tab {
    margin-left: var(--space-3);
  }
`;

export const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
`;

export const DocRow = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: none;
  border-radius: var(--radius-md);
  background: var(--color-bg-elevate);
  text-decoration: none;
  text-align: left;
  font: inherit;
  color: inherit;
  cursor: default;

  &[type='button'] {
    cursor: pointer;
  }

  &[type='button']:hover {
    background: var(--color-border);
  }

  &[type='button']:focus-visible {
    outline: 2px solid var(--brand-primary);
    outline-offset: 1px;
  }

  .icon {
    color: var(--color-text-soft);
    font-size: 16px;
    flex-shrink: 0;
  }

  .name {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text);
    word-break: break-word;
  }
`;

export const EmptyDocs = styled.div`
  padding: var(--space-4);
  text-align: center;
  color: var(--color-text-soft);
  font-size: 13px;
`;
