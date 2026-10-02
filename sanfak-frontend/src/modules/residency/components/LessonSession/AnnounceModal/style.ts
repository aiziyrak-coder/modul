import styled from 'styled-components';

export const Missing = styled.div`
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.warning};
`;

export const Preview = styled.div`
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.bg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.text};
`;

export const PreviewHead = styled.div`
  font-weight: 600;
`;

export const PreviewNames = styled.div`
  margin-top: 4px;
  color: ${({ theme }) => theme.colors.textMuted};
  max-height: 96px;
  overflow-y: auto;
`;

export const Summary = styled.dl`
  margin: 0 0 12px;
`;

export const SummaryRow = styled.div`
  display: flex;
  gap: 10px;
  padding: 7px 0;
  font-size: 13px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  &:last-child {
    border-bottom: none;
  }
`;

export const SummaryKey = styled.dt`
  width: 120px;
  flex-shrink: 0;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
`;

export const SummaryVal = styled.dd`
  margin: 0;
  color: ${({ theme }) => theme.colors.text};
`;

export const Warning = styled.div`
  padding: 10px 12px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.warningLight};
  border: 1px solid ${({ theme }) => theme.colors.warningBorder};
  font-size: 12px;
  line-height: 1.55;
  color: ${({ theme }) => theme.colors.text};
`;

export const UngradedNote = styled(Warning)`
  margin-bottom: 8px;
  font-weight: 600;
`;
