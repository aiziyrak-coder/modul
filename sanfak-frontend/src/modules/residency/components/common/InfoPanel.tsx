import styled, { css } from 'styled-components';

export const Panel = styled.section`
  background: ${({ theme }) => theme.colors.white};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.lg};
  box-shadow: ${({ theme }) => theme.shadow.sm};
  padding: 18px 20px;
  margin-bottom: 16px;
`;

export const PanelHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
`;

export const PanelTitle = styled.h2`
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  margin: 0;
`;

export const FactGrid = styled.dl`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 14px 24px;
  margin: 0;
`;

export const Fact = styled.div`
  min-width: 0;
`;

export const FactLabel = styled.dt`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.textMuted};
  margin-bottom: 3px;
`;

export const FactValue = styled.dd`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  overflow-wrap: anywhere;
`;

export type HintTone = 'info' | 'warning' | 'danger' | 'muted';

const toneCss = {
  info: css`
    background: ${({ theme }) => theme.colors.infoLight};
    border-color: ${({ theme }) => theme.colors.infoBorder};
    color: ${({ theme }) => theme.colors.text};
  `,
  warning: css`
    background: ${({ theme }) => theme.colors.warningLight};
    border-color: ${({ theme }) => theme.colors.warningBorder};
    color: ${({ theme }) => theme.colors.text};
  `,
  danger: css`
    background: ${({ theme }) => theme.colors.dangerLight};
    border-color: ${({ theme }) => theme.colors.dangerBorder};
    color: ${({ theme }) => theme.colors.danger};
  `,
  muted: css`
    background: ${({ theme }) => theme.colors.bg};
    border-color: ${({ theme }) => theme.colors.border};
    color: ${({ theme }) => theme.colors.textMuted};
  `,
};

export const PanelHint = styled.p<{ $tone?: HintTone }>`
  margin: 12px 0 0;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.5;
  border: 1px solid transparent;
  border-radius: ${({ theme }) => theme.radius.md};
  ${({ $tone }) => toneCss[$tone ?? 'muted']}
`;

export const PanelActions = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  margin-top: 14px;
`;
