import styled, { css } from 'styled-components';

export const ClampBox = styled.div<{ $clamp?: number }>`
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 14px;
  line-height: 1.5;

  ${({ $clamp }) =>
    $clamp
      ? css`
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: ${$clamp};
          overflow: hidden;
        `
      : ''}
`;
