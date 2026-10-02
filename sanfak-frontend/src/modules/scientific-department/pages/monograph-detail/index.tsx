import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { App, Button, Descriptions, Divider, Form, Input, Result, Space, Spin, Steps, Tabs, Tag, Upload } from 'antd';
import Modal from '../../components/scroll-modal';
import {
  ArrowLeftOutlined,
  BookOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloudUploadOutlined,
  DownloadOutlined,
  FileOutlined,
  FileZipOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import { PageContainer, Card, Flex } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useBackTo } from '../../lib/use-back-to';
import { getApiErrorMessage } from '@/shared/api';
import { usePermission } from '@/app/session';
import {
  useApproveMonograph,
  useDataApproveMonograph,
  useDataRejectMonograph,
  useFillDataMonograph,
  useMonograph,
  useRejectMonograph,
  useSignMonograph,
  useSsvDecisionMonograph,
  useSsvSendMonograph,
  downloadMonographArchive,
} from '../../api/monograph-api';
import StatusBadge from '../../components/status-badge';
import DecisionWarning from '../../components/decision-warning';
import SigCard from '../../components/sig-card';
import TabLabel from '../../components/tab-label';
import { useSigners } from '../../api/reference-api';
import EriSignModal, { type EriSignValues } from '../../components/eri-sign-modal';
import {
  canReceiveSsv,
  canResubmitMonograph,
  canReviewData,
  canSendSsv,
  canTeacherFill,
  getMonographRoleStatus,
  isMonographVisible,
  monographActionStage,
  useSciRole,
} from '../../model/role-status';
import { MONOGRAPH_FILE_SLOTS, type MonographSlot } from '../../model/types';
import { rejecterRoleLabel } from '../../model/rejecter-role';
import CompactButtons from '../../components/compact-buttons';

interface FillFormValues {
  title: string;
  ssvNumber: string;
  ssvDate: dayjs.Dayjs;
  isbn: string;
  publisher: string;
  isbnFile?: UploadFile[];
}

const normFile = (e: UploadFile[] | { fileList: UploadFile[] }): UploadFile[] =>
  Array.isArray(e) ? e : e?.fileList;

