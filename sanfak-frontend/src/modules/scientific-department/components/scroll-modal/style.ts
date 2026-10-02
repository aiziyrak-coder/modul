import styled from 'styled-components';

export const ScrollArea = styled.div`
  max-height: 72vh;
  overflow-y: auto;
  overflow-x: hidden;

  scrollbar-width: thin;
  scrollbar-color: var(--color-border, #e3e8ef) transparent;

  &::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--color-border, #e3e8ef);
    border-radius: 8px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: var(--color-text-mute, #9aa4b2);
    background-clip: padding-box;
  }
`;
