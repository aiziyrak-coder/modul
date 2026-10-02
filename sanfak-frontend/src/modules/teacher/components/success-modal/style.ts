import styled from 'styled-components';

export const SuccessWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-8, 40px);
  padding-top: 20px;

  h2 {
    font-weight: 600;
    font-size: 24px;
    line-height: 120%;
    letter-spacing: -0.02em;
    text-align: center;
    color: var(--color-text, #121926);
    margin: 0;
  }

  p {
    font-weight: 500;
    font-size: 14px;
    line-height: 150%;
    letter-spacing: -0.02em;
    text-align: center;
    color: var(--color-text-soft, #697586);
    margin: 12px 0 0;
  }

  .pulse {
    width: max-content;
    height: max-content;
    display: inline-flex;
    position: relative;
    animation: successPulse 1.8s infinite;
    border-radius: 50%;
  }

  @keyframes successPulse {
    0% {
      box-shadow:
        0 0 0 0 rgba(52, 193, 140, 0.5),
        0 0 0 0 rgba(52, 193, 140, 0.3);
    }
    70% {
      box-shadow:
        0 0 0 20px rgba(52, 193, 140, 0),
        0 0 0 40px rgba(52, 193, 140, 0);
    }
    100% {
      box-shadow:
        0 0 0 0 rgba(52, 193, 140, 0),
        0 0 0 0 rgba(52, 193, 140, 0);
    }
  }
`;
