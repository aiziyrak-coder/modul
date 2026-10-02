import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { App, Button, Descriptions, Form, Input, Space, Spin } from 'antd';
import Modal from '../../components/scroll-modal';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  FileOutlined,
  FileZipOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { PageContainer, Card, Flex } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useBackTo } from '../../lib/use-back-to';
import { getApiErrorMessage } from '@/shared/api';
import { usePermission } from '@/app/session';
import {
  downloadContractArchive,
  useApproveContract,
  useContract,
  useRejectContract,
} from '../../api/contract-api';
import StatusBadge from '../../components/status-badge';
import DecisionWarning from '../../components/decision-warning';
import CompactButtons from '../../components/compact-buttons';
import { useSciRole } from '../../model/role-status';
import { CONTRACT_FILE_SLOTS, type ContractSlot } from '../../model/types';
import { rejecterRoleLabel } from '../../model/rejecter-role';

const formatMoney = (amount: number): string =>
  `${new Intl.NumberFormat('uz-UZ').format(amount)} so'm`;

export default function IndustryOrderDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goBack = useBackTo('/scientific-department/industry-orders');
  const { message } = App.useApp();
  const can = usePermission();
  const role = useSciRole();

  const { data: c, isLoading } = useContract(id);
  const approveContract = useApproveContract();
  const rejectContract = useRejectContract();

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [archiving, setArchiving] = useState(false);

  if (isLoading || !c) {
    return (
      <PageContainer title={t('scientificDepartment.contracts.detailTitle')}>
        <Flex align="center" justify="center" style={{ minHeight: 240 }}>
          <Spin />
        </Flex>
      </PageContainer>
    );
  }

  const isIlmiy = role === 'ilmiy' || role === 'admin';
  const reviewable = isIlmiy && c.status === 'new';
  const canResubmit = can('economicContract:update') && c.status === 'rejected';

  const handleApprove = async () => {
    try {
      await approveContract.mutateAsync(c.id);
      message.success(t('scientificDepartment.contracts.approved'));
      setApproveOpen(false);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleReject = async () => {
    if (reason.trim().length < 3) {
      message.error(t('scientificDepartment.articles.reasonRequired'));
      return;
    }
    try {
      await rejectContract.mutateAsync({ id: c.id, reason: reason.trim() });
      message.success(t('scientificDepartment.contracts.rejected'));
      setRejectOpen(false);
      setReason('');
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const hasAnyFile = CONTRACT_FILE_SLOTS.some(
    (cfg) => Boolean(c.files[cfg.slot as ContractSlot]),
  );

  const handleDownloadArchive = async () => {
    setArchiving(true);
    try {
      await downloadContractArchive(c.id, c.teacherName, c.contractDate);
    } catch (err) {
      message.error(getApiErrorMessage(err));
    } finally {
      setArchiving(false);
    }
  };

  const fileChips = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 12 }}>
      {CONTRACT_FILE_SLOTS.map((cfg) => {
        const url = c.files[cfg.slot as ContractSlot];
        return (
          <div
            key={cfg.slot}
            onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              cursor: url ? 'pointer' : 'default',
              opacity: url ? 1 : 0.5,
            }}
          >
            <FileOutlined style={{ color: 'var(--brand-primary)' }} />
            <span style={{ fontSize: 12.5, flex: 1 }}>
              {t(`scientificDepartment.${cfg.labelKey}`)}
            </span>
            {url ? <DownloadOutlined style={{ color: 'var(--color-text-mute)' }} /> : null}
          </div>
        );
      })}
    </div>
  );

  return (
    <CompactButtons>
    <PageContainer title={t('scientificDepartment.contracts.detailTitle')}>
      <Card size="small">
        <Flex align="center" gap={12} wrap style={{ marginBottom: 16 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={goBack}
          >
            {t('scientificDepartment.back')}
          </Button>
          <StatusBadge
            status={c.status}
            reason={c.rejectionReason}
            rejectedBy={c.rejectedByName}
          />
          <div style={{ flex: 1 }} />
          {hasAnyFile ? (
            <Button
              icon={<FileZipOutlined />}
              loading={archiving}
              onClick={handleDownloadArchive}
            >
              {t('scientificDepartment.contracts.downloadArchive')}
            </Button>
          ) : null}
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
          <Descriptions.Item label={t('scientificDepartment.contracts.name')}>
            <strong>{c.title}</strong>
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.contracts.colDepartment')}>
            {c.departmentName || '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.contracts.teacher')}>
            {c.teacherName || '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.contracts.partner')}>
            {c.partnerOrganization}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.contracts.amount')}>
            <span style={{ fontWeight: 700, color: 'var(--brand-primary)', fontSize: 15 }}>
              {formatMoney(c.amount)}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.contracts.contractDate')}>
            {c.contractDate || '—'}
          </Descriptions.Item>
        </Descriptions>

        <div style={{ marginTop: 16, fontWeight: 600, fontSize: 13 }}>
          {t('scientificDepartment.contracts.attachedFiles')}
        </div>
        {fileChips}

        {c.status === 'rejected' && c.rejectionReason ? (
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
              {rejecterRoleLabel(c.rejectedByRole, t) ? (
                <strong>{rejecterRoleLabel(c.rejectedByRole, t)}: </strong>
              ) : null}
              {c.rejectionReason}
            </div>
            {c.rejectedByName ? (
              <div style={{ fontSize: 12, color: 'var(--color-text-mute)', marginTop: 6 }}>
                {t('scientificDepartment.status.rejectedBy')}: {c.rejectedByName}
              </div>
            ) : null}
            {canResubmit ? (
              <Button
                type="primary"
                size="small"
                icon={<ReloadOutlined />}
                style={{ marginTop: 10 }}
                onClick={() =>
                  navigate('/scientific-department/industry-orders', {
                    state: { resubmit: c },
                  })
                }
              >
                {t('scientificDepartment.articles.resubmit')}
              </Button>
            ) : null}
          </div>
        ) : null}

        {reviewable && (can('economicContract:approve') || can('economicContract:reject')) ? (
          <div
            style={{
              marginTop: 16,
              border: '1px dashed var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 16,
            }}
          >
            <div style={{ fontSize: 12.5, color: 'var(--color-text-soft)', marginBottom: 10 }}>
              {t('scientificDepartment.contracts.actionCaption')}
            </div>
            <Space>
              {can('economicContract:approve') ? (
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={() => setApproveOpen(true)}
                >
                  {t('scientificDepartment.approve')}
                </Button>
              ) : null}
              {can('economicContract:reject') ? (
                <Button danger icon={<CloseCircleOutlined />} onClick={() => setRejectOpen(true)}>
                  {t('scientificDepartment.reject')}
                </Button>
              ) : null}
            </Space>
          </div>
        ) : null}
      </Card>

      <Modal centered
        title={t('scientificDepartment.contracts.approveTitle')}
        open={approveOpen}
        onCancel={() => setApproveOpen(false)}
        onOk={handleApprove}
        okText={t('scientificDepartment.confirm')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={approveContract.isPending}
      >
        <div
          style={{
            background: 'var(--brand-primary-soft)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: 8,
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {c.title}
        </div>
        <div style={{ color: 'var(--color-text-soft)', fontSize: 12.5 }}>
          {t('scientificDepartment.contracts.approveBody')}
        </div>
        <DecisionWarning />
      </Modal>

      <Modal centered
        title={t('scientificDepartment.contracts.rejectTitle')}
        open={rejectOpen}
        onCancel={() => {
          setRejectOpen(false);
          setReason('');
        }}
        onOk={handleReject}
        okText={t('scientificDepartment.send')}
        cancelText={t('scientificDepartment.cancel')}
        okButtonProps={{ danger: true }}
        confirmLoading={rejectContract.isPending}
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
