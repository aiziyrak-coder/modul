import styled from 'styled-components';

export const Section = styled.section`
  margin-top: 24px;
`;

export const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
`;

export const Hint = styled.p`
  margin: 0 0 10px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

export const Empty = styled.div`
  padding: 20px;
  text-align: center;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
  background: ${({ theme }) => theme.colors.bg};
  border: 1px dashed ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
`;

export const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  min-height: 24px;
`;

export const Chip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 9999px;
  border: 1px solid ${({ theme }) => theme.colors.infoBorder};
  background: ${({ theme }) => theme.colors.infoLight};
  color: ${({ theme }) => theme.colors.info};
`;

export const ChipX = styled.button`
  border: 0;
  background: none;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  font-size: 13px;
  color: inherit;
`;

export const TaskLine = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textMuted};
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 220px;
`;

export const Muted = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
`;
