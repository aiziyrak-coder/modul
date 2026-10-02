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
import { useApproveArticle, useArticle, useRejectArticle } from '../../api/article-api';
import { rejecterRoleLabel } from '../../model/rejecter-role';
import StatusBadge from '../../components/status-badge';
import TypeTag from '../../components/type-tag';
import DecisionWarning from '../../components/decision-warning';
import CompactButtons from '../../components/compact-buttons';
import FileChip from '../../components/file-chip';

export default function ArticleDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goBack = useBackTo('/scientific-department/articles');
  const { message } = App.useApp();
  const can = usePermission();
  const canModerate = can('article:approve');
  const canReject = can('article:reject');
  const canUpdate = can('article:update');

  const { data: article, isLoading } = useArticle(id);
  const approveArticle = useApproveArticle();
  const rejectArticle = useRejectArticle();

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  const handleApprove = async () => {
    if (!article) return;
    try {
      await approveArticle.mutateAsync(article.id);
      message.success(t('scientificDepartment.articles.approved'));
      setApproveOpen(false);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleReject = async () => {
    if (!article) return;
    if (reason.trim().length < 3) {
      message.error(t('scientificDepartment.articles.reasonRequired'));
      return;
    }
    try {
      await rejectArticle.mutateAsync({ id: article.id, reason: reason.trim() });
      message.success(t('scientificDepartment.articles.rejected'));
      setRejectOpen(false);
      setReason('');
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  if (isLoading || !article) {
    return (
      <PageContainer title={t('scientificDepartment.articles.detailTitle')}>
        <Flex align="center" justify="center" style={{ minHeight: 240 }}>
          <Spin />
        </Flex>
      </PageContainer>
    );
  }

  return (
    <CompactButtons>
    <PageContainer title={t('scientificDepartment.articles.detailTitle')}>
      <Card size="small">
        <Flex align="center" gap={12} wrap style={{ marginBottom: 16 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={goBack}
          >
            {t('scientificDepartment.back')}
          </Button>
          <StatusBadge
            status={article.status}
            reason={article.rejectionReason}
            rejectedBy={article.rejectedByName}
          />
          <TypeTag type={article.type} />
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
          <Descriptions.Item label={t('scientificDepartment.articles.colJournal')}>
            <strong>{article.journalName}</strong>
          </Descriptions.Item>
          {article.type !== 'nationalOak' ? (
            <Descriptions.Item label={t('scientificDepartment.articles.articleTitle')}>
              {article.title || '—'}
            </Descriptions.Item>
          ) : null}
          <Descriptions.Item label={t('scientificDepartment.articles.colAuthorTitle')}>
            {article.authorName || '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.articles.colAcademicYear')}>
            {article.academicYear || '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.articles.publishDate')}>
            {article.publishedDate || article.publishYear || '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.articles.pages')}>
            {article.pages || '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.articles.colAuthors')}>
            {article.authorCount ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.articles.url')}>
            {article.url ? (
              <a href={article.url} target="_blank" rel="noreferrer">
                <LinkOutlined /> {article.url}
              </a>
            ) : (
              '—'
            )}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.articles.colFaculty')}>
            {article.facultyName || '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.articles.colDepartment')}>
            {article.departmentName || '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.articles.colDate')}>
            {article.date}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.articles.pdf')}>
            <FileChip url={article.fileUrl} />
          </Descriptions.Item>
        </Descriptions>

        {article.status === 'rejected' && article.rejectionReason ? (
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
              {rejecterRoleLabel(article.rejectedByRole, t) ? (
                <strong>{rejecterRoleLabel(article.rejectedByRole, t)}: </strong>
              ) : null}
              {article.rejectionReason}
            </div>
            {article.rejectedByName ? (
              <div style={{ fontSize: 12, color: 'var(--color-text-mute)', marginTop: 6 }}>
                {t('scientificDepartment.status.rejectedBy')}: {article.rejectedByName}
              </div>
            ) : null}
            {canUpdate ? (
              <Button
                type="primary"
                size="small"
                icon={<ReloadOutlined />}
                style={{ marginTop: 10 }}
                onClick={() =>
                  navigate('/scientific-department/articles', {
                    state: { resubmit: article },
                  })
                }
              >
                {t('scientificDepartment.articles.resubmit')}
              </Button>
            ) : null}
          </div>
        ) : null}

        {(canModerate || canReject) && article.status === 'new' ? (
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
        title={t('scientificDepartment.articles.approveTitle')}
        open={approveOpen}
        onCancel={() => setApproveOpen(false)}
        onOk={handleApprove}
        okText={t('scientificDepartment.confirm')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={approveArticle.isPending}
      >
        <div style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {t('scientificDepartment.articles.approveBody')}
        </div>
        <DecisionWarning />
      </Modal>

      <Modal centered
        title={t('scientificDepartment.articles.rejectTitle')}
        open={rejectOpen}
        onCancel={() => {
          setRejectOpen(false);
          setReason('');
        }}
        onOk={handleReject}
        okText={t('scientificDepartment.send')}
        cancelText={t('scientificDepartment.cancel')}
        okButtonProps={{ danger: true }}
        confirmLoading={rejectArticle.isPending}
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
