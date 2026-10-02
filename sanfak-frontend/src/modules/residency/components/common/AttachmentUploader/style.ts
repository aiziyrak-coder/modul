import styled, { css } from 'styled-components';

export const Zone = styled.div<{ $dragging: boolean; $disabled: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 18px 14px;
  border: 1.5px dashed ${({ theme }) => theme.colors.borderDark};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 13px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;

  &:hover,
  &:focus-visible {
    border-color: ${({ theme }) => theme.colors.primary};
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 2px;
  }

  ${({ $dragging, theme }) =>
    $dragging &&
    css`
      border-color: ${theme.colors.primary};
      background: ${theme.colors.primaryLight};
      color: ${theme.colors.primary};
    `}

  ${({ $disabled }) =>
    $disabled &&
    css`
      opacity: 0.55;
      cursor: not-allowed;
      pointer-events: none;
    `}
`;

export const ZoneTitle = styled.span`
  font-weight: 600;
  font-size: 13px;
`;

export const ZoneHint = styled.span`
  font-size: 11.5px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textLight};
`;

export const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
`;

export const Row = styled.li<{ $state: 'idle' | 'error' | 'done' }>`
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 11px;
  border: 1px solid
    ${({ theme, $state }) =>
      $state === 'error' ? theme.colors.dangerBorder : theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme, $state }) =>
    $state === 'error' ? theme.colors.dangerLight : theme.colors.white};
  font-size: 12.5px;
`;

export const Emoji = styled.span`
  flex-shrink: 0;
  font-size: 15px;
  line-height: 1;
`;

export const Info = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

export const Name = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.text};
`;

export const Meta = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

export const ErrorText = styled.span`
  font-size: 11px;
  line-height: 1.4;
  color: ${({ theme }) => theme.colors.danger};
`;

export const Track = styled.div`
  height: 4px;
  border-radius: ${({ theme }) => theme.radius.full};
  background: ${({ theme }) => theme.colors.border};
  overflow: hidden;
`;

export const Bar = styled.div<{ $percent: number }>`
  height: 100%;
  width: ${({ $percent }) => $percent}%;
  border-radius: inherit;
  background: ${({ theme }) => theme.colors.primary};
  transition: width 0.2s linear;
`;

export const IconBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: transparent;
  color: ${({ theme }) => theme.colors.textMuted};
  cursor: pointer;
  transition: background 0.15s, color 0.15s;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.bg};
    color: ${({ theme }) => theme.colors.text};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 1px;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

export const DangerIconBtn = styled(IconBtn)`
  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.dangerLight};
    color: ${({ theme }) => theme.colors.danger};
  }
`;

export const DoneMark = styled.span`
  flex-shrink: 0;
  display: inline-flex;
  color: ${({ theme }) => theme.colors.success};
`;
