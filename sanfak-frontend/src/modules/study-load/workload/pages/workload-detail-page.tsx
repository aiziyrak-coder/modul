import { Alert, App, Button, Empty, Skeleton, Space, Tag, Tooltip, Typography } from 'antd';
import { ArrowLeftOutlined, FilePdfOutlined, ReloadOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Can, usePermission } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import { useRecalculateWorkload, useWorkloadDetail } from '../api/workload-api';
import { openPdf } from '../../lib/open-pdf';
import StatusBadge from '../../components/status-badge';
import SegmentedTabs from '../../components/segmented-tabs';
import WorkloadTable from '../components/workload-table';
import StaffPositionsTable from '../components/staff-positions-table';
import PostApprovalEditBadge from '../components/post-approval-edit-badge';
import NeedsRecalcBadge from '../components/needs-recalc-badge';
import { isWorkloadContentEditable } from '../model/content-editable';
import { isWorkloadSuperseded, workloadVersionLabel } from '../model/versioning';

const { Title, Text } = Typography;

const WorkloadDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { message } = App.useApp();
  const can = usePermission();
  const [pdfLoading, setPdfLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('hours');

  const { data, isLoading, isError } = useWorkloadDetail(id);
  const recalculate = useRecalculateWorkload(id);

  const handlePdf = async () => {
    if (!id) return;
    setPdfLoading(true);
    try {
      await openPdf(`/workloads/${id}/pdf`, message, t);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleRecalculate = async () => {
    try {
      const res = await recalculate.mutateAsync();
      const item = res.results[0];
      if (item?.skipped) {
        message.warning(t('studyLoad.workload.detail.recalculateSkipped'));
      } else if (item?.success) {
        message.success(
          t('studyLoad.workload.detail.recalculateSuccess', { count: item.blocksUpdated ?? 0 }),
        );
      } else {
        message.error(item?.error ?? item?.reason ?? t('studyLoad.workload.detail.recalculateError'));
      }
    } catch (err) {
      message.error(getApiErrorMessage(err));
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <Empty description={t('studyLoad.workload.detail.notFound')} />
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            {t('studyLoad.common.back')}
          </Button>
        </div>
      </div>
    );
  }

  const displayTitle = data.departmentTitle ?? data.title ?? t('studyLoad.workload.pageTitleSingular');
  const canEdit = isWorkloadContentEditable(data.status) && can('workload:update');
  const versionLabel = workloadVersionLabel(data.version);
  const supersededById = data.supersededById;

  return (
    <div style={{ padding: 'var(--space-4) var(--space-6)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 'var(--space-4)',
          flexWrap: 'wrap',
        }}
      >
        <Space size={12} align="start">
          <Button
            icon={<ArrowLeftOutlined />}
            type="text"
            onClick={() => navigate(-1)}
            style={{ marginTop: 2 }}
          />
          <div>
            <Title level={4} style={{ margin: 0, color: 'var(--color-text)' }}>
              {displayTitle}
            </Title>
            {data.academicYearTitle ? (
              <Text type="secondary" style={{ fontSize: 13 }}>
                {data.academicYearTitle}
              </Text>
            ) : null}
          </div>
          {versionLabel ? (
            <Tooltip title={t('studyLoad.workload.version.badgeTooltip')}>
              <Tag style={{ marginInlineEnd: 0 }}>{versionLabel}</Tag>
            </Tooltip>
          ) : null}
          <StatusBadge status={data.status} />
        </Space>

        <Space size={8} wrap>
          <NeedsRecalcBadge needsRecalculation={data.needsRecalculation} />
          {canEdit ? (
            <Can perform="workload:update">
              <Button
                icon={<ReloadOutlined />}
                style={{ height: 38 }}
                loading={recalculate.isPending}
                onClick={() => void handleRecalculate()}
              >
                {t('studyLoad.workload.detail.recalculate')}
              </Button>
            </Can>
          ) : null}
          <Can perform="workload:read">
            <Button
              icon={<FilePdfOutlined />}
              style={{ height: 38 }}
              loading={pdfLoading}
              onClick={() => void handlePdf()}
            >
              {t('studyLoad.workload.viewPdf')}
            </Button>
          </Can>
        </Space>
      </div>

      {isWorkloadSuperseded(data.status) ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 'var(--space-4)' }}
          message={t('studyLoad.workload.version.supersededAlert')}
          action={
            supersededById ? (
              <Button
                size="small"
                type="link"
                onClick={() => navigate(`/study-load/workloads/${supersededById}`)}
              >
                {t('studyLoad.workload.version.openNewVersion')}
              </Button>
            ) : null
          }
        />
      ) : null}

      <PostApprovalEditBadge editedAt={data.lastEditedAfterApprovalAt} />

      <div style={{ marginBottom: 'var(--space-4)' }}>
        <SegmentedTabs
          options={[
            { key: 'hours', label: t('studyLoad.workload.tab.hours') },
            { key: 'staff', label: t('studyLoad.workload.tab.staff') },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {activeTab === 'hours' ? (
        <WorkloadTable workloadId={data.id} rows={data.rows} canEdit={canEdit} />
      ) : (
        <StaffPositionsTable workloadId={data.id} staffPositions={data.staffPositions} canEdit={canEdit} />
      )}
    </div>
  );
};

export default WorkloadDetailPage;
