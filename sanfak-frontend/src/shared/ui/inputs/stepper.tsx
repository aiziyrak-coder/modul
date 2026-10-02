import { Steps } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';

export interface StepperProps {
  current: number;
  steps: string[];
}

export function Stepper({ current, steps }: StepperProps) {
  const { t } = useTranslation();
  return <Steps current={current} items={steps.map((title) => ({ title: t(title) }))} />;
}
