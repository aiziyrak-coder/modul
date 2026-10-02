import styled from 'styled-components';

export const Gap = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  min-width: 20px;
  height: 32px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
  user-select: none;
`;
