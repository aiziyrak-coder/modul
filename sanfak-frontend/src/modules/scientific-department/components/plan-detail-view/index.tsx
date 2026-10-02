import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { App, Button, Descriptions, Form, Input, Select, Space, Spin, Steps, Upload } from 'antd';
import Modal from '../scroll-modal';
import type { UploadFile } from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { PageContainer, Card, Flex } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useBackTo } from '../../lib/use-back-to';
import { usePermission } from '@/app/session';
import { getApiErrorMessage } from '@/shared/api';
import { useAcademicYears, type PlanApi } from '../../api/plan-api';

const normFile = (e: UploadFile[] | { fileList: UploadFile[] }): UploadFile[] =>
  Array.isArray(e) ? e : e?.fileList;
import StatusBadge from '../status-badge';
import DecisionWarning from '../decision-warning';
import CompactButtons from '../compact-buttons';
import FileChip from '../file-chip';
import StageDesc from '../stage-desc';
import { useStageActionable } from '../../model/stage-gate';
import { rejecterRoleLabel } from '../../model/rejecter-role';
import type { Plan } from '../../model/types';

function chainSteps(plan: Plan, t: (k: string) => string) {
  const rejectedAtDekan = plan.status === 'rejected' && !plan.dekanApprovedAt;
  const rejectedAtProrektor = plan.status === 'rejected' && !!plan.dekanApprovedAt;

  const dekanDesc = plan.dekanApprovedAt
    ? <StageDesc label={t('scientificDepartment.plans.stageApproved')} date={plan.dekanApprovedAt} />
    : rejectedAtDekan
      ? t('scientificDepartment.status.rejected')
      : plan.status === 'new'
        ? t('scientificDepartment.plans.stageWaiting')
        : '';

  const prorektorDesc = plan.prorektorApprovedAt
    ? <StageDesc label={t('scientificDepartment.plans.stageApproved')} date={plan.prorektorApprovedAt} />
    : rejectedAtProrektor
      ? t('scientificDepartment.status.rejected')
      : plan.status === 'pending'
        ? t('scientificDepartment.plans.stageWaiting')
        : '';

  const current =
    plan.status === 'approved' ? 3 : plan.status === 'pending' || rejectedAtProrektor ? 2 : 1;

  return {
    current,
    status: plan.status === 'rejected' ? ('error' as const) : undefined,
    items: [
      {
        title: t('scientificDepartment.plans.stageKafedra'),
        description: <StageDesc label={plan.createdByName ?? ''} date={plan.date} />,
      },
      { title: t('scientificDepartment.plans.stageDekan'), description: dekanDesc },
      { title: t('scientificDepartment.plans.stageProrektor'), description: prorektorDesc },
    ],
  };
}

