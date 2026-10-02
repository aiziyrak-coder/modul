import { createGlobalStyle } from 'styled-components';

export const GlobalStyles = createGlobalStyle`
  .residency-root *,
  .residency-root *::before,
  .residency-root *::after {
    box-sizing: border-box;
  }

  .residency-root {
    font-family: ${({ theme }) => theme.fonts.main};
    color: ${({ theme }) => theme.colors.text};
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  :where(.residency-root button) {
    cursor: pointer;
    font-family: inherit;
    border: none;
    background: none;
  }
  :where(.residency-root input),
  :where(.residency-root textarea),
  :where(.residency-root select) {
    font-family: inherit;
  }
`;
