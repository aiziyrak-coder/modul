import styled from 'styled-components';

export const ListWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-height: 320px;
  overflow-y: auto;
  padding-right: var(--space-1);
`;

export const Row = styled.button<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  text-align: left;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid
    ${({ $selected }) => ($selected ? 'var(--brand-primary)' : 'var(--color-border)')};
  background: ${({ $selected }) => ($selected ? 'var(--ant-color-success-bg)' : 'transparent')};
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 14px;
  color: var(--color-text);

  &:hover {
    border-color: ${({ $selected }) =>
      $selected ? 'var(--brand-primary)' : 'var(--color-text-mute, #cbd5e1)'};
  }
`;

export const Count = styled.p`
  margin: var(--space-3) 0 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--brand-primary);
`;
