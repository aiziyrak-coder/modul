import { useEffect, useMemo, useRef, useState } from 'react';
import { useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import SuccessModal from '../success-modal';
import {
  Wrapper,
  Title,
  Subtitle,
  ProgressWrapper,
  Circle,
  ProgressTop,
  Percent,
  Text,
  ProgressBar,
  ProgressFill,
  Steps,
  StepItem,
  StepText,
  NoteRow,
} from './style';

const SUCCESS_HOLD_MS = 1400;

type StepStatus = 'pending' | 'active' | 'done';

interface Step {
  id: number;
  title: string;
  status: StepStatus;
}

function buildInitialSteps(t: (key: string) => string): Step[] {
  return [
    { id: 1, title: t('studyLoad.progress.step.department'), status: 'pending' },
    { id: 2, title: t('studyLoad.progress.step.sciences'), status: 'pending' },
    { id: 3, title: t('studyLoad.progress.step.course'), status: 'pending' },
    { id: 4, title: t('studyLoad.progress.step.totalHour'), status: 'pending' },
    { id: 5, title: t('studyLoad.progress.step.direction'), status: 'pending' },
  ];
}

interface IProps {
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  department?: string;
}

const ProgressModal = ({ isPending, isSuccess, isError, department }: IProps) => {
  const { t } = useTranslation();
  const hideModal = useModalStore((s) => s.hideModal);

  const initialSteps = useMemo(() => buildInitialSteps(t), [t]);
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState<Step[]>(initialSteps);
  const [holdDone, setHoldDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const successShownRef = useRef(false);

  useEffect(() => {
    if (!isPending) return;

    successShownRef.current = false;

    const totalTime = 5000;
    const intervalTime = 300;
    const targetMax = 90;
    const totalIntervals = totalTime / intervalTime;
    let currentInterval = 0;

    intervalRef.current = setInterval(() => {
      currentInterval += 1;
      const rawProgress = Math.round((currentInterval / totalIntervals) * targetMax);
      const newProgress = Math.min(rawProgress, targetMax);
      setProgress(newProgress);

      const stepsCount = initialSteps.length;
      const stepProgress = (newProgress / 100) * stepsCount;

      setSteps((prev) =>
        prev.map((step, index) => {
          if (index < Math.floor(stepProgress)) return { ...step, status: 'done' as StepStatus };
          if (index === Math.floor(stepProgress)) return { ...step, status: 'active' as StepStatus };
          return { ...step, status: 'pending' as StepStatus };
        }),
      );

      if (newProgress >= targetMax && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, intervalTime);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPending, initialSteps]);

  useEffect(() => {
    if (!isSuccess || successShownRef.current) return;
    successShownRef.current = true;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setProgress(100);
    setSteps((prev) => prev.map((s) => ({ ...s, status: 'done' as StepStatus })));

    const timer = window.setTimeout(() => setHoldDone(true), SUCCESS_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [isSuccess]);

  useEffect(() => {
    if (!isError) return;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    hideModal();
  }, [isError, hideModal]);

  if (isSuccess && holdDone) {
    return (
      <SuccessModal
        title={t('studyLoad.progress.successTitle')}
        text={
          department
            ? t('studyLoad.progress.successTextWithDept', { department })
            : t('studyLoad.progress.successTextGeneric')
        }
      />
    );
  }

  return (
    <Wrapper>
      <Title>{t('studyLoad.progress.title')}</Title>
      <Subtitle>{t('studyLoad.progress.subtitle')}</Subtitle>

      <ProgressWrapper>
        <Circle />
        <div className="progress-right">
          <ProgressTop>
            <Percent>{progress}%</Percent>
            <Text>{t('studyLoad.progress.hoursCalculating')}</Text>
          </ProgressTop>
          <ProgressBar>
            <ProgressFill style={{ width: `${progress}%` }} />
          </ProgressBar>
        </div>
      </ProgressWrapper>

      <NoteRow>
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ flexShrink: 0 }}
        >
          <path
            d="M10.0013 1.66797C5.40964 1.66797 1.66797 5.40964 1.66797 10.0013C1.66797 14.593 5.40964 18.3346 10.0013 18.3346C14.593 18.3346 18.3346 14.593 18.3346 10.0013C18.3346 5.40964 14.593 1.66797 10.0013 1.66797Z"
            stroke="#EF6820"
            strokeWidth="1.5"
          />
          <path
            d="M10 6.66797V10.0013"
            stroke="#EF6820"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="10" cy="13.334" r="0.833" fill="#EF6820" />
        </svg>
        <span>{t('studyLoad.progress.noteText')}</span>
      </NoteRow>

      <Steps>
        {steps.map((step) => (
          <StepItem key={step.id}>
            {step.status === 'done' ? (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                  stroke="#34C18C"
                  strokeWidth="1.5"
                />
                <path
                  d="M9 12L11 14L15 10"
                  stroke="#34C18C"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : step.status === 'active' ? (
              <span className="pending">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M11.9996 21C10.099 20.9999 8.2472 20.3981 6.70964 19.2809C5.17207 18.1637 4.02766 16.5885 3.4404 14.7809C2.85315 12.9733 2.8532 11.0262 3.44056 9.21864C4.02792 7.41109 5.17242 5.83588 6.71005 4.71876C8.24767 3.60165 10.0995 2.99999 12.0001 3C13.9007 3.00001 15.7525 3.60171 17.2901 4.71884C18.8277 5.83598 19.9722 7.41121 20.5595 9.21877C21.1468 11.0263 21.1468 12.9734 20.5596 14.781"
                    stroke="#EF6820"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            ) : (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                  stroke="#9AA4B2"
                  strokeWidth="1.5"
                />
              </svg>
            )}
            <StepText $status={step.status}>{step.title}</StepText>
          </StepItem>
        ))}
      </Steps>
    </Wrapper>
  );
};

export default ProgressModal;