export default function PlanDetailView({
  api,
  prefix,
  permSection,
  backTo,
}: {
  api: PlanApi;
  prefix: 'workPlans' | 'annualReports';
  permSection: 'departmentWorkPlan' | 'annualReport';
  backTo: string;
}) {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const goBack = useBackTo(backTo);
  const { message } = App.useApp();
  const { canApprove: canApproveStage, canReject: canRejectStage } =
    useStageActionable(permSection);

  const { data: plan, isLoading } = api.useOne(id);
  const approvePlan = api.useApprove();
  const rejectPlan = api.useReject();

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  const can = usePermission();
  const canUpload = can(`${permSection}:create`);
  const updatePlan = api.useUpdate();
  const { data: academicYears = [] } = useAcademicYears();
  const [form] = Form.useForm();
  const [resubmitOpen, setResubmitOpen] = useState(false);

  const openResubmit = () => {
    if (!plan) return;
    form.setFieldsValue({
      academicYear: plan.academicYearId ?? undefined,
      pdf: plan.fileUrl
        ? [{ uid: 'existing', name: t('scientificDepartment.articles.existingPdf'), status: 'done' as const }]
        : undefined,
    });
    setResubmitOpen(true);
  };

  const handleResubmit = async () => {
    if (!plan) return;
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    const rawFile = values.pdf?.[0]?.originFileObj as File | undefined;
    try {
      await updatePlan.mutateAsync({ id: plan.id, academicYear: values.academicYear, file: rawFile ?? null });
      message.success(t('scientificDepartment.plans.resubmitted'));
      setResubmitOpen(false);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleApprove = async () => {
    if (!plan) return;
    try {
      await approvePlan.mutateAsync(plan.id);
      message.success(t('scientificDepartment.plans.approved'));
      setApproveOpen(false);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleReject = async () => {
    if (!plan) return;
    if (reason.trim().length < 3) {
      message.error(t('scientificDepartment.articles.reasonRequired'));
      return;
    }
    try {
      await rejectPlan.mutateAsync({ id: plan.id, reason: reason.trim() });
      message.success(t('scientificDepartment.plans.rejected'));
      setRejectOpen(false);
      setReason('');
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  if (isLoading || !plan) {
    return (
      <PageContainer title={t(`scientificDepartment.${prefix}.detailTitle`)}>
        <Flex align="center" justify="center" style={{ minHeight: 240 }}>
          <Spin />
        </Flex>
      </PageContainer>
    );
  }

  const steps = chainSteps(plan, t);

  return (
    <CompactButtons>
    <PageContainer title={t(`scientificDepartment.${prefix}.detailTitle`)}>
      <Card size="small">
        <Flex align="center" gap={12} wrap style={{ marginBottom: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={goBack}>
            {t('scientificDepartment.back')}
          </Button>
          <StatusBadge
            status={plan.status}
            reason={plan.rejectionReason}
            rejectedBy={plan.rejectedByName}
          />
          <div style={{ flex: 1 }} />
          {canUpload && plan.status === 'rejected' ? (
            <Button type="primary" icon={<UploadOutlined />} onClick={openResubmit}>
              {t('scientificDepartment.plans.resubmit')}
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
            current={steps.current}
            status={steps.status}
            items={steps.items}
          />
        </div>

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
          <Descriptions.Item label={t('scientificDepartment.articles.colDepartment')}>
            <strong>{plan.departmentName || '—'}</strong>
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.articles.colFaculty')}>
            {plan.facultyName || '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.articles.colAcademicYear')}>
            {plan.academicYearTitle || '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.plans.uploadedBy')}>
            {plan.createdByName || '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.articles.colDate')}>
            {plan.date}
          </Descriptions.Item>
          <Descriptions.Item label={t(`scientificDepartment.${prefix}.file`)}>
            <FileChip url={plan.fileUrl} />
          </Descriptions.Item>
        </Descriptions>

        {plan.status === 'rejected' && plan.rejectionReason ? (
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
              {rejecterRoleLabel(plan.rejectedByRole, t) ? (
                <strong>{rejecterRoleLabel(plan.rejectedByRole, t)}: </strong>
              ) : null}
              {plan.rejectionReason}
            </div>
            {plan.rejectedByName ? (
              <div style={{ fontSize: 12, color: 'var(--color-text-mute)', marginTop: 6 }}>
                {t('scientificDepartment.status.rejectedBy')}: {plan.rejectedByName}
              </div>
            ) : null}
          </div>
        ) : null}

        {canApproveStage(plan.status) || canRejectStage(plan.status) ? (
          <Space style={{ marginTop: 16 }}>
            {canApproveStage(plan.status) ? (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => setApproveOpen(true)}
              >
                {t('scientificDepartment.approve')}
              </Button>
            ) : null}
            {canRejectStage(plan.status) ? (
              <Button danger icon={<CloseCircleOutlined />} onClick={() => setRejectOpen(true)}>
                {t('scientificDepartment.reject')}
              </Button>
            ) : null}
          </Space>
        ) : null}
      </Card>

      <Modal centered
        title={t('scientificDepartment.plans.approveTitle')}
        open={approveOpen}
        onCancel={() => setApproveOpen(false)}
        onOk={handleApprove}
        okText={t('scientificDepartment.confirm')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={approvePlan.isPending}
      >
        <div style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {t('scientificDepartment.plans.approveBody')}
        </div>
        <DecisionWarning />
      </Modal>

      <Modal centered
        title={t('scientificDepartment.plans.rejectTitle')}
        open={rejectOpen}
        onCancel={() => {
          setRejectOpen(false);
          setReason('');
        }}
        onOk={handleReject}
        okText={t('scientificDepartment.send')}
        cancelText={t('scientificDepartment.cancel')}
        okButtonProps={{ danger: true }}
        confirmLoading={rejectPlan.isPending}
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
        title={t('scientificDepartment.plans.resubmitTitle')}
        open={resubmitOpen}
        onCancel={() => setResubmitOpen(false)}
        onOk={handleResubmit}
        okText={t('scientificDepartment.plans.resubmit')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={updatePlan.isPending}
        width={480}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label={t('scientificDepartment.articles.colAcademicYear')}
            name="academicYear"
            rules={[{ required: true, message: t('scientificDepartment.required') }]}
          >
            <Select
              placeholder={t('scientificDepartment.articles.colAcademicYear')}
              options={academicYears.map((y) => ({ value: y.id, label: y.title }))}
            />
          </Form.Item>
          <Form.Item
            label={t('scientificDepartment.plans.file')}
            name="pdf"
            valuePropName="fileList"
            getValueFromEvent={normFile}
          >
            <Upload beforeUpload={() => false} maxCount={1} accept=".pdf">
              <Button icon={<UploadOutlined />}>{t('scientificDepartment.chooseFile')}</Button>
            </Upload>
          </Form.Item>
        </Form>
        <DecisionWarning />
      </Modal>
      <div aria-hidden style={{ flexShrink: 0, height: 'var(--space-6)' }} />
    </PageContainer>
    </CompactButtons>
  );
}
