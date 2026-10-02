import styled from 'styled-components';

export const SuggestionList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0 0 var(--space-4) 0;
`;

export const SuggestionItem = styled.li<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md, 8px);
  border: 1.5px solid
    ${({ $selected }) =>
      $selected ? 'var(--brand-primary, #37CB94)' : 'var(--color-border, #e3e8ef)'};
  background: ${({ $selected }) =>
    $selected ? 'rgba(55, 203, 148, 0.06)' : 'transparent'};
  cursor: pointer;
  margin-bottom: var(--space-2);
  transition: border-color 0.15s, background 0.15s;

  &:hover {
    border-color: var(--brand-primary, #37CB94);
  }
`;
