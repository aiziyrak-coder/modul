import styled from 'styled-components';

export const Banner = styled.div`
  background: ${({ theme }) => theme.colors.white};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.lg};
  padding: 16px 20px;
  margin-bottom: 16px;
`;

export const BannerHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
`;

export const BannerTitle = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
`;

export const Meta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
`;

export const MetaItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

export const MetaLabel = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

export const MetaValue = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

export const CancelledNote = styled.div`
  margin-top: 12px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

export const InfoNote = styled.div`
  margin-bottom: 16px;
  padding: 10px 14px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.infoLight};
  border: 1px solid ${({ theme }) => theme.colors.infoBorder};
  font-size: 12px;
  line-height: 1.55;
  color: ${({ theme }) => theme.colors.text};
`;

export const Toolbar = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
`;

export const DirtyNote = styled.span<{ $error?: boolean }>`
  font-size: 12px;
  color: ${({ theme, $error }) => ($error ? theme.colors.danger : theme.colors.textMuted)};
`;

export const CellError = styled.div`
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.4;
  color: ${({ theme }) => theme.colors.danger};
`;

export const DraftConflict = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-1) var(--space-2);
  margin-top: var(--space-1);
  font-size: 11px;
  line-height: 1.4;
  color: ${({ theme }) => theme.colors.textMuted};
`;

export const LinkBtn = styled.button`
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: ${({ theme }) => theme.colors.primary};
  text-decoration: underline;
  cursor: pointer;

  &:disabled {
    color: ${({ theme }) => theme.colors.textMuted};
    cursor: not-allowed;
  }
`;

export const Muted = styled.div`
  margin-top: 2px;
  font-size: 11px;
  line-height: 1.4;
  color: ${({ theme }) => theme.colors.textMuted};
`;

export const NotFound = styled.div`
  padding: 28px;
  text-align: center;
  font-size: 13px;
  border-radius: ${({ theme }) => theme.radius.lg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.white};
  color: ${({ theme }) => theme.colors.textMuted};
`;
