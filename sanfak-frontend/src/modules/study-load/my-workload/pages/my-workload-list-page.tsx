import { useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { App, Button, Empty, Space, Tag, Tooltip, Typography } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  FilePdfOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { PageContainer, DataTable, Filters, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useMyWorkloads } from '../api/my-workload-api';
import { flattenToRows } from '../api/mapper';
import { canRejectWorkload, canRespondToWorkload } from '../model/can-respond';
import type { MyWorkloadRow } from '../model/types';
import StatusBadge from '../../components/status-badge';
import { classTypeSlugsLabel } from '../../lib/class-type-slugs';
import AcceptModal from '../components/accept-modal';
import RejectModal from '../components/reject-modal';
import { openPdf } from '../../lib/open-pdf';

function buildAcceptanceFilterOptions(t: (key: string) => string) {
  return [
    { label: t('studyLoad.myWorkload.filter.all'), value: '' },
    { label: t('studyLoad.myWorkload.filter.pending'), value: 'pending' },
    { label: t('studyLoad.myWorkload.filter.accepted'), value: 'accepted' },
    { label: t('studyLoad.myWorkload.filter.rejected'), value: 'rejected' },
  ];
}

const CLASS_TYPE_LABEL_KEYS: Record<string, string> = {
  lecture: 'studyLoad.myWorkload.classType.lecture',
  clinical_practice: 'studyLoad.myWorkload.classType.clinicalPractice',
  seminar: 'studyLoad.myWorkload.classType.seminar',
  lab_training: 'studyLoad.myWorkload.classType.labTraining',
  practical: 'studyLoad.myWorkload.classType.practical',
  student_work: 'studyLoad.myWorkload.classType.studentWork',
  yan: 'studyLoad.myWorkload.classType.yan',
  missed_lesson: 'studyLoad.myWorkload.classType.missedLesson',
  skilled_practice: 'studyLoad.myWorkload.classType.skilledPractice',
  special: 'studyLoad.myWorkload.classType.special',
  participation: 'studyLoad.myWorkload.classType.participation',
  reception: 'studyLoad.myWorkload.classType.reception',
  consulting: 'studyLoad.myWorkload.classType.consulting',
  open_department: 'studyLoad.myWorkload.classType.openDepartment',
  open_integral: 'studyLoad.myWorkload.classType.openIntegral',
};

function classTypeLabel(t: (key: string) => string, type: string | null): string {
  if (!type) return '—';
  const key = CLASS_TYPE_LABEL_KEYS[type];
  return key ? t(key) : type;
}

const MyWorkloadListPage = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const showModal = useModalStore((s) => s.showModal);
  const acceptanceFilterOptions = useMemo(() => buildAcceptanceFilterOptions(t), [t]);

  const [acceptanceFilter, setAcceptanceFilter] = useState<string>('');
  const [academicYearFilter, setAcademicYearFilter] = useState<string>('');
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);

  const { data: distributions = [], isLoading } = useMyWorkloads();

  const rows = useMemo(() => {
    const all = flattenToRows(distributions);
    return all.filter((row) => {
      const byAcceptance =
        acceptanceFilter === '' || row.acceptanceStatus === acceptanceFilter;
      const byYear =
        academicYearFilter === '' || (row.academicYearTitle ?? '') === academicYearFilter;
      return byAcceptance && byYear;
    });
  }, [distributions, acceptanceFilter, academicYearFilter]);

  const academicYearOptions = useMemo(() => {
    const allRows = flattenToRows(distributions);
    const unique = Array.from(
      new Set(allRows.map((r) => r.academicYearTitle ?? '').filter(Boolean)),
    );
    return [
      { label: t('studyLoad.myWorkload.filter.allYears'), value: '' },
      ...unique.map((y) => ({ label: y, value: y })),
    ];
  }, [distributions, t]);

  const handleOpenPdf = async (distributionId: string) => {
    setPdfLoadingId(distributionId);
    try {
      await openPdf(`/distributions/${distributionId}/pdf`, message, t);
    } finally {
      setPdfLoadingId(null);
    }
  };

  const handleAccept = (row: MyWorkloadRow) => {
    const { distributionId, teacherEntryId, scienceName, blockId } = row;
    if (blockId === null) return;
    const recordName = scienceName ?? undefined;
    const ModalBody = () => (
      <AcceptModal
        distributionId={distributionId}
        teacherEntryId={teacherEntryId}
        blockIds={[blockId]}
        recordName={recordName}
      />
    );
    showModal({
      title: t('studyLoad.myWorkload.acceptTitle'),
      body: ModalBody,
      maxWidth: '545px',
    });
  };

  const handleReject = (row: MyWorkloadRow) => {
    const { distributionId, teacherEntryId, scienceName, blockId } = row;
    if (blockId === null) return;
    const recordName = scienceName ?? undefined;
    const ModalBody = () => (
      <RejectModal
        distributionId={distributionId}
        teacherEntryId={teacherEntryId}
        blockIds={[blockId]}
        recordName={recordName}
      />
    );
    showModal({
      title: t('studyLoad.myWorkload.rejectTitle'),
      body: ModalBody,
      maxWidth: '545px',
    });
  };

  const columns: ColumnDef<MyWorkloadRow>[] = [
    {
      header: '#',
      id: 'index',
      size: 48,
      cell: ({ row }) => (
        <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {row.index + 1}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.myWorkload.column.science'),
      id: 'science',
      cell: ({ row }) => (
        <strong style={{ color: 'var(--color-text)' }}>
          {row.original.scienceName ?? '—'}
          {row.original.classTypeSlugs.length > 0
            ? ` (${classTypeSlugsLabel(t, row.original.classTypeSlugs)})`
            : null}
        </strong>
      ),
    },
    {
      header: t('studyLoad.myWorkload.column.course'),
      id: 'course',
      size: 80,
      cell: ({ row }) => (
        <Typography.Text style={{ fontWeight: 500 }}>
          {row.original.course > 0 ? t('studyLoad.common.courseN', { n: row.original.course }) : '—'}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.myWorkload.column.totalHour'),
      id: 'totalHour',
      size: 110,
      cell: ({ row }) => (
        <Typography.Text style={{ fontWeight: 500 }}>
          {row.original.blockTotalHour}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.myWorkload.column.academicYear'),
      id: 'academicYear',
      size: 130,
      cell: ({ row }) => (
        <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {row.original.academicYearTitle ?? '—'}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.myWorkload.column.date'),
      id: 'date',
      size: 120,
      cell: ({ row }) => (
        <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {row.original.date ?? '—'}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.myWorkload.column.semester'),
      id: 'semester',
      size: 90,
      cell: ({ row }) => (
        <Typography.Text style={{ fontSize: 13 }}>
          {row.original.semester > 0 ? t('studyLoad.common.semesterN', { n: row.original.semester }) : '—'}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.myWorkload.column.type'),
      id: 'type',
      size: 110,
      cell: ({ row }) => (
        <Typography.Text style={{ fontSize: 13 }}>
          {classTypeLabel(t, row.original.type)}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.myWorkload.column.status'),
      id: 'status',
      size: 150,
      cell: ({ row }) => {
        const item = row.original;
        const accStatus = item.acceptanceStatus;
        const statusKey = accStatus === 'accepted' ? 'approved' : accStatus === 'rejected' ? 'rejected' : 'draft';
        const badge = <StatusBadge status={statusKey} />;
        return accStatus === 'rejected' && item.rejectionReason ? (
          <Tooltip title={item.rejectionReason} placement="topLeft">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'help' }}>
              {badge}
              <InfoCircleOutlined style={{ color: 'var(--brand-error, #f04438)', fontSize: 13 }} />
            </span>
          </Tooltip>
        ) : (
          badge
        );
      },
    },
    {
      header: t('studyLoad.myWorkload.column.distributionStatus'),
      id: 'distributionStatus',
      size: 150,
      cell: ({ row }) => {
        const ds = row.original.distributionStatus;
        const colorMap: Record<string, string> = {
          draft: 'blue',
          in_review: 'orange',
          approved: 'success',
          rejected: 'error',
        };
        const labelMap: Record<string, string> = {
          draft: t('studyLoad.distribution.status.draft'),
          in_review: t('studyLoad.distribution.status.inReview'),
          approved: t('studyLoad.distribution.status.approved'),
          rejected: t('studyLoad.distribution.status.rejected'),
        };
        return row.original.superseded ? (
          <Tooltip title={t('studyLoad.myWorkload.supersededHint')}>
            <Tag color="default">{t('studyLoad.summary.status.superseded')}</Tag>
          </Tooltip>
        ) : (
          <Tag color={colorMap[ds] ?? 'default'}>
            {labelMap[ds] ?? ds}
          </Tag>
        );
      },
    },
    {
      header: t('studyLoad.distribution.column.actions'),
      id: 'actions',
      size: 300,
      meta: { align: 'right' as const },
      cell: ({ row }) => {
        const item = row.original;
        const canRespond = canRespondToWorkload(item);
        const canReject = canRejectWorkload(item);
        return (
          <Space size={4}>
            {canRespond ? (
              <>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  size="small"
                  onClick={() => handleAccept(item)}
                >
                  {t('studyLoad.approval.action.approve')}
                </Button>
                {canReject ? (
                  <Button
                    danger
                    type="primary"
                    icon={<CloseOutlined />}
                    size="small"
                    onClick={() => handleReject(item)}
                  >
                    {t('studyLoad.approval.action.reject')}
                  </Button>
                ) : null}
              </>
            ) : null}
            <Button
              type="text"
              icon={<FilePdfOutlined />}
              size="small"
              title={t('studyLoad.myWorkload.viewPdf')}
              style={{ color: 'var(--color-text-soft)' }}
              loading={pdfLoadingId === item.distributionId}
              disabled={pdfLoadingId !== null && pdfLoadingId !== item.distributionId}
              onClick={() => void handleOpenPdf(item.distributionId)}
            />
          </Space>
        );
      },
    },
  ];

  return (
    <PageContainer title={t('studyLoad.nav.myWorkload')}>
      <Filters
        hideSearch
        onSearch={() => undefined}
        selects={[
          {
            key: 'acceptance',
            placeholder: t('studyLoad.myWorkload.filter.all'),
            value: acceptanceFilter || undefined,
            options: acceptanceFilterOptions.slice(1),
            onChange: (v) => setAcceptanceFilter(v ?? ''),
          },
          {
            key: 'academicYear',
            placeholder: t('studyLoad.myWorkload.filter.allYears'),
            value: academicYearFilter || undefined,
            options: academicYearOptions.slice(1),
            onChange: (v) => setAcademicYearFilter(v ?? ''),
          },
        ]}
      />

      {!isLoading && rows.length === 0 ? (
        <Empty
          description={t('studyLoad.myWorkload.empty')}
          style={{ padding: 'var(--space-8) 0' }}
        />
      ) : (
        <DataTable<MyWorkloadRow>
          data={rows}
          columns={columns}
          loading={isLoading}
          page={1}
        />
      )}
    </PageContainer>
  );
};

export default MyWorkloadListPage;
