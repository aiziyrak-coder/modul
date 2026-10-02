import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { App, Button, Descriptions, Divider, Form, Input, Result, Space, Spin, Steps, Tabs, Tag } from 'antd';
import Modal from '../../components/scroll-modal';
import {
  GlobalOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  FileOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { PageContainer, Card, Flex } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useBackTo } from '../../lib/use-back-to';
import { getApiErrorMessage } from '@/shared/api';
import { usePermission } from '@/app/session';
import {
  useApproveMethodical,
  useMethodical,
  useRejectMethodical,
  useSignMethodical,
} from '../../api/methodical-api';
import StatusBadge from '../../components/status-badge';
import DecisionWarning from '../../components/decision-warning';
import SigCard from '../../components/sig-card';
import TabLabel from '../../components/tab-label';
import { useSigners } from '../../api/reference-api';
import EriSignModal, { type EriSignValues } from '../../components/eri-sign-modal';
import {
  canResubmitMethodical,
  getMethodicalRoleStatus,
  isMethodicalVisible,
  methodicalActionStage,
  useSciRole,
} from '../../model/role-status';
import { METHODICAL_FILE_SLOTS, type MethodicalSlot } from '../../model/types';
import { rejecterRoleLabel } from '../../model/rejecter-role';
import CompactButtons from '../../components/compact-buttons';

