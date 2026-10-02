import styled from 'styled-components';

export const WrapperWarning = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  padding: var(--space-3) var(--space-5) var(--space-5);
  padding-top: 12px;

  .confirmation {
    display: flex;
    gap: var(--space-3);

    .title {
      font-weight: 600;
      font-size: 20px;
      line-height: 100%;
      letter-spacing: -0.02em;
      color: var(--color-text, #121926);
    }

    .sub-title {
      margin-top: var(--space-3);
      font-weight: 500;
      font-size: 14px;
      line-height: 150%;
      letter-spacing: -0.02em;
      color: var(--color-text-soft, #697586);
    }

    .pulse {
      width: max-content;
      height: max-content;
      display: inline-flex;
      flex-shrink: 0;
      position: relative;

      &::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        animation: warningPulse 1.8s infinite;
        transform: scale(0.81);
      }
    }

    @keyframes warningPulse {
      0% {
        box-shadow:
          0 0 0 0 rgba(239, 104, 32, 0.5),
          0 0 0 0 rgba(239, 104, 32, 0.3);
      }
      70% {
        box-shadow:
          0 0 0 8px rgba(239, 104, 32, 0),
          0 0 0 16px rgba(239, 104, 32, 0);
      }
      100% {
        box-shadow:
          0 0 0 0 rgba(239, 104, 32, 0),
          0 0 0 0 rgba(239, 104, 32, 0);
      }
    }
  }

`;
