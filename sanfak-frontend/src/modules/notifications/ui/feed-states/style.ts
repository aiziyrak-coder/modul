import styled from 'styled-components';

export const SkeletonWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
`;

export const SkeletonRow = styled.div`
  padding: var(--space-2) var(--space-3);
`;

export const EmptyWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  padding: var(--space-8) var(--space-4);
  text-align: center;
`;

export const EmptyIconWrap = styled.div<{ $color: string; $bg: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  margin-bottom: var(--space-2);
  color: ${({ $color }) => $color};
  background: ${({ $bg }) => $bg};
`;
