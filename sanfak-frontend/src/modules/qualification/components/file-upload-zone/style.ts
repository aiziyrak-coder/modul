import styled from 'styled-components';

export const Zone = styled.label<{ $drag: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 150px;
  padding: 24px;
  border: 1.5px dashed
    ${({ $drag }) => ($drag ? 'var(--brand-primary, #37cb94)' : 'var(--color-border, #e3e8ef)')};
  border-radius: var(--radius-md, 8px);
  background: var(--color-bg-container, #fff);
  cursor: pointer;
  text-align: center;
  transition:
    border-color 0.15s,
    background 0.15s;

  &:hover {
    border-color: var(--brand-primary, #37cb94);
  }
`;

export const Icon = styled.div`
  font-size: 30px;
  line-height: 1;
  color: var(--color-text-soft, #697586);
`;

export const MainText = styled.span`
  font-size: 14px;
  color: var(--color-text, #121926);
`;

export const Hint = styled.span`
  font-size: 12px;
  color: var(--color-text-mute, #9aa3b2);
`;
