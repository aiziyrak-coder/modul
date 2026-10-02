import styled from 'styled-components';

export const Wrapper = styled.div`
  background: #fff;
  padding: var(--space-5, 20px);
`;

export const Title = styled.h3`
  margin: 0;
  color: var(--color-text, #121926);
  font-weight: 600;
  font-size: 20px;
  line-height: 100%;
  letter-spacing: -0.02em;
`;

export const Subtitle = styled.p`
  margin: 12px 0 var(--space-8, 40px);
  font-weight: 500;
  font-size: 14px;
  line-height: 100%;
  color: var(--color-text-soft, #697586);
`;

export const ProgressWrapper = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);

  .progress-right {
    width: calc(100% - 48px);
  }
`;

export const ProgressTop = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
`;

export const Circle = styled.div`
  width: 40px;
  height: 40px;
  border: 2px solid #34c18c;
  border-radius: 50%;
  position: relative;
  flex-shrink: 0;

  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 9px;
    height: 9px;
    background: #34c18c;
    border-radius: 50%;
    transform: translate(-50%, -50%);
  }
`;

export const Percent = styled.span`
  color: #34c18c;
  font-weight: 700;
  font-size: 20px;
  line-height: 100%;
  letter-spacing: -0.02em;
  width: 50px;
`;

export const Text = styled.span`
  font-weight: 500;
  font-size: 12px;
  line-height: 100%;
  color: var(--color-text-soft, #697586);
`;

export const ProgressBar = styled.div`
  margin-top: 4px;
  width: 100%;
  height: 8px;
  background: var(--color-border, #e3e8ef);
  border-radius: 64px;
  overflow: hidden;
`;

export const ProgressFill = styled.div`
  height: 100%;
  background: #34c18c;
  border-radius: 64px;
  transition: width 0.3s ease;
`;

export const NoteRow = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  margin: var(--space-5, 20px) 0;
  padding: var(--space-2, 8px) var(--space-3, 12px);
  background: rgba(239, 104, 32, 0.06);
  border-radius: var(--radius-md, 8px);

  span {
    font-weight: 500;
    font-size: 14px;
    color: #ef6820;
    line-height: 100%;
  }
`;

export const Steps = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

export const StepItem = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;

  .pending {
    height: 24px;
    display: inline-flex;
    animation: pendingSpin 1s linear infinite;
  }

  @keyframes pendingSpin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

export const StepText = styled.span<{ $status: StepStatus }>`
  font-weight: 500;
  font-size: 14px;
  line-height: 100%;
  color: ${({ $status }) =>
    $status === 'done' ? '#34C18C' : $status === 'active' ? '#ef6820' : '#9aa4b2'};
`;

type StepStatus = 'pending' | 'active' | 'done';
