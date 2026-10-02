import styled from 'styled-components';

export const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px 20px;
  align-items: center;
  margin-bottom: 18px;
`;

export const Muted = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

export const Section = styled.section`
  margin-bottom: 24px;
`;

export const SectionHead = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
`;

export const SectionTitle = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

export const SectionText = styled.p`
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textMuted};
`;

export const Empty = styled.div<{ $muted?: boolean }>`
  padding: 10px 14px;
  font-size: 13px;
  border-radius: ${({ theme }) => theme.radius.md};
  border: 1px ${({ $muted }) => ($muted ? 'dashed' : 'solid')} ${({ theme }) => theme.colors.border};
  color: ${({ theme, $muted }) => ($muted ? theme.colors.textMuted : theme.colors.success)};
  background: ${({ theme }) => theme.colors.white};
`;

export const GroupTd = styled.td`
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.secondary};
  background: ${({ theme }) => theme.colors.bg};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

export const NewMark = styled.span`
  margin-left: 8px;
`;

export const ChangeList = styled.ul`
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.text};
  li + li {
    margin-top: 8px;
  }
`;

export const ChangeSub = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
`;
