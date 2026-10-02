import styled from 'styled-components';
import { HelperText } from '../common/FormElements';

export const Badges = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-weight: 400;
`;

export const Sub = styled.div`
  margin-top: 4px;
  font-size: 12px;
  font-weight: 400;
  color: ${({ theme }) => theme.colors.textMuted};
`;

export const Muted = styled.p`
  margin: 0 0 16px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

export const Footer = styled.p`
  margin: 12px 0 0;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

export const CompactNote = styled(HelperText)`
  margin: 0 0 12px;
`;