export default function MonographDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goBack = useBackTo('/scientific-department/monographs');
  const { message } = App.useApp();
  const can = usePermission();
  const role = useSciRole();

  const { data: m, isLoading } = useMonograph(id);
  const { data: signers } = useSigners();

  const approveMonograph = useApproveMonograph();
  const signMonograph = useSignMonograph();
  const rejectMonograph = useRejectMonograph();
  const ssvSendMonograph = useSsvSendMonograph();
  const ssvDecisionMonograph = useSsvDecisionMonograph();
  const fillDataMonograph = useFillDataMonograph();
  const dataApproveMonograph = useDataApproveMonograph();
  const dataRejectMonograph = useDataRejectMonograph();

  const [approveOpen, setApproveOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [ssvSendOpen, setSsvSendOpen] = useState(false);
  const [ssvDecisionOpen, setSsvDecisionOpen] = useState(false);
  const [ssvRejecting, setSsvRejecting] = useState(false);
  const [dataApproveOpen, setDataApproveOpen] = useState(false);
  const [dataRejectOpen, setDataRejectOpen] = useState(false);
  const [dataRejectReason, setDataRejectReason] = useState('');
  const [archiving, setArchiving] = useState(false);
  const [ssvForm] = Form.useForm<{ responseFile?: UploadFile[]; reason?: string }>();
  const [fillForm] = Form.useForm<FillFormValues>();

  if (isLoading || !m) {
    return (
      <PageContainer title={t('scientificDepartment.monographs.detailTitle')}>
        <Flex align="center" justify="center" style={{ minHeight: 240 }}>
          <Spin />
        </Flex>
      </PageContainer>
    );
  }

  if (!isMonographVisible(m, role)) {
    return (
      <PageContainer title={t('scientificDepartment.monographs.detailTitle')}>
        <Card size="small">
          <Result status="403" subTitle={t('scientificDepartment.notYourStage')} />
        </Card>
      </PageContainer>
    );
  }

  const stage = monographActionStage(m, role);
  const roleStatus = getMonographRoleStatus(m, role);
  const stepCurrent =
    1 +
    (m.ilmiyApproved ? 1 : 0) +
    (m.kotibSigned ? 1 : 0) +
    (m.prorektorSigned ? 1 : 0) +
    (m.ssvSent ? 1 : 0) +
    (m.ssvReceived ? 1 : 0);

  const run = async (fn: () => Promise<unknown>, okMsg: string, close: () => void) => {
    try {
      await fn();
      message.success(okMsg);
      close();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleSign = (values: EriSignValues) =>
    run(
      () => signMonograph.mutateAsync({ id: m.id, eriKey: values.eriKey }),
      t('scientificDepartment.monographs.signed'),
      () => setSignOpen(false),
    );

  const handleReject = async () => {
    if (reason.trim().length < 3) {
      message.error(t('scientificDepartment.articles.reasonRequired'));
      return;
    }
    await run(
      () => rejectMonograph.mutateAsync({ id: m.id, reason: reason.trim() }),
      t('scientificDepartment.monographs.rejected'),
      () => {
        setRejectOpen(false);
        setReason('');
      },
    );
  };

  const handleSsvDecision = async (decision: 'approve' | 'reject') => {
    if (decision === 'reject' && !ssvRejecting) {
      setSsvRejecting(true);
      return;
    }
    const values = await ssvForm.validateFields(
      decision === 'reject' ? ['responseFile', 'reason'] : ['responseFile'],
    );
    const rawFile = values.responseFile?.[0]?.originFileObj as File | undefined;
    if (!rawFile) {
      message.error(t('scientificDepartment.monographs.ssvFileRequired'));
      return;
    }
    await run(
      () =>
        ssvDecisionMonograph.mutateAsync({
          id: m.id,
          decision,
          reason: decision === 'reject' ? values.reason?.trim() : undefined,
          file: rawFile,
        }),
      decision === 'approve'
        ? t('scientificDepartment.monographs.ssvApproved')
        : t('scientificDepartment.monographs.ssvRejected'),
      () => {
        setSsvDecisionOpen(false);
        setSsvRejecting(false);
        ssvForm.resetFields();
      },
    );
  };

  const handleFillData = async () => {
    const values = await fillForm.validateFields();
    const rawFile = values.isbnFile?.[0]?.originFileObj as File | undefined;
    if (!rawFile && !m.isbnFileUrl) {
      message.error(t('scientificDepartment.monographs.isbnFileRequired'));
      return;
    }
    await run(
      () =>
        fillDataMonograph.mutateAsync({
          id: m.id,
          title: values.title,
          ssvNumber: values.ssvNumber,
          ssvDate: values.ssvDate.format('YYYY-MM-DD'),
          isbn: values.isbn,
          publisher: values.publisher,
          isbnFile: rawFile ?? null,
        }),
      t('scientificDepartment.monographs.dataFilled'),
      () => fillForm.resetFields(),
    );
  };

  const handleDataReject = async () => {
    if (dataRejectReason.trim().length < 3) {
      message.error(t('scientificDepartment.articles.reasonRequired'));
      return;
    }
    await run(
      () => dataRejectMonograph.mutateAsync({ id: m.id, reason: dataRejectReason.trim() }),
      t('scientificDepartment.monographs.dataRejected'),
      () => {
        setDataRejectOpen(false);
        setDataRejectReason('');
      },
    );
  };

  const hasAnyFile = MONOGRAPH_FILE_SLOTS.some(
    (cfg) => Boolean(m.files[cfg.slot as MonographSlot]),
  );

  const handleDownloadArchive = async () => {
    setArchiving(true);
    try {
      await downloadMonographArchive(m.id, m.title);
    } catch (err) {
      message.error(getApiErrorMessage(err));
    } finally {
      setArchiving(false);
    }
  };

  const fileChips = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
      {MONOGRAPH_FILE_SLOTS.map((cfg) => {
        const url = m.files[cfg.slot as MonographSlot];
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

  const showTeacherFill = canTeacherFill(m, role) && can('monograph:update');
  const showDataReview = canReviewData(m, role) && can('monograph:approve');

  return (
    <CompactButtons>
    <PageContainer title={t('scientificDepartment.monographs.detailTitle')}>
      <Card size="small">
        <Flex align="center" gap={12} wrap style={{ marginBottom: 16 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={goBack}
          >
            {t('scientificDepartment.back')}
          </Button>
          <StatusBadge
            status={roleStatus}
            reason={m.rejectionReason}
            rejectedBy={m.rejectedByName}
          />
          <div style={{ flex: 1 }} />
          {m.isbn ? (
            <Tag color="success" style={{ fontWeight: 600, borderRadius: 'var(--radius-pill)' }}>
              ISBN: {m.isbn}
            </Tag>
          ) : null}
          {hasAnyFile ? (
            <Button
              icon={<FileZipOutlined />}
              loading={archiving}
              onClick={handleDownloadArchive}
            >
              {t('scientificDepartment.monographs.downloadArchive')}
            </Button>
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
              { title: t('scientificDepartment.methodical.stepTeacher'), description: m.date },
              {
                title: t('scientificDepartment.methodical.stepIlmiy'),
                description: m.ilmiyApprovedAt ?? '—',
              },
              {
                title: t('scientificDepartment.methodical.stepKotib'),
                description: m.kotibSignedAt ?? '—',
              },
              {
                title: t('scientificDepartment.monographs.stepProrektor'),
                description: m.prorektorSignedAt ?? '—',
              },
              {
                title: t('scientificDepartment.monographs.stepSsvSend'),
                icon: m.ssvSent ? undefined : <SendOutlined />,
                description: m.ssvSentAt ?? '—',
              },
              {
                title: t('scientificDepartment.monographs.stepSsvResponse'),
                icon: m.ssvReceived ? undefined : <BookOutlined />,
                description: m.ssvReceivedAt ?? '—',
              },
            ]}
          />
        </div>

        <Tabs
          items={[
            {
              key: 'info',
              label: (
                <TabLabel
                  text={t('scientificDepartment.monographs.tabInfo')}
                  done={m.teacherConfirmed}
                />
              ),
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
                    <Descriptions.Item label={t('scientificDepartment.methodical.colAuthor')}>
                      {m.authorName || '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('scientificDepartment.articles.colFaculty')}>
                      {m.facultyName || '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('scientificDepartment.articles.colDepartment')}>
                      {m.departmentName || '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('scientificDepartment.articles.colDate')}>
                      {m.date}
                    </Descriptions.Item>
                    {m.teacherConfirmed || m.dataApproved ? (
                      <>
                        <Descriptions.Item
                          label={t('scientificDepartment.monographs.monographTitle')}
                        >
                          <strong>{m.title || '—'}</strong>
                        </Descriptions.Item>
                        <Descriptions.Item
                          label={t('scientificDepartment.monographs.ssvNumber')}
                        >
                          {m.ssvNumber || '—'}
                        </Descriptions.Item>
                        <Descriptions.Item label={t('scientificDepartment.monographs.ssvDate')}>
                          {m.ssvDate || '—'}
                        </Descriptions.Item>
                        <Descriptions.Item label="ISBN">{m.isbn || '—'}</Descriptions.Item>
                        <Descriptions.Item
                          label={t('scientificDepartment.monographs.colPublisher')}
                        >
                          {m.publisher || '—'}
                        </Descriptions.Item>
                      </>
                    ) : null}
                  </Descriptions>

                  <Divider style={{ margin: '24px 0 12px', fontSize: 13.5, fontWeight: 600 }}>
                    {t(
                      m.prorektorSigned
                        ? 'scientificDepartment.monographs.approvedDocuments'
                        : 'scientificDepartment.monographs.uploadedFiles',
                    )}
                  </Divider>
                  {fileChips}

                  {showTeacherFill ? (
                    <>
                      <Divider style={{ margin: '20px 0 12px' }}>
                        {t('scientificDepartment.monographs.fillDataTitle')}
                      </Divider>
                      <div
                        style={{
                          background: 'color-mix(in srgb, #0d9488 8%, #fff)',
                          border: '1px solid color-mix(in srgb, #0d9488 25%, #fff)',
                          borderRadius: 'var(--radius-md)',
                          padding: '10px 14px',
                          fontSize: 12.5,
                          color: 'var(--color-text-soft)',
                          marginBottom: 12,
                        }}
                      >
                        {t('scientificDepartment.monographs.fillDataHint')}
                      </div>
                      {m.dataRejectionReason ? (
                        <div
                          style={{
                            background: 'color-mix(in srgb, var(--brand-error) 8%, #fff)',
                            border:
                              '1px solid color-mix(in srgb, var(--brand-error) 25%, #fff)',
                            borderRadius: 'var(--radius-md)',
                            padding: '10px 14px',
                            fontSize: 12.5,
                            color: 'var(--brand-error)',
                            marginBottom: 12,
                          }}
                        >
                          {t('scientificDepartment.monographs.dataRejectedBanner')}:{' '}
                          {m.dataRejectionReason}
                        </div>
                      ) : null}
                      <Form
                        form={fillForm}
                        layout="vertical"
                        requiredMark={false}
                        initialValues={{
                          title: m.title ?? '',
                          ssvNumber: m.ssvNumber ?? '',
                          ssvDate: m.ssvDate ? dayjs(m.ssvDate) : undefined,
                          isbn: m.isbn ?? '',
                          publisher: m.publisher ?? '',
                        }}
                      >
                        <Form.Item
                          label={t('scientificDepartment.monographs.monographTitle')}
                          name="title"
                          rules={[
                            { required: true, message: t('scientificDepartment.required') },
                          ]}
                        >
                          <Input placeholder={t('scientificDepartment.monographs.titlePlaceholder')} />
                        </Form.Item>
                        <div
                          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
                        >
                          <Form.Item
                            label={t('scientificDepartment.monographs.ssvNumber')}
                            name="ssvNumber"
                            rules={[
                              { required: true, message: t('scientificDepartment.required') },
                            ]}
                          >
                            <Input placeholder="SSV-1234" />
                          </Form.Item>
                          <Form.Item
                            label={t('scientificDepartment.monographs.ssvDate')}
                            name="ssvDate"
                            rules={[
                              { required: true, message: t('scientificDepartment.required') },
                            ]}
                          >
                            <DatePicker
                              style={{ width: '100%' }}
                              format="YYYY-MM-DD"
                              placeholder={t('scientificDepartment.monographs.ssvDatePlaceholder')}
                            />
                          </Form.Item>
                          <Form.Item
                            label="ISBN"
                            name="isbn"
                            rules={[
                              { required: true, message: t('scientificDepartment.required') },
                            ]}
                          >
                            <Input placeholder="978-9943-..." />
                          </Form.Item>
                          <Form.Item
                            label={t('scientificDepartment.monographs.colPublisher')}
                            name="publisher"
                            rules={[
                              { required: true, message: t('scientificDepartment.required') },
                            ]}
                          >
                            <Input placeholder={t('scientificDepartment.monographs.publisherPlaceholder')} />
                          </Form.Item>
                        </div>
                        <Form.Item
                          label={t('scientificDepartment.monographs.isbnFile')}
                          name="isbnFile"
                          valuePropName="fileList"
                          getValueFromEvent={normFile}
                          rules={
                            m.isbnFileUrl
                              ? []
                              : [{ required: true, message: t('scientificDepartment.required') }]
                          }
                        >
                          <Upload beforeUpload={() => false} maxCount={1} accept=".pdf">
                            <Button icon={<UploadOutlined />}>
                              {t('scientificDepartment.chooseFile')}
                            </Button>
                          </Upload>
                        </Form.Item>
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--color-text-mute)',
                            marginBottom: 12,
                          }}
                        >
                          {t('scientificDepartment.monographs.authorAutoNote')}: {m.authorName}
                        </div>
                        <Button
                          type="primary"
                          size="large"
                          style={{ background: '#0d9488', borderColor: '#0d9488' }}
                          loading={fillDataMonograph.isPending}
                          onClick={handleFillData}
                        >
                          {t('scientificDepartment.confirm')}
                        </Button>
                      </Form>
                    </>
                  ) : null}

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
                      {canResubmitMonograph(m, role) && can('monograph:update') ? (
                        <Button
                          type="primary"
                          size="small"
                          icon={<ReloadOutlined />}
                          style={{ marginTop: 10 }}
                          onClick={() =>
                            navigate('/scientific-department/monographs', {
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
                  text={t('scientificDepartment.monographs.tabSignatures')}
                  done={m.kotibSigned && m.prorektorSigned}
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
                    signsFileLabel={t('scientificDepartment.files.council')}
                  />
                  <SigCard
                    roleLabel={t('scientificDepartment.monographs.stepProrektor')}
                    signerName={
                      m.prorektorSigned ? m.prorektorSignedByName : (signers?.prorektor ?? null)
                    }
                    signed={m.prorektorSigned}
                    signedAt={m.prorektorSignedAt}
                    eriSerial={m.prorektorEriSerial}
                    signsFileLabel={t('scientificDepartment.files.referral')}
                  />
                </div>
              ),
            },
            {
              key: 'ssv',
              label: (
                <TabLabel text={t('scientificDepartment.monographs.tabSsv')} done={m.ssvReceived} />
              ),
              children: (
                <div
                  style={{
                    background: 'var(--color-bg-elevate)',
                    borderRadius: 'var(--radius-md)',
                    padding: 16,
                  }}
                >
                  {!m.ssvSent ? (
                    <>
                      <div style={{ fontSize: 13, color: 'var(--color-text-soft)' }}>
                        {t('scientificDepartment.monographs.ssvNotSent')}
                      </div>
                      {canSendSsv(m, role) && can('monograph:approve') ? (
                        <Button
                          type="primary"
                          icon={<SendOutlined />}
                          style={{ marginTop: 12 }}
                          onClick={() => setSsvSendOpen(true)}
                        >
                          {t('scientificDepartment.monographs.ssvSendAction')}
                        </Button>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <Tag color="processing" style={{ borderRadius: 'var(--radius-pill)' }}>
                        {t('scientificDepartment.monographs.ssvSentTag')}: {m.ssvSentAt}
                      </Tag>
                      {m.ssvReceived ? (
                        <div style={{ marginTop: 12 }}>
                          <Tag color="success" style={{ borderRadius: 'var(--radius-pill)' }}>
                            {t('scientificDepartment.status.ssvReceived')}: {m.ssvReceivedAt}
                          </Tag>
                          {m.ssvResponseFileUrl ? (
                            <Button
                              size="small"
                              icon={<DownloadOutlined />}
                              style={{ marginLeft: 8 }}
                              onClick={() =>
                                window.open(
                                  m.ssvResponseFileUrl ?? '',
                                  '_blank',
                                  'noopener,noreferrer',
                                )
                              }
                            >
                              {t('scientificDepartment.monographs.ssvResponseFile')}
                            </Button>
                          ) : null}
                          {m.teacherConfirmed || m.dataApproved ? (
                            <Descriptions
                              column={2}
                              size="small"
                              style={{ marginTop: 12 }}
                              items={[
                                {
                                  label: t('scientificDepartment.monographs.ssvNumber'),
                                  children: m.ssvNumber || '—',
                                },
                                {
                                  label: t('scientificDepartment.monographs.ssvDate'),
                                  children: m.ssvDate || '—',
                                },
                                { label: 'ISBN', children: m.isbn || '—' },
                                {
                                  label: t('scientificDepartment.monographs.colPublisher'),
                                  children: m.publisher || '—',
                                },
                              ]}
                            />
                          ) : null}
                        </div>
                      ) : (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontSize: 12.5, color: '#c2410c', marginBottom: 8 }}>
                            {t('scientificDepartment.monographs.ssvAwaitingResponse')}
                          </div>
                          {canReceiveSsv(m, role) && can('monograph:approve') ? (
                            <Button
                              type="primary"
                              icon={<BookOutlined />}
                              style={{ background: '#0d9488', borderColor: '#0d9488' }}
                              onClick={() => setSsvDecisionOpen(true)}
                            >
                              {t('scientificDepartment.monographs.ssvDecisionTitle')}
                            </Button>
                          ) : null}
                        </div>
                      )}
                    </>
                  )}
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
              {t(`scientificDepartment.monographs.actionCaption.${stage}`)}
            </div>
            <Space>
              {stage === 'ilmiy' && can('monograph:approve') ? (
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={() => setApproveOpen(true)}
                >
                  {t('scientificDepartment.approve')}
                </Button>
              ) : null}
              {(stage === 'kotib' || stage === 'prorektor') && can('monograph:sign') ? (
                <Button
                  type="primary"
                  icon={<SafetyCertificateOutlined />}
                  onClick={() => setSignOpen(true)}
                >
                  {t('scientificDepartment.eri.signAction')}
                </Button>
              ) : null}
              {can('monograph:reject') ? (
                <Button danger icon={<CloseCircleOutlined />} onClick={() => setRejectOpen(true)}>
                  {t('scientificDepartment.reject')}
                </Button>
              ) : null}
            </Space>
          </div>
        ) : null}

        {showDataReview ? (
          <div
            style={{
              marginTop: 16,
              border: '1px dashed color-mix(in srgb, #7c3aed 45%, #fff)',
              borderRadius: 'var(--radius-md)',
              padding: 16,
            }}
          >
            <div style={{ fontSize: 12.5, color: 'var(--color-text-soft)', marginBottom: 10 }}>
              {t('scientificDepartment.monographs.dataReviewCaption')}
            </div>
            <Space>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => setDataApproveOpen(true)}
              >
                {t('scientificDepartment.monographs.dataApproveAction')}
              </Button>
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => setDataRejectOpen(true)}
              >
                {t('scientificDepartment.monographs.dataRejectAction')}
              </Button>
            </Space>
          </div>
        ) : null}
      </Card>

      <Modal centered
        title={t('scientificDepartment.monographs.approveTitle')}
        open={approveOpen}
        onCancel={() => setApproveOpen(false)}
        onOk={() =>
          run(
            () => approveMonograph.mutateAsync(m.id),
            t('scientificDepartment.monographs.ilmiyApproved'),
            () => setApproveOpen(false),
          )
        }
        okText={t('scientificDepartment.confirm')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={approveMonograph.isPending}
      >
        <div style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {t('scientificDepartment.monographs.approveBody')}
        </div>
        <DecisionWarning />
      </Modal>

      <EriSignModal
        open={signOpen}
        mode="sign"
        summary={`${m.authorName} · ${m.title ?? t('scientificDepartment.monographs.noTitle')}`}
        loading={signMonograph.isPending}
        onCancel={() => setSignOpen(false)}
        onOk={handleSign}
      />

      <Modal centered
        title={t('scientificDepartment.monographs.rejectTitle')}
        open={rejectOpen}
        onCancel={() => {
          setRejectOpen(false);
          setReason('');
        }}
        onOk={handleReject}
        okText={t('scientificDepartment.send')}
        cancelText={t('scientificDepartment.cancel')}
        okButtonProps={{ danger: true }}
        confirmLoading={rejectMonograph.isPending}
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

      <Modal centered
        title={
          <span>
            <CloudUploadOutlined style={{ color: '#4f46e5', marginRight: 8 }} />
            {t('scientificDepartment.monographs.ssvSendAction')}
          </span>
        }
        open={ssvSendOpen}
        onCancel={() => setSsvSendOpen(false)}
        onOk={() =>
          run(
            () => ssvSendMonograph.mutateAsync(m.id),
            t('scientificDepartment.monographs.ssvSentMsg'),
            () => setSsvSendOpen(false),
          )
        }
        okText={t('scientificDepartment.send')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={ssvSendMonograph.isPending}
      >
        <div style={{ color: 'var(--color-text-soft)', fontSize: 12.5 }}>
          {t('scientificDepartment.monographs.ssvSendBody')}
        </div>
        <DecisionWarning />
      </Modal>

      <Modal centered
        title={t('scientificDepartment.monographs.ssvDecisionTitle')}
        open={ssvDecisionOpen}
        onCancel={() => {
          setSsvDecisionOpen(false);
          setSsvRejecting(false);
          ssvForm.resetFields();
        }}
        width={480}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setSsvDecisionOpen(false);
              setSsvRejecting(false);
              ssvForm.resetFields();
            }}
          >
            {t('scientificDepartment.cancel')}
          </Button>,
          <Button
            key="reject"
            danger
            loading={ssvRejecting && ssvDecisionMonograph.isPending}
            onClick={() => handleSsvDecision('reject')}
          >
            {t('scientificDepartment.reject')}
          </Button>,
          <Button
            key="approve"
            type="primary"
            style={{ background: '#0d9488', borderColor: '#0d9488' }}
            loading={!ssvRejecting && ssvDecisionMonograph.isPending}
            onClick={() => handleSsvDecision('approve')}
          >
            {t('scientificDepartment.approve')}
          </Button>,
        ]}
      >
        <Form form={ssvForm} layout="vertical">
          <Form.Item
            label={t('scientificDepartment.monographs.ssvResponseFile')}
            name="responseFile"
            valuePropName="fileList"
            getValueFromEvent={normFile}
            rules={[{ required: true, message: t('scientificDepartment.required') }]}
          >
            <Upload beforeUpload={() => false} maxCount={1} accept=".pdf">
              <Button icon={<UploadOutlined />}>{t('scientificDepartment.chooseFile')}</Button>
            </Upload>
          </Form.Item>
          {ssvRejecting ? (
            <Form.Item
              label={t('scientificDepartment.rejectReason')}
              name="reason"
              rules={[{ required: true, message: t('scientificDepartment.required') }]}
            >
              <Input.TextArea
                rows={3}
                placeholder={t('scientificDepartment.rejectReasonPlaceholder')}
              />
            </Form.Item>
          ) : null}
        </Form>
        <DecisionWarning />
      </Modal>

      <Modal centered
        title={t('scientificDepartment.monographs.dataApproveAction')}
        open={dataApproveOpen}
        onCancel={() => setDataApproveOpen(false)}
        onOk={() =>
          run(
            () => dataApproveMonograph.mutateAsync(m.id),
            t('scientificDepartment.monographs.dataApproved'),
            () => setDataApproveOpen(false),
          )
        }
        okText={t('scientificDepartment.confirm')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={dataApproveMonograph.isPending}
      >
        <div
          style={{
            background: 'color-mix(in srgb, #7c3aed 8%, #fff)',
            border: '1px solid color-mix(in srgb, #7c3aed 25%, #fff)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: 8,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 13 }}>{m.title || '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-mute)', marginTop: 4 }}>
            ISBN: {m.isbn || '—'} · {m.publisher || '—'}
          </div>
        </div>
        <div style={{ color: 'var(--color-text-soft)', fontSize: 12.5 }}>
          {t('scientificDepartment.monographs.dataApproveBody')}
        </div>
        <DecisionWarning />
      </Modal>

      <Modal centered
        title={t('scientificDepartment.monographs.dataRejectAction')}
        open={dataRejectOpen}
        onCancel={() => {
          setDataRejectOpen(false);
          setDataRejectReason('');
        }}
        onOk={handleDataReject}
        okText={t('scientificDepartment.send')}
        cancelText={t('scientificDepartment.cancel')}
        okButtonProps={{ danger: true }}
        confirmLoading={dataRejectMonograph.isPending}
      >
        <div style={{ color: 'var(--brand-error)', fontSize: 12.5, marginBottom: 10 }}>
          {t('scientificDepartment.monographs.dataRejectBody')}
        </div>
        <Form layout="vertical">
          <Form.Item label={t('scientificDepartment.rejectReason')} required>
            <Input.TextArea
              rows={3}
              value={dataRejectReason}
              onChange={(e) => setDataRejectReason(e.target.value)}
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
