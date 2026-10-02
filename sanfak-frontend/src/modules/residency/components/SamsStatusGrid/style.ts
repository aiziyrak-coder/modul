import styled, { css, type DefaultTheme } from 'styled-components';
import type { SamsCellTone } from '../../lib/sams-cell-state';

type Colors = DefaultTheme['colors'];

function toneColors(tone: SamsCellTone, c: Colors): [string, string, string] {
  switch (tone) {
    case 'success':
      return [c.successLight, c.successBorder, c.success];
    case 'warning':
      return [c.warningLight, c.warningBorder, c.warning];
    case 'danger':
      return [c.dangerLight, c.dangerBorder, c.danger];
    case 'info':
      return [c.infoLight, c.infoBorder, c.info];
    case 'muted':
      return [c.bg, c.border, c.textMuted];
    case 'outage':
      return [c.bg, c.borderDark, c.secondary];
    case 'neutral':
      return [c.white, c.borderDark, c.text];
    default:
      return [c.white, c.border, c.textLight];
  }
}

const cellLook = css<{ $tone: SamsCellTone }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 28px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  ${({ $tone, theme }) => {
    const [bg, border, color] = toneColors($tone, theme.colors);
    return css`
      background: ${bg};
      border: 1px ${$tone === 'outage' ? 'dashed' : 'solid'} ${border};
      color: ${color};
    `;
  }}
  ${({ $tone, theme }) =>
    $tone === 'outage' &&
    css`
      background-image: repeating-linear-gradient(
        135deg,
        ${theme.colors.bg} 0 4px,
        ${theme.colors.white} 4px 8px
      );
    `}
`;

export const CellBox = styled.span<{ $tone: SamsCellTone }>`
  ${cellLook}
`;

export const CellButton = styled.button<{ $tone: SamsCellTone }>`
  ${cellLook}
  cursor: pointer;
  padding: 0;
  transition: box-shadow 0.15s;
  &:hover,
  &:focus-visible {
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.primary};
    outline: none;
  }
`;

export const GridTable = styled.table`
  border-collapse: separate;
  border-spacing: 0;
  min-width: 100%;
`;

export const StickyTh = styled.th`
  position: sticky;
  left: 0;
  z-index: 2;
  min-width: 200px;
  max-width: 240px;
  padding: 8px 12px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textMuted};
  background: ${({ theme }) => theme.colors.bg};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

export const DayTh = styled.th<{ $today?: boolean; $muted?: boolean }>`
  padding: 6px 2px;
  min-width: 50px;
  text-align: center;
  font-size: 11px;
  font-weight: ${({ $today }) => ($today ? 700 : 500)};
  white-space: nowrap;
  color: ${({ theme, $today, $muted }) =>
    $today ? theme.colors.primary : $muted ? theme.colors.textLight : theme.colors.textMuted};
  background: ${({ theme, $today }) => ($today ? theme.colors.primaryLight : theme.colors.bg)};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

export const Weekday = styled.div`
  font-size: 10px;
  font-weight: 400;
`;

export const StickyTd = styled.td`
  position: sticky;
  left: 0;
  z-index: 1;
  min-width: 200px;
  max-width: 240px;
  padding: 6px 12px;
  font-size: 13px;
  background: ${({ theme }) => theme.colors.white};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  border-right: 1px solid ${({ theme }) => theme.colors.border};
`;

export const ClinicTitle = styled.div`
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const ClinicSub = styled.div<{ $warn?: boolean }>`
  font-size: 11px;
  color: ${({ theme, $warn }) => ($warn ? theme.colors.danger : theme.colors.textMuted)};
`;

export const DayTd = styled.td<{ $today?: boolean }>`
  padding: 4px 2px;
  text-align: center;
  background: ${({ theme, $today }) => ($today ? theme.colors.primaryLight : 'transparent')};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

export const Legend = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-top: 14px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

export const LegendItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

export const Note = styled.p`
  margin: 10px 0 0;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

export const TipLine = styled.div`
  white-space: nowrap;
`;
