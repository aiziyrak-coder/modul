import { Steps, Typography } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';
import type { ApprovalStepKey, PersonalPlanDetail } from '../../model/types';

const { Text } = Typography;

interface IProps {
  plan: PersonalPlanDetail;
}

const STEP_STATUS_MAP = {
  pending: 'wait',
  approved: 'finish',
  rejected: 'error',
} as const;

const STEP_TITLE_KEY: Record<ApprovalStepKey, string> = {
  teacher: 'teacher.personalPlan.timeline.step.teacher',
  kafedraUslubiy: 'teacher.personalPlan.timeline.step.kafedraUslubiy',
  kafedraIlmiy: 'teacher.personalPlan.timeline.step.kafedraIlmiy',
  kafedraUstozShogird: 'teacher.personalPlan.timeline.step.kafedraUstozShogird',
  kafedraMudiri: 'teacher.personalPlan.timeline.step.kafedraMudiri',
  oquvUslubiy: 'teacher.personalPlan.timeline.step.oquvUslubiy',
  dekan: 'teacher.personalPlan.timeline.step.dekan',
  ichkiNazorat: 'teacher.personalPlan.timeline.step.ichkiNazorat',
};

const StatusTimeline = ({ plan }: IProps) => {
  const { t } = useTranslation();

  if (plan.approvals.length === 0) {
    return null;
  }

  const items = plan.approvals.map((step) => {
    const titleKey = STEP_TITLE_KEY[step.step];
    return {
      title: titleKey ? t(titleKey) : step.label,
      status: STEP_STATUS_MAP[step.status],
      description:
        step.status !== 'pending' ? (
          <div>
            {step.approvedByName ? (
              <Text strong style={{ fontSize: 12, display: 'block' }}>
                {step.approvedByName}
              </Text>
            ) : null}
            {step.date ? (
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                {new Date(step.date).toLocaleDateString('uz-UZ')}
              </Text>
            ) : null}
            {step.comment ? (
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                {step.comment}
              </Text>
            ) : null}
          </div>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('teacher.personalPlan.timeline.pendingStep')}
          </Text>
        ),
    };
  });

  return (
    <Steps
      direction="vertical"
      size="small"
      items={items}
      style={{ marginBottom: 'var(--space-4)', maxHeight: 420, overflowY: 'auto' }}
    />
  );
};

export default StatusTimeline;
