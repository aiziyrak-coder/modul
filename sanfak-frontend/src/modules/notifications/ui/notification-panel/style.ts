import styled from 'styled-components';

export const Panel = styled.div`
  width: 410px;
  max-width: calc(100vw - 32px);
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  padding: var(--space-2);
  background: var(--ant-color-bg-elevated);
  border-radius: var(--radius-lg);
`;

export const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 0 var(--space-2) var(--space-2);
`;

export const Title = styled.h2`
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  line-height: 24px;
  letter-spacing: -0.2px;
  color: var(--ant-color-text);
  outline: none;
`;

export const List = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--space-2) 0 var(--space-6) 0;
`;

export const StateWrap = styled.div`
  min-height: 180px;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

export const OfflineWrap = styled.div`
  padding: 0 var(--space-2);
`;

export const Footer = styled.div`
  padding: 0 var(--space-2) var(--space-2);
  flex-shrink: 0;
`;
