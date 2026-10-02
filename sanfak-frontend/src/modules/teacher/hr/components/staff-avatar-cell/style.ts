import styled from 'styled-components';

export const Wrap = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
`;

export const AvatarCircle = styled.div<{ $src?: string | null }>`
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: ${({ $src }) => ($src ? `url(${$src}) center/cover no-repeat` : 'var(--color-bg-elevate)')};
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-soft);
  font-size: 13px;
  font-weight: 600;
`;

export const TextCol = styled.div`
  min-width: 0;
`;

export const Name = styled.div`
  font-weight: 600;
  font-size: 14px;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const Email = styled.div`
  font-size: 12px;
  color: var(--color-text-soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
