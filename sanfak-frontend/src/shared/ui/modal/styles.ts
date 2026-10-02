import styled, { keyframes, css } from 'styled-components';

const modalEnter = keyframes`
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
`;
const modalLeave = keyframes`
  from { opacity: 1; transform: translateY(0) scale(1); }
  to   { opacity: 0; transform: translateY(4px) scale(0.98); }
`;
const drawerEnter = keyframes`
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
`;
const drawerLeave = keyframes`
  from { transform: translateX(0); }
  to   { transform: translateX(100%); }
`;

export const Overlay = styled.div<{ $show: boolean }>`
  position: fixed;
  inset: 0;
  display: flex;
  opacity: ${({ $show }) => ($show ? 1 : 0)};
  visibility: ${({ $show }) => ($show ? 'visible' : 'hidden')};
  pointer-events: ${({ $show }) => ($show ? 'auto' : 'none')};
  transition:
    opacity var(--dur-base) var(--ease-standard),
    visibility 0s linear ${({ $show }) => ($show ? '0s' : 'var(--dur-fast)')};
  background: rgba(8, 10, 66, 0.5);
  align-items: center;
  justify-content: center;
  z-index: 1000;
  box-sizing: border-box;

  @media (max-width: 768px) {
    padding: 20px 0;
  }
`;

export const DrawerOverlay = styled(Overlay)`
  justify-content: flex-end;
`;

export const Content = styled.div<{
  $maxWidth?: string;
  $animating: boolean;
  $right?: boolean;
}>`
  background: var(--color-bg, #fff);
  border-radius: ${({ $right }) => ($right ? 0 : '16px')};
  box-shadow: -4px 1px 22px -6px rgba(0, 0, 0, 0.36);
  overflow: hidden;
  max-width: ${({ $maxWidth }) => $maxWidth ?? 'unset'};
  width: ${({ $maxWidth }) => ($maxWidth ? '-webkit-fill-available' : 'unset')};
  max-height: ${({ $right }) => ($right ? '100%' : '90%')};
  margin: ${({ $right }) => ($right ? 0 : '0 0.8rem')};

  ${({ $animating, $right }) =>
    $right
      ? css`
          animation: ${$animating ? drawerEnter : drawerLeave}
            ${$animating ? 'var(--dur-base) var(--ease-decelerate)' : 'var(--dur-fast) var(--ease-accelerate)'}
            forwards;
        `
      : css`
          animation: ${$animating ? modalEnter : modalLeave}
            ${$animating ? 'var(--dur-base) var(--ease-decelerate)' : 'var(--dur-fast) var(--ease-accelerate)'}
            forwards;
        `}


  .ant-btn-link:not(.ant-btn-dangerous) {
    background: var(--color-border);
    color: var(--color-text);
    border: none;
    border-radius: var(--radius-btn);
    height: 44px;
    font-weight: 500;

    &:hover,
    &:focus-visible {
      background: var(--color-border-strong) !important;
      color: var(--color-text) !important;
    }

    &:focus-visible {
      outline: 2px solid var(--brand-primary);
      outline-offset: 2px;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  @media (max-width: 768px) {
    max-width: 90vw;
  }
`;

const FOOTER_PAD: Record<'dialog' | 'form' | 'none', string> = {
  dialog: '60px',
  form: 'var(--space-6)',
  none: '0',
};

export const FooterActions = styled.div<{
  $spacing: 'dialog' | 'form' | 'none';
  $count: number;
}>`
  width: 100%;
  padding-top: ${({ $spacing }) => FOOTER_PAD[$spacing]};
  display: grid;
  grid-template-columns: ${({ $count }) => `repeat(${$count}, 1fr)`};
  gap: var(--space-3);

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

export const Header = styled.div`
  border-radius: 8px 8px 0 0;
  background: var(--color-bg, #fff);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--color-border, #e3e8ef);
`;

export const Title = styled.span`
  font-family: Inter, sans-serif;
  font-weight: 600;
  font-size: 20px;
  line-height: 1;
  color: var(--color-text, #121926);
`;

export const CloseBtn = styled.button<{ $right?: boolean }>`
  padding: 0;
  margin: 0;
  width: ${({ $right }) => ($right ? '40px' : '20px')};
  height: ${({ $right }) => ($right ? '40px' : '20px')};
  display: grid;
  place-items: center;
  border: none;
  border-radius: ${({ $right }) => ($right ? '50%' : '4px')};
  background: ${({ $right }) => ($right ? 'var(--color-border-soft, #eef2f6)' : 'transparent')};
  cursor: pointer;
  transition: background 0.2s;
  color: var(--color-text-soft, #697586);
  font-size: ${({ $right }) => ($right ? '16px' : '14px')};

  &:hover { background: var(--color-border-soft, #eef2f6); }
  &:focus { outline: none; }
`;

export const Body = styled.div<{
  $maxHeight?: string;
  $right?: boolean;
  $overflow?: boolean;
  $bodyPadding?: string;
}>`
  position: relative;
  max-height: ${({ $right, $maxHeight }) => (!$right && $maxHeight ? $maxHeight : undefined)};
  overflow: ${({ $overflow }) => ($overflow ? 'unset' : 'hidden auto')};
  padding: ${({ $bodyPadding }) => $bodyPadding ?? '20px'};
  height: ${({ $right }) => ($right ? 'calc(100vh - 81px)' : undefined)};
  box-sizing: ${({ $right }) => ($right ? 'border-box' : undefined)};

  &::-webkit-scrollbar-track { margin-bottom: 10px; }
`;
