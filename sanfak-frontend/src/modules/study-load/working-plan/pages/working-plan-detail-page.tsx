import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  App,
  Button,
  Empty,
  Skeleton,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CloseOutlined,
  FilePdfOutlined,
} from '@ant-design/icons';
import { Can } from '@/app/session';
import { useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import ApproveModal from '../../components/approve-modal';
import RejectModal from '../../components/reject-modal';
import { openPdf } from '../../lib/open-pdf';
import {
  useApproveWorkingSchedule,
  useRejectWorkingSchedule,
  WORKING_SCHEDULE_KEY,
} from '../../working-schedule/api/working-schedule-api';
import { useWorkingPlanGrid } from '../api/working-plan-api';
import type { SemesterData, ParticleLabel, WorkingPlanScience } from '../model/types';
import { useQueryClient } from '@tanstack/react-query';
import { getStatusMeta } from '../../model/status-workflow';

const { Title, Text } = Typography;

interface PlanRow {
  key: string;
  rowType: 'science' | 'total' | 'practice' | 'grandTotal';
  serialNumber?: string | null;
  code?: string | null;
  title?: string | null;
  totalCredit?: number;
  weeklyHours?: number;
  particles?: Record<string, number>;
}

function particleMap(science: WorkingPlanScience): Record<string, number> {
  const map: Record<string, number> = {};
  for (const p of science.particle) {
    map[p.slug] = p.value;
  }
  return map;
}

function totalParticleMap(particles: { slug: string; value: number }[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const p of particles) {
    map[p.slug] = p.value;
  }
  return map;
}

function buildRows(sem: SemesterData, semKey: string, t: (key: string) => string): PlanRow[] {
  const rows: PlanRow[] = [];

  for (const block of sem.blocks) {
    rows.push({
      key: `block-${semKey}-${block.id}`,
      rowType: 'total',
      code: block.title ?? block.blockCode,
      title: null,
      particles: {},
    });

    for (const sci of block.sciences) {
      rows.push({
        key: `sci-${semKey}-${sci.id}`,
        rowType: 'science',
        serialNumber: sci.serialNumber,
        code: sci.code,
        title: sci.title,
        totalCredit: sci.totalCredit,
        weeklyHours: sci.weeklyHours,
        particles: particleMap(sci),
      });
    }
  }

  if (sem.blocksTotal) {
    rows.push({
      key: `blocksTotal-${semKey}`,
      rowType: 'total',
      code: sem.blocksTotal.title ?? t('studyLoad.workingPlan.total'),
      totalCredit: sem.blocksTotal.totalCredit,
      weeklyHours: sem.blocksTotal.weeklyHours,
      particles: totalParticleMap(sem.blocksTotal.particles),
    });
  }

  if (sem.practice) {
    rows.push({
      key: `practice-${semKey}`,
      rowType: 'practice',
      code: sem.practice.title ?? t('studyLoad.workingPlan.practice'),
      totalCredit: sem.practice.credit,
      particles: {},
    });
  }

  if (sem.grandTotal) {
    rows.push({
      key: `grandTotal-${semKey}`,
      rowType: 'grandTotal',
      code: sem.grandTotal.title ?? t('studyLoad.workingPlan.grandTotal'),
      totalCredit: sem.grandTotal.totalCredit,
      weeklyHours: sem.grandTotal.weeklyHours,
      particles: totalParticleMap(sem.grandTotal.particles),
    });
  }

  return rows;
}

interface PlanGridProps {
  semesters: Record<string, SemesterData>;
  semesterNumbers: Record<string, string>;
  particleLabels: ParticleLabel[];
}

const PlanGrid = ({ semesters, semesterNumbers, particleLabels }: PlanGridProps) => {
  const { t } = useTranslation();
  const semKeys = useMemo(
    () => Object.keys(semesters).sort((a, b) => Number(a) - Number(b)),
    [semesters],
  );

  const columns = useMemo(() => {
    const cols = [
      {
        title: '№',
        dataIndex: 'serialNumber',
        key: 'serialNumber',
        width: 50,
        render: (_: unknown, row: PlanRow) =>
          row.rowType === 'science' ? (
            <Text style={{ fontSize: 13 }}>{row.serialNumber ?? ''}</Text>
          ) : null,
      },
      {
        title: t('studyLoad.workingPlan.column.code'),
        dataIndex: 'code',
        key: 'code',
        width: 130,
        render: (_: unknown, row: PlanRow) => {
          if (row.rowType === 'science') {
            return <Text style={{ fontSize: 13 }}>{row.code ?? '—'}</Text>;
          }
          return (
            <Text
              strong={row.rowType === 'total' || row.rowType === 'grandTotal'}
              style={{
                fontSize: 13,
                color:
                  row.rowType === 'grandTotal'
                    ? 'var(--color-text)'
                    : 'var(--color-text-soft)',
              }}
            >
              {row.code ?? ''}
            </Text>
          );
        },
      },
      {
        title: t('studyLoad.workingPlan.column.scienceName'),
        dataIndex: 'title',
        key: 'title',
        render: (_: unknown, row: PlanRow) =>
          row.rowType === 'science' ? (
            <Text style={{ fontSize: 13, fontWeight: 500 }}>
              {row.title ?? '—'}
            </Text>
          ) : null,
      },
      ...particleLabels.map((pl) => ({
        title: pl.title || pl.slug,
        dataIndex: `p_${pl.slug}`,
        key: `p_${pl.slug}`,
        width: 77,
        align: 'center' as const,
        render: (_: unknown, row: PlanRow) => {
          const val = row.particles?.[pl.slug];
          return val !== undefined ? (
            <Text style={{ fontSize: 13 }}>{val}</Text>
          ) : null;
        },
      })),
      {
        title: t('studyLoad.workingPlan.column.credit'),
        dataIndex: 'totalCredit',
        key: 'totalCredit',
        width: 70,
        align: 'center' as const,
        render: (_: unknown, row: PlanRow) =>
          row.totalCredit !== undefined ? (
            <Text style={{ fontSize: 13 }}>{row.totalCredit}</Text>
          ) : null,
      },
      {
        title: t('studyLoad.workingPlan.column.weeklyHours'),
        dataIndex: 'weeklyHours',
        key: 'weeklyHours',
        width: 80,
        align: 'center' as const,
        render: (_: unknown, row: PlanRow) =>
          row.weeklyHours !== undefined ? (
            <Text style={{ fontSize: 13 }}>{row.weeklyHours}</Text>
          ) : null,
      },
    ];
    return cols;
  }, [particleLabels, t]);

  if (semKeys.length === 0) {
    return (
      <Empty
        description={t('studyLoad.workingPlan.gridNotFound')}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {semKeys.map((semKey) => {
        const sem = semesters[semKey];
        if (!sem) return null;
        const rows = buildRows(sem, semKey, t);

        return (
          <div key={semKey}>
            <Title
              level={5}
              style={{
                margin: '0 0 var(--space-3) 0',
                color: 'var(--color-text)',
              }}
            >
              {t('studyLoad.workingPlan.semesterLabel', {
                sem: semesterNumbers[semKey] ?? semKey,
              })}
            </Title>
            <Table<PlanRow>
              dataSource={rows}
              columns={columns}
              rowKey="key"
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
              style={{
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                border: '1px solid var(--color-border)',
              }}
              rowClassName={(row) => {
                if (row.rowType === 'grandTotal') return 'wp-row-grand-total';
                if (row.rowType === 'total') return 'wp-row-total';
                if (row.rowType === 'practice') return 'wp-row-practice';
                return '';
              }}
            />
          </div>
        );
      })}

      <style>{`
        .wp-row-total td { background: var(--color-bg-table-head, #EEF2F6) !important; }
        .wp-row-practice td { background: var(--color-bg-layout, #F8FAFC) !important; }
        .wp-row-grand-total td { background: var(--color-bg-table-head, #EEF2F6) !important; font-weight: 600; }
      `}</style>
    </div>
  );
};

const WorkingPlanDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { message } = App.useApp();
  const showModal = useModalStore((s) => s.showModal);
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState('plan');
  const [pdfLoading, setPdfLoading] = useState(false);

  const { data, isLoading, isError } = useWorkingPlanGrid(id);

  const approveMutation = useApproveWorkingSchedule();
  const rejectMutation = useRejectWorkingSchedule();

  const particleLabels = useMemo(
    () => data?.meta?.particles?.items ?? [],
    [data],
  );

  const handleViewPdf = async () => {
    if (!id) return;
    setPdfLoading(true);
    try {
      await openPdf(`/working-plans/${id}/pdf`, message, t);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleApprove = () => {
    if (!id) return;
    const unfilled = data?.unfilledSlots ?? [];
    const ModalBody = () => (
      <>
        {unfilled.length > 0 ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 'var(--space-3)' }}
            message={t('studyLoad.workingPlan.electiveSlot.unfilledWarning', {
              count: unfilled.length,
            })}
            description={unfilled
              .map((s) =>
                t('studyLoad.workingPlan.electiveSlot.unfilledItem', {
                  sem: s.semKey,
                  serial: s.serialNumber ?? '—',
                  credit: s.credit,
                }),
              )
              .join('; ')}
          />
        ) : null}
        <ApproveModal
          title={t('studyLoad.workingSchedule.approveTitle')}
          onConfirm={async () => {
            const res = await approveMutation.mutateAsync(id);
            void qc.invalidateQueries({ queryKey: [WORKING_SCHEDULE_KEY] });
            message.success(t('studyLoad.workingSchedule.approved'));
            if (res?.warning) message.warning(res.warning, 8);
          }}
          loading={approveMutation.isPending}
        />
      </>
    );
    showModal({
      title: t('studyLoad.workingSchedule.approveTitle'),
      body: ModalBody,
      maxWidth: '460px',
    });
  };

  const handleReject = () => {
    if (!id) return;
    const ModalBody = () => (
      <RejectModal
        title={t('studyLoad.workingSchedule.rejectTitle')}
        onConfirm={async (comment) => {
          await rejectMutation.mutateAsync({ id, comment });
          void qc.invalidateQueries({ queryKey: [WORKING_SCHEDULE_KEY] });
          message.success(t('studyLoad.workingSchedule.rejected'));
        }}
        loading={rejectMutation.isPending}
      />
    );
    showModal({
      title: t('studyLoad.workingSchedule.rejectTitle'),
      body: ModalBody,
      maxWidth: '460px',
    });
  };

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <Empty description={t('studyLoad.workingPlan.notFound')} />
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            {t('studyLoad.common.back')}
          </Button>
        </div>
      </div>
    );
  }

  const displayTitle =
    data.workingScheduleTitle ??
    data.studyPlanLabel ??
    t('studyLoad.workingSchedule.pageTitle');

  const statusMeta = getStatusMeta('draft');

  const tabItems = [
    {
      key: 'plan',
      label: t('studyLoad.workingPlan.plan'),
      children: (
        <PlanGrid
          semesters={data.semesters}
          semesterNumbers={data.semesterNumbers}
          particleLabels={particleLabels}
        />
      ),
    },
    {
      key: 'sciences',
      label: t('studyLoad.workingPlan.sciences'),
      children: (
        <Empty
          description={
            <span>
              {t('studyLoad.workingPlan.sciencesComingSoon')}
            </span>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ),
    },
  ];

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
            {data.studyPlanLabel ? (
              <Text type="secondary" style={{ fontSize: 13 }}>
                {data.studyPlanLabel}
              </Text>
            ) : null}
          </div>
          <Tag color={statusMeta.color} style={{ marginTop: 4 }}>
            {t(statusMeta.labelKey, { defaultValue: statusMeta.label })}
          </Tag>
        </Space>

        <Space>
          <Can perform="workingSchedule:update">
            <Tooltip title={t('studyLoad.approval.action.approve')}>
              <Button
                type="default"
                icon={<CheckOutlined />}
                style={{ color: 'var(--brand-primary)' }}
                onClick={handleApprove}
              >
                {t('studyLoad.approval.action.approve')}
              </Button>
            </Tooltip>
          </Can>

          <Can perform="workingSchedule:update">
            <Tooltip title={t('studyLoad.common.reject')}>
              <Button danger icon={<CloseOutlined />} onClick={handleReject}>
                {t('studyLoad.common.reject')}
              </Button>
            </Tooltip>
          </Can>

          <Can perform="workingPlan:read">
            <Tooltip title={t('studyLoad.common.downloadPdf')}>
              <Button
                icon={<FilePdfOutlined />}
                loading={pdfLoading}
                onClick={() => void handleViewPdf()}
                style={{ color: 'var(--color-text-soft)' }}
              >
                PDF
              </Button>
            </Tooltip>
          </Can>
        </Space>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        style={{ marginTop: 0 }}
      />
    </div>
  );
};

export default WorkingPlanDetailPage;
