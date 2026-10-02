import styled from 'styled-components';

export const BellButton = styled.button`
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ant-color-border);
  border-radius: var(--radius-md);
  background: transparent;
  cursor: pointer;
  font-size: 16px;
  color: var(--ant-color-text-secondary);
  position: relative;
  padding: 0;
  transition: background var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard);

  &:hover {
    background: var(--ant-color-border-secondary);
  }

  &[aria-expanded='true'] {
    background: var(--ant-color-border-secondary);
    border-color: var(--ant-color-text-quaternary);
  }

  &:focus-visible {
    outline: 2px solid var(--ant-color-primary);
    outline-offset: 2px;
  }
`;
