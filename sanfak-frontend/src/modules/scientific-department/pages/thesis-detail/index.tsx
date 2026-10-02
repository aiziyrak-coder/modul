import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { App, Button, Descriptions, Form, Input, Space, Spin } from 'antd';
import Modal from '../../components/scroll-modal';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LinkOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { PageContainer, Card, Flex } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useBackTo } from '../../lib/use-back-to';
import { getApiErrorMessage } from '@/shared/api';
import { usePermission } from '@/app/session';
import { useApproveThesis, useRejectThesis, useThesis } from '../../api/thesis-api';
import { rejecterRoleLabel } from '../../model/rejecter-role';
import StatusBadge from '../../components/status-badge';
import ThesisTypeTag from '../../components/thesis-type-tag';
import DecisionWarning from '../../components/decision-warning';
import CompactButtons from '../../components/compact-buttons';
import FileChip from '../../components/file-chip';

export default function ThesisDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goBack = useBackTo('/scientific-department/theses');
  const { message } = App.useApp();
  const can = usePermission();
  const canModerate = can('thesis:approve');
  const canReject = can('thesis:reject');
  const canUpdate = can('thesis:update');

  const { data: thesis, isLoading } = useThesis(id);
  const approveThesis = useApproveThesis();
  const rejectThesis = useRejectThesis();

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  const handleApprove = async () => {
    if (!thesis) return;
    try {
      await approveThesis.mutateAsync(thesis.id);
      message.success(t('scientificDepartment.theses.approved'));
      setApproveOpen(false);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleReject = async () => {
    if (!thesis) return;
    if (reason.trim().length < 3) {
      message.error(t('scientificDepartment.articles.reasonRequired'));
      return;
    }
    try {
      await rejectThesis.mutateAsync({ id: thesis.id, reason: reason.trim() });
      message.success(t('scientificDepartment.theses.rejected'));
      setRejectOpen(false);
      setReason('');
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  if (isLoading || !thesis) {
    return (
      <PageContainer title={t('scientificDepartment.theses.detailTitle')}>
        <Flex align="center" justify="center" style={{ minHeight: 240 }}>
          <Spin />
        </Flex>
      </PageContainer>
    );
  }

  return (
    <CompactButtons>
    <PageContainer title={t('scientificDepartment.theses.detailTitle')}>
      <Card size="small">
        <Flex align="center" gap={12} wrap style={{ marginBottom: 16 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={goBack}
          >
            {t('scientificDepartment.back')}
          </Button>
          <StatusBadge
            status={thesis.status}
            reason={thesis.rejectionReason}
            rejectedBy={thesis.rejectedByName}
          />
          <ThesisTypeTag type={thesis.type} />
        </Flex>

        <Descriptions
          column={1}
          size="small"
          bordered
          styles={{
            label: {
              background: 'var(--color-bg-elevate)',
              fontWeight: 500,
              width: 220,
              color: 'var(--color-text-mute)',
            },
          }}
        >
          <Descriptions.Item label={t('scientificDepartment.theses.thesisTitle')}>
            <strong>{thesis.title}</strong>
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.theses.colConference')}>
            {thesis.conferenceName}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.articles.colAuthorTitle')}>
            {thesis.authorName || '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.articles.colAcademicYear')}>
            {thesis.academicYear || '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.theses.publishDate')}>
            {thesis.publishedDate || thesis.publishYear || '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.articles.pages')}>
            {thesis.pages || '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.articles.colAuthors')}>
            {thesis.authorCount ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.articles.url')}>
            {thesis.url ? (
              <a href={thesis.url} target="_blank" rel="noreferrer">
                <LinkOutlined /> {thesis.url}
              </a>
            ) : (
              '—'
            )}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.articles.colFaculty')}>
            {thesis.facultyName || '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.articles.colDepartment')}>
            {thesis.departmentName || '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.articles.colDate')}>
            {thesis.date}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.theses.pdf')}>
            <FileChip url={thesis.fileUrl} />
          </Descriptions.Item>
        </Descriptions>

        {thesis.status === 'rejected' && thesis.rejectionReason ? (
          <div
            style={{
              marginTop: 16,
              background: 'color-mix(in srgb, var(--brand-error) 8%, #fff)',
              border: '1px solid color-mix(in srgb, var(--brand-error) 25%, #fff)',
              borderRadius: 'var(--radius-md)',
              padding: 12,
            }}
          >
            <div
              style={{
                color: 'var(--brand-error)',
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              {t('scientificDepartment.rejectReason')}:
            </div>
            <div style={{ fontSize: 13 }}>
              {rejecterRoleLabel(thesis.rejectedByRole, t) ? (
                <strong>{rejecterRoleLabel(thesis.rejectedByRole, t)}: </strong>
              ) : null}
              {thesis.rejectionReason}
            </div>
            {thesis.rejectedByName ? (
              <div style={{ fontSize: 12, color: 'var(--color-text-mute)', marginTop: 6 }}>
                {t('scientificDepartment.status.rejectedBy')}: {thesis.rejectedByName}
              </div>
            ) : null}
            {canUpdate ? (
              <Button
                type="primary"
                size="small"
                icon={<ReloadOutlined />}
                style={{ marginTop: 10 }}
                onClick={() =>
                  navigate('/scientific-department/theses', {
                    state: { resubmit: thesis },
                  })
                }
              >
                {t('scientificDepartment.articles.resubmit')}
              </Button>
            ) : null}
          </div>
        ) : null}

        {(canModerate || canReject) && ['new', 'pending'].includes(thesis.status) ? (
          <Space style={{ marginTop: 16 }}>
            {canModerate ? (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => setApproveOpen(true)}
              >
                {t('scientificDepartment.approve')}
              </Button>
            ) : null}
            {canReject ? (
              <Button danger icon={<CloseCircleOutlined />} onClick={() => setRejectOpen(true)}>
                {t('scientificDepartment.reject')}
              </Button>
            ) : null}
          </Space>
        ) : null}
      </Card>

      <Modal centered
        title={t('scientificDepartment.theses.approveTitle')}
        open={approveOpen}
        onCancel={() => setApproveOpen(false)}
        onOk={handleApprove}
        okText={t('scientificDepartment.confirm')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={approveThesis.isPending}
      >
        <DecisionWarning />
      </Modal>

      <Modal centered
        title={t('scientificDepartment.theses.rejectTitle')}
        open={rejectOpen}
        onCancel={() => {
          setRejectOpen(false);
          setReason('');
        }}
        onOk={handleReject}
        okText={t('scientificDepartment.send')}
        cancelText={t('scientificDepartment.cancel')}
        okButtonProps={{ danger: true }}
        confirmLoading={rejectThesis.isPending}
      >
        <Form layout="vertical">
          <Form.Item label={t('scientificDepartment.rejectReason')} required>
            <Input.TextArea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('scientificDepartment.rejectReasonPlaceholder')}
            />
          </Form.Item>
        </Form>
        <DecisionWarning />
      </Modal>
      <div aria-hidden style={{ flexShrink: 0, height: 'var(--space-6)' }} />
    </PageContainer>
    </CompactButtons>
  );
}
