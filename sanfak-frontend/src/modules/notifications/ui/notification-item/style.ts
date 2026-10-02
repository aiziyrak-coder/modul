import styled from 'styled-components';

export const Row = styled.div<{ $unread: boolean; $unreadBg: string; $hoverBg: string }>`
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  background: ${({ $unread, $unreadBg }) => ($unread ? $unreadBg : 'transparent')};
  transition: background var(--dur-fast) var(--ease-standard);

  &:hover {
    background: ${({ $unread, $unreadBg, $hoverBg }) => ($unread ? $unreadBg : $hoverBg)};
  }

  &:focus-visible {
    outline: 2px solid var(--ant-color-primary);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

export const IconAvatar = styled.div<{ $size: number; $square?: boolean; $color: string; $bg: string }>`
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: ${({ $square }) => ($square ? 'var(--radius-md)' : '50%')};
  font-size: 18px;
  color: ${({ $color }) => $color};
  background: ${({ $bg }) => $bg};
`;

export const Content = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

export const ChipRow = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;

  &:empty {
    display: none;
  }
`;

export const TitleClamp = styled.div<{ $clamp?: number }>`
  overflow-wrap: anywhere;
  ${({ $clamp }) =>
    $clamp
      ? `display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: ${$clamp}; overflow: hidden;`
      : ''}
`;

export const SideCol = styled.div`
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-1);
  white-space: nowrap;
`;

export const Hint = styled.div`
  margin-top: 2px;
`;

export const ActionsRow = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-top: 2px;
`;
