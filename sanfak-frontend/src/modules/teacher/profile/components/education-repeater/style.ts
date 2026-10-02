import styled from 'styled-components';

export const EducationCard = styled.div<{ $editing?: boolean }>`
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: ${({ $editing }) => ($editing ? 'var(--color-bg)' : 'var(--color-bg-elevate)')};
`;

export const EducationDeleteBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--space-7);
  height: var(--space-7);
  border: none;
  background: transparent;
  color: var(--brand-error);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background 0.15s ease;

  &:hover {
    background: var(--brand-primary-soft, var(--color-bg-elevate));
    color: var(--brand-error);
  }

  &:focus-visible {
    outline: 2px solid var(--brand-primary);
    outline-offset: 2px;
  }
`;
