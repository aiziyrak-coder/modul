import styled from 'styled-components';

export const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
`;

export const DocRow = styled.a`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevate);
  text-decoration: none;
  cursor: pointer;

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

export const MoreTrigger = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  color: var(--color-text-soft);
  cursor: pointer;

  &:hover {
    background: var(--color-border);
  }

  &:focus-visible {
    outline: 2px solid var(--brand-primary);
    outline-offset: 1px;
  }
`;

export const UploadRow = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  border: 1px dashed var(--color-border);
  background: var(--color-bg);

  .icon {
    color: var(--color-text-soft);
    font-size: 16px;
    flex-shrink: 0;
  }
`;

export const UploadPlaceholder = styled.button`
  flex: 1;
  text-align: left;
  border: none;
  background: transparent;
  padding: 0;
  font-size: 13px;
  color: var(--color-text-soft);
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  &:focus-visible {
    outline: 2px solid var(--brand-primary);
    outline-offset: 1px;
    border-radius: var(--radius-sm);
  }
`;

export const AddBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-border);
  color: var(--color-text);
  cursor: pointer;

  &:hover {
    background: var(--brand-primary);
    color: #fff;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  &:focus-visible {
    outline: 2px solid var(--brand-primary);
    outline-offset: 1px;
  }
`;

export const EmptyDocs = styled.div`
  padding: var(--space-4);
  text-align: center;
  color: var(--color-text-soft);
  font-size: 13px;
`;
