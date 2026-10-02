import styled from 'styled-components';

export const Summary = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.bg};
`;

export const Percent = styled.div`
  flex-shrink: 0;
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
  color: ${({ theme }) => theme.colors.primary};
`;

export const SummaryBody = styled.div`
  flex: 1;
  min-width: 0;
`;

export const Counts = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin-bottom: 8px;
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.textMuted};

  b {
    color: ${({ theme }) => theme.colors.text};
  }
`;

export const Track = styled.div`
  height: 6px;
  border-radius: ${({ theme }) => theme.radius.full};
  background: ${({ theme }) => theme.colors.border};
  overflow: hidden;
`;

export const Bar = styled.div<{ $percent: number }>`
  height: 100%;
  width: ${({ $percent }) => $percent}%;
  border-radius: inherit;
  background: ${({ theme }) => theme.colors.primary};
  transition: width 0.25s ease;
`;

export const Section = styled.div`
  margin-top: 16px;
`;

export const SectionTitle = styled.div<{ $tone: 'read' | 'unread' }>`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 12.5px;
  font-weight: 600;
  color: ${({ theme, $tone }) =>
    $tone === 'read' ? theme.colors.success : theme.colors.warning};
`;

export const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  max-height: 190px;
  overflow-y: auto;
  list-style: none;
`;

export const Row = styled.li`
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.white};
  font-size: 12.5px;
`;

export const Name = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.text};
`;

export const Meta = styled.span`
  flex-shrink: 0;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

export const Empty = styled.div`
  padding: 10px 0;
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.textLight};
`;

export const State = styled.div`
  padding: 28px 0;
  text-align: center;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
`;
