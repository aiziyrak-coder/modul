import { App, Steps, Tag, Typography } from 'antd';
import { isSafeLink } from '../../model/safe-link';
import { LinkOutlined } from '@ant-design/icons';
import { useModalStore, ModalActions, type ModalAction } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { usePermission } from '@/app/session';
import {
  useApproveReport,
  useRejectReport,
  useSubmitReport,
  getApiErrorMessage,
} from '../../api/reports-api';
import { getReportRejectionComment } from '../../api/reports-mapper';
import type { PersonalReport, ReportApprovalStepStatus } from '../../model/report-types';
import { REPORT_SIGNABLE_STATUSES } from '../../model/report-types';
import ReportRejectModal from '../report-reject-modal';
import { useHasPendingReportStep } from '../../lib/use-my-pending-step';
import { FileLink, MetaRow, TextBlock, Wrapper } from './style';

const { Text } = Typography;

const STEP_STATUS_MAP: Record<ReportApprovalStepStatus, 'wait' | 'finish' | 'error'> = {
  pending: 'wait',
  approved: 'finish',
  rejected: 'error',
};

const MONTHS_UZ_FULL = [
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'Iyun',
  'Iyul',
  'Avgust',
  'Sentabr',
  'Oktabr',
  'Noyabr',
  'Dekabr',
];

function formatFullReportDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getDate()}-${MONTHS_UZ_FULL[d.getMonth()]} ${d.getFullYear()}`;
}

interface IProps {
  report: PersonalReport;
}

const ReportViewModal = ({ report }: IProps) => {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const showModal = useModalStore((s) => s.showModal);
  const hideModal = useModalStore((s) => s.hideModal);
  const can = usePermission();

  const approve = useApproveReport(report.id);
  const reject = useRejectReport(report.id);
  const submit = useSubmitReport(report.id);

  const rejectionComment = getReportRejectionComment(report);
  const canSign = useHasPendingReportStep(report.approvals);
  const semesterLabel = t(`teacher.personalPlan.reports.semester.${report.semester}`);

  const handleApprove = () => {
    modal.confirm({
      title: t('teacher.personalPlan.reports.approve.title'),
      okText: t('teacher.personalPlan.reports.approve.confirm'),
      cancelText: t('cancel'),
      onOk: async () => {
        try {
          await approve.mutateAsync(undefined);
          message.success(t('teacher.personalPlan.reports.approve.success'));
          hideModal();
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
    });
  };

  const handleSubmit = () => {
    modal.confirm({
      title: t('teacher.personalPlan.reports.submit.title'),
      content: t('teacher.personalPlan.reports.submit.content'),
      okText: t('teacher.personalPlan.reports.submit.confirm'),
      cancelText: t('cancel'),
      onOk: async () => {
        try {
          await submit.mutateAsync();
          message.success(t('teacher.personalPlan.reports.submit.success'));
          hideModal();
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
    });
  };

  const handleReject = () => {
    showModal({
      title: t('teacher.personalPlan.reports.reject.title'),
      maxWidth: '460px',
      body: () => (
        <ReportRejectModal
          loading={reject.isPending}
          onConfirm={async (comment) => {
            try {
              await reject.mutateAsync(comment);
              message.success(t('teacher.personalPlan.reports.reject.success'));
              hideModal();
            } catch (e) {
              message.error(getApiErrorMessage(e));
            }
          }}
        />
      ),
    });
  };

  const signable = REPORT_SIGNABLE_STATUSES.includes(report.status) && canSign;
  const submittable = report.status === 'draft' && can('personalWorkPlan:update');
  const footerActions: ModalAction[] = [
    { label: t('teacher.personalPlan.reports.view.close'), onClick: hideModal },
    ...(submittable
      ? [
          {
            label: t('teacher.personalPlan.reports.submit.action'),
            variant: 'primary' as const,
            loading: submit.isPending,
            onClick: handleSubmit,
          },
        ]
      : []),
    ...(signable && can('personalWorkPlan:reject')
      ? [
          {
            label: t('teacher.personalPlan.reports.reject.action'),
            variant: 'danger' as const,
            loading: reject.isPending,
            onClick: handleReject,
          },
        ]
      : []),
    ...(signable && can('personalWorkPlan:approve')
      ? [
          {
            label: t('teacher.personalPlan.reports.approve.action'),
            variant: 'primary' as const,
            loading: approve.isPending,
            onClick: handleApprove,
          },
        ]
      : []),
  ];

  return (
    <Wrapper>
      <MetaRow>
        <div>
          <div className="label">{t('teacher.personalPlan.reports.view.semester')}</div>
          <div className="value">{semesterLabel}</div>
        </div>
        <div>
          <div className="label">{t('teacher.personalPlan.reports.view.academicYear')}</div>
          <div className="value">{report.academicYearTitle ?? '—'}</div>
        </div>
        <div>
          <div className="label">{t('teacher.personalPlan.reports.view.createdAt')}</div>
          <div className="value">{formatFullReportDate(report.createdAt)}</div>
        </div>
      </MetaRow>

      <TextBlock>{report.text}</TextBlock>

      {report.councilDecisionFile && isSafeLink(report.councilDecisionFile) ? (
        <FileLink href={report.councilDecisionFile} target="_blank" rel="noreferrer">
          <LinkOutlined /> {t('teacher.personalPlan.reports.view.councilFileLink')}
        </FileLink>
      ) : null}
      {report.councilDecisionFile && !isSafeLink(report.councilDecisionFile) ? (
        <Typography.Text type="secondary">{report.councilDecisionFile}</Typography.Text>
      ) : null}

      {report.status === 'rejected' && rejectionComment ? (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Tag color="error">{t('teacher.personalPlan.reports.view.rejectReasonTitle')}</Tag>
          <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 13 }}>
            {rejectionComment}
          </Text>
        </div>
      ) : null}

      {report.approvals.length > 0 ? (
        <Steps
          direction="vertical"
          size="small"
          style={{ marginTop: 'var(--space-5)' }}
          items={report.approvals.map((step) => ({
            title: step.label,
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
          }))}
        />
      ) : null}

      <ModalActions actions={footerActions} />
    </Wrapper>
  );
};

export default ReportViewModal;
