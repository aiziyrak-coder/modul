import styled, { keyframes } from 'styled-components';

const ONEID = '#3e13be';
const ONEID_HOVER = '#5127cf';

const fade = keyframes`
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

export const AuthWrapper = styled.div`
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-elevate, #f5f7fb);
  position: relative;
  box-sizing: border-box;
  padding: 24px;

  .logo-section {
    position: absolute;
    left: 40px;
    top: 40px;
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 280px;

    @media (max-width: 560px) {
      left: 20px;
      top: 20px;
    }

    img {
      width: 44px;
      height: 44px;
      object-fit: contain;
    }

    h2 {
      font-family: Inter, sans-serif;
      font-weight: 600;
      font-size: 15px;
      line-height: 20px;
      letter-spacing: -0.03em;
      color: var(--color-text, #121926);
      margin: 0;
    }
  }

  .login-card {
    width: 100%;
    max-width: 351px;
  }

  .login-card-title {
    font-family: Inter, sans-serif;
    font-weight: 500;
    font-size: 32px;
    line-height: 1;
    letter-spacing: -0.03em;
    color: var(--color-text, #121926);
    margin-bottom: 40px;
  }

  .login-tabs {
    display: flex;
    align-items: flex-end;
    gap: 0;
    position: relative;
    z-index: 2;
  }
  .tab {
    min-width: 82px;
    height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 0 14px;
    border: none;
    cursor: pointer;
    font-family: Inter, sans-serif;
    font-weight: 700;
    font-size: 15px;
    border-radius: 12px 12px 0 0;
    background: ${ONEID};
    color: #fff;
    transition:
      background 0.2s ease,
      color 0.2s ease,
      height 0.2s ease;
  }
  .tab-login {
    font-weight: 600;
  }
  .tab.is-active {
    height: 40px;
    background: #fff;
    color: var(--color-text, #121926);
  }
  .tab-oneid .id-badge {
    background: #fff;
    color: ${ONEID};
    border-radius: 6px;
    padding: 2px 6px;
    font-size: 13px;
    font-weight: 800;
    line-height: 1;
    transition:
      background 0.2s ease,
      color 0.2s ease;
  }
  .tab-oneid.is-active .id-badge {
    background: ${ONEID};
    color: #fff;
  }

  .login-card-bg {
    margin-top: 0;
    min-height: 304px;
    padding: 24px;
    background: #fff;
    border-radius: 0 16px 16px 16px;
    box-shadow: 0 8px 64px 0 rgba(0, 0, 0, 0.06);
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;

    .tab-pane {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;
      animation: ${fade} 0.25s ease;
    }

    .card-bg-title {
      font-family: Inter, sans-serif;
      font-weight: 600;
      font-size: 18px;
      line-height: 1.2;
      letter-spacing: -0.02em;
      color: var(--color-text, #121926);
    }

    .card-bg-desc {
      font-family: Inter, sans-serif;
      font-weight: 500;
      font-size: 15px;
      line-height: 1.6;
      letter-spacing: -0.02em;
      color: var(--color-text-soft, #697586);
    }

    .login-btn {
      height: 48px;
      margin-top: auto;
      border: none;
      border-radius: 12px;
      background: ${ONEID};
      color: #fff;
      font-family: Inter, sans-serif;
      font-weight: 600;
      font-size: 16px;
      cursor: pointer;
      transition: background 0.15s;

      &:hover:not(:disabled),
      &:focus-visible:not(:disabled) {
        background: ${ONEID_HOVER};
      }
      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }
  }
`;