export default function MethodicalDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goBack = useBackTo('/scientific-department/methodical');
  const { message } = App.useApp();
  const can = usePermission();
  const role = useSciRole();

  const { data: m, isLoading } = useMethodical(id);
  const { data: signers } = useSigners();
  const approveMethodical = useApproveMethodical();
  const signMethodical = useSignMethodical();
  const rejectMethodical = useRejectMethodical();

  const [approveOpen, setApproveOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  if (isLoading || !m) {
    return (
      <PageContainer title={t('scientificDepartment.methodical.detailTitle')}>
        <Flex align="center" justify="center" style={{ minHeight: 240 }}>
          <Spin />
        </Flex>
      </PageContainer>
    );
  }

  if (!isMethodicalVisible(m, role)) {
    return (
      <PageContainer title={t('scientificDepartment.methodical.detailTitle')}>
        <Card size="small">
          <Result status="403" subTitle={t('scientificDepartment.notYourStage')} />
        </Card>
      </PageContainer>
    );
  }

  const stage = methodicalActionStage(m, role);
  const roleStatus = getMethodicalRoleStatus(m, role);
  const stepCurrent = 1 + (m.ilmiyApproved ? 1 : 0) + (m.kotibSigned ? 1 : 0) + (m.rektorSigned ? 1 : 0);

  const handleApprove = async () => {
    try {
      await approveMethodical.mutateAsync(m.id);
      message.success(t('scientificDepartment.methodical.ilmiyApproved'));
      setApproveOpen(false);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleSign = async (values: EriSignValues) => {
    try {
      const res = await signMethodical.mutateAsync({
        id: m.id,
        eriKey: values.eriKey,
        registrationNumber: values.registrationNumber,
        academicYear: values.academicYear,
      });
      const number = (res as { registrationNumber?: string })?.registrationNumber;
      message.success(
        stage === 'rektor' && number
          ? `${t('scientificDepartment.methodical.rektorSigned')} ${number}`
          : t('scientificDepartment.methodical.signed'),
      );
      setSignOpen(false);
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
      await rejectMethodical.mutateAsync({ id: m.id, reason: reason.trim() });
      message.success(t('scientificDepartment.methodical.rejected'));
      setRejectOpen(false);
      setReason('');
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const fileChips = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
      {METHODICAL_FILE_SLOTS.map((cfg) => {
        const url = m.files[cfg.slot as MethodicalSlot];
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
    <PageContainer title={t('scientificDepartment.methodical.detailTitle')}>
      <Card size="small">
        <Flex align="center" gap={12} wrap style={{ marginBottom: 16 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={goBack}
          >
            {t('scientificDepartment.back')}
          </Button>
          {roleStatus ? (
            <StatusBadge
              status={roleStatus}
              reason={m.rejectionReason}
              rejectedBy={m.rejectedByName}
            />
          ) : null}
          <div style={{ flex: 1 }} />
          {m.registrationNumber ? (
            <Tag
              icon={<SafetyCertificateOutlined />}
              color="success"
              style={{ fontWeight: 700, borderRadius: 'var(--radius-pill)', padding: '3px 12px' }}
            >
              {m.registrationNumber}
            </Tag>
          ) : null}
        </Flex>

        <div
          style={{
            background: 'var(--color-bg-elevate)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            marginBottom: 16,
          }}
        >
          <Steps
            size="small"
            current={stepCurrent}
            status={m.status === 'rejected' ? 'error' : undefined}
            items={[
              {
                title: t('scientificDepartment.methodical.stepTeacher'),
                description: m.date,
              },
              {
                title: t('scientificDepartment.methodical.stepIlmiy'),
                description: m.ilmiyApprovedAt ?? '—',
              },
              {
                title: t('scientificDepartment.methodical.stepKotib'),
                description: m.kotibSignedAt ?? '—',
              },
              {
                title: t('scientificDepartment.methodical.stepRektor'),
                description: m.rektorSignedAt ?? '—',
              },
            ]}
          />
        </div>

        <Tabs
          items={[
            {
              key: 'info',
              label: t('scientificDepartment.methodical.tabInfo'),
              children: (
                <>
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
                    <Descriptions.Item label={t('scientificDepartment.methodical.topic')}>
                      <strong>{m.title}</strong>
                    </Descriptions.Item>
                    <Descriptions.Item label={t('scientificDepartment.methodical.colAuthor')}>
                      {m.authorName || '—'}
                      {m.source === 'public' ? (
                        <Tag
                          color="processing"
                          icon={<GlobalOutlined />}
                          style={{ marginLeft: 8, borderRadius: 6 }}
                        >
                          {t('scientificDepartment.methodical.fromSite')}
                        </Tag>
                      ) : null}
                    </Descriptions.Item>
                    {m.source === 'public' ? (
                      <>
                        <Descriptions.Item
                          label={t('scientificDepartment.methodical.submitterPhone')}
                        >
                          {m.submitterPhone ? (
                            <a href={`tel:${m.submitterPhone}`}>{m.submitterPhone}</a>
                          ) : (
                            '—'
                          )}
                        </Descriptions.Item>
                        <Descriptions.Item
                          label={t('scientificDepartment.methodical.submitterEmail')}
                        >
                          {m.submitterEmail ? (
                            <a href={`mailto:${m.submitterEmail}`}>{m.submitterEmail}</a>
                          ) : (
                            '—'
                          )}
                        </Descriptions.Item>
                        <Descriptions.Item
                          label={t('scientificDepartment.methodical.submitterOrganization')}
                        >
                          {m.submitterOrganization || '—'}
                        </Descriptions.Item>
                        <Descriptions.Item
                          label={t('scientificDepartment.methodical.submitterDepartment')}
                        >
                          {m.submitterDepartment || '—'}
                        </Descriptions.Item>
                      </>
                    ) : null}
                    <Descriptions.Item label={t('scientificDepartment.methodical.specialty')}>
                      {m.specialtyLabel || '—'}
                    </Descriptions.Item>
                    {!m.specialtyLabel && m.direction ? (
                      <Descriptions.Item label={t('scientificDepartment.methodical.direction')}>
                        {m.direction}
                      </Descriptions.Item>
                    ) : null}
                    <Descriptions.Item label={t('scientificDepartment.articles.colFaculty')}>
                      {m.facultyName || '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('scientificDepartment.articles.colDepartment')}>
                      {m.departmentName || '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('scientificDepartment.articles.colAcademicYear')}>
                      {m.academicYear || '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('scientificDepartment.articles.colDate')}>
                      {m.date}
                    </Descriptions.Item>
                    {m.registrationNumber ? (
                      <Descriptions.Item label={t('scientificDepartment.eri.number')}>
                        <Tag color="success" style={{ fontWeight: 600 }}>
                          {m.registrationNumber}
                        </Tag>
                      </Descriptions.Item>
                    ) : null}
                  </Descriptions>

                  <Divider style={{ margin: '24px 0 12px', fontSize: 13.5, fontWeight: 600 }}>
                    {t(
                      m.kotibSigned && m.rektorSigned
                        ? 'scientificDepartment.methodical.approvedDocuments'
                        : 'scientificDepartment.methodical.attachedFiles',
                    )}
                  </Divider>
                  {fileChips}

                  {m.status === 'rejected' && m.rejectionReason ? (
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
                        {rejecterRoleLabel(m.rejectedByRole, t) ? (
                          <strong>{rejecterRoleLabel(m.rejectedByRole, t)}: </strong>
                        ) : null}
                        {m.rejectionReason}
                      </div>
                      {m.rejectedByName ? (
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--color-text-mute)',
                            marginTop: 6,
                          }}
                        >
                          {t('scientificDepartment.status.rejectedBy')}: {m.rejectedByName}
                        </div>
                      ) : null}
                      {canResubmitMethodical(m, role) &&
                      can('methodicalRecommendation:update') ? (
                        <Button
                          type="primary"
                          size="small"
                          icon={<ReloadOutlined />}
                          style={{ marginTop: 10 }}
                          onClick={() =>
                            navigate('/scientific-department/methodical', {
                              state: { resubmit: m },
                            })
                          }
                        >
                          {t('scientificDepartment.articles.resubmit')}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ),
            },
            {
              key: 'signatures',
              label: (
                <TabLabel
                  text={t('scientificDepartment.methodical.tabSignatures')}
                  done={m.kotibSigned && m.rektorSigned}
                />
              ),
              children: (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <SigCard
                    roleLabel={t('scientificDepartment.methodical.stepKotib')}
                    signerName={m.kotibSigned ? m.kotibSignedByName : (signers?.kotib ?? null)}
                    signed={m.kotibSigned}
                    signedAt={m.kotibSignedAt}
                    eriSerial={m.kotibEriSerial}
                  />
                  <SigCard
                    roleLabel={t('scientificDepartment.methodical.stepRektor')}
                    signerName={m.rektorSigned ? m.rektorSignedByName : (signers?.rektor ?? null)}
                    signed={m.rektorSigned}
                    signedAt={m.rektorSignedAt}
                    eriSerial={m.rektorEriSerial}
                    extra={
                      m.registrationNumber ? (
                        <div style={{ marginTop: 8 }}>
                          <Tag color="success" style={{ fontWeight: 600 }}>
                            {m.registrationNumber}
                          </Tag>
                        </div>
                      ) : null
                    }
                  />
                </div>
              ),
            },
          ]}
        />

        {stage ? (
          <div
            style={{
              marginTop: 16,
              border: '1px dashed var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 16,
            }}
          >
            <div style={{ fontSize: 12.5, color: 'var(--color-text-soft)', marginBottom: 10 }}>
              {t(`scientificDepartment.methodical.actionCaption.${stage}`)}
            </div>
            <Space>
              {stage === 'ilmiy' && can('methodicalRecommendation:approve') ? (
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={() => setApproveOpen(true)}
                >
                  {t('scientificDepartment.approve')}
                </Button>
              ) : null}
              {(stage === 'kotib' || stage === 'rektor') &&
              can('methodicalRecommendation:sign') ? (
                <Button
                  type="primary"
                  icon={<SafetyCertificateOutlined />}
                  onClick={() => setSignOpen(true)}
                >
                  {t('scientificDepartment.eri.signAction')}
                </Button>
              ) : null}
              {can('methodicalRecommendation:reject') ? (
                <Button danger icon={<CloseCircleOutlined />} onClick={() => setRejectOpen(true)}>
                  {t('scientificDepartment.reject')}
                </Button>
              ) : null}
            </Space>
          </div>
        ) : null}
      </Card>

      <Modal centered
        title={t('scientificDepartment.methodical.approveTitle')}
        open={approveOpen}
        onCancel={() => setApproveOpen(false)}
        onOk={handleApprove}
        okText={t('scientificDepartment.confirm')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={approveMethodical.isPending}
      >
        <div style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {t('scientificDepartment.methodical.approveBody')}
        </div>
        <DecisionWarning />
      </Modal>

      <EriSignModal
        open={signOpen}
        mode={stage === 'rektor' ? 'rektor' : 'sign'}
        summary={m.title}
        loading={signMethodical.isPending}
        defaultAcademicYear={m.academicYear}
        onCancel={() => setSignOpen(false)}
        onOk={handleSign}
      />

      <Modal centered
        title={t('scientificDepartment.methodical.rejectTitle')}
        open={rejectOpen}
        onCancel={() => {
          setRejectOpen(false);
          setReason('');
        }}
        onOk={handleReject}
        okText={t('scientificDepartment.send')}
        cancelText={t('scientificDepartment.cancel')}
        okButtonProps={{ danger: true }}
        confirmLoading={rejectMethodical.isPending}
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
