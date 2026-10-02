import { Tag, Typography } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';
import { getApprovalStepLabel } from '../../model/status-workflow';
import type { ApprovalStep } from '../../distribution/model/types';
import {
  TimelineWrapper,
  StepItem,
  StepDot,
  StepContent,
  StepMeta,
  RejectReason,
} from './style';

const { Text } = Typography;

interface IProps {
  history: ApprovalStep[];
}

function buildStatusTagMeta(
  t: (key: string) => string,
): Record<ApprovalStep['status'], { label: string; color: string }> {
  return {
    pending: { label: t('studyLoad.approval.status.pending'), color: 'default' },
    approved: { label: t('studyLoad.approval.status.approved'), color: 'success' },
    rejected: { label: t('studyLoad.approval.status.rejected'), color: 'error' },
  };
}

function formatDate(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const DotIcon = ({ status }: { status: ApprovalStep['status'] }) => {
  if (status === 'approved') {
    return <CheckOutlined style={{ fontSize: 11, color: '#fff' }} />;
  }
  if (status === 'rejected') {
    return <CloseOutlined style={{ fontSize: 11, color: '#fff' }} />;
  }
  return <ClockCircleOutlined style={{ fontSize: 11, color: 'var(--color-text-soft)' }} />;
};

const DATE_LOCALE_MAP: Record<string, string> = {
  uz: 'uz-UZ',
  ru: 'ru-RU',
  en: 'en-US',
};

const ApprovalTimeline = ({ history }: IProps) => {
  const { t, lang } = useTranslation();
  const statusTag = buildStatusTagMeta(t);
  const locale = DATE_LOCALE_MAP[lang] ?? 'uz-UZ';

  if (history.length === 0) {
    return (
      <Text type="secondary" style={{ fontSize: 13 }}>
        {t('studyLoad.approval.noHistory')}
      </Text>
    );
  }

  return (
    <TimelineWrapper>
      {history.map((step, idx) => {
        const tagMeta = statusTag[step.status];
        const dateStr = formatDate(step.date, locale);
        const stepLabel = step.label
          ? step.label
          : getApprovalStepLabel(String(step.step), t);

        return (
          <StepItem key={`${String(step.step)}-${idx}`}>
            <StepDot $status={step.status}>
              <DotIcon status={step.status} />
            </StepDot>

            <StepContent>
              <Text
                strong
                style={{ fontSize: 13, color: 'var(--color-text)', display: 'block' }}
              >
                {stepLabel}
              </Text>

              <StepMeta>
                <Tag color={tagMeta.color} style={{ margin: 0 }}>
                  {tagMeta.label}
                </Tag>

                {step.approverName ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {step.approverName}
                  </Text>
                ) : null}

                {dateStr ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dateStr}
                  </Text>
                ) : null}
              </StepMeta>

              {step.status === 'rejected' && step.comment ? (
                <RejectReason>
                  <Text type="danger" style={{ fontSize: 12 }}>
                    {step.comment}
                  </Text>
                </RejectReason>
              ) : null}
            </StepContent>
          </StepItem>
        );
      })}
    </TimelineWrapper>
  );
};

export default ApprovalTimeline;
