import { isSafeLink } from '../../model/safe-link';
import { Table, Tag, Tooltip, Typography, Button, Empty } from 'antd';
import {
  CheckOutlined,
  DeleteOutlined,
  EditOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  RedoOutlined,
} from '@ant-design/icons';
import { Can } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import type { WorkItem, WorkItemStatus, VerificationStatus } from '../../model/types';
import { canSubmitEvidence, isEvidenceResubmit } from '../../model/evidence-submit';

const { Text } = Typography;

const WORK_ITEM_STATUS_COLORS: Record<WorkItemStatus, string> = {
  planned: 'blue',
  completed: 'success',
  overdue: 'error',
  cancelled: 'default',
};

const VERIFICATION_COLORS: Record<VerificationStatus, string> = {
  pending: 'blue',
  approved: 'success',
  rejected: 'error',
};

function buildStatusLabels(t: (key: string) => string): Record<WorkItemStatus, string> {
  return {
    planned: t('teacher.personalPlan.workStatus.planned'),
    completed: t('teacher.personalPlan.workStatus.completed'),
    overdue: t('teacher.personalPlan.workStatus.overdue'),
    cancelled: t('teacher.personalPlan.workStatus.cancelled'),
  };
}

function buildVerificationLabels(t: (key: string) => string): Record<VerificationStatus, string> {
  return {
    pending: t('teacher.personalPlan.verification.pending'),
    approved: t('teacher.personalPlan.verification.approved'),
    rejected: t('teacher.personalPlan.verification.rejected'),
  };
}

function Dash() {
  return <Text type="secondary">—</Text>;
}

function SemesterCell({ item, semesterNum, field }: { item: WorkItem; semesterNum: 1 | 2; field: 'plannedCount' | 'actualCount' }) {
  if (!item.semester.includes(semesterNum)) return <Dash />;
  return <span>{item[field] ?? 0}</span>;
}

interface IProps {
  items: WorkItem[];
  showVenueColumn?: boolean;
  showLinkColumn?: boolean;
  disabled?: boolean;
  canComplete: boolean;
  onEdit: (item: WorkItem) => void;
  onDelete: (item: WorkItem) => void;
  onComplete: (item: WorkItem) => void;
}

const ActivityTable = ({
  items,
  showVenueColumn = false,
  showLinkColumn = false,
  disabled = false,
  canComplete,
  onEdit,
  onDelete,
  onComplete,
}: IProps) => {
  const { t } = useTranslation();
  const statusLabels = buildStatusLabels(t);
  const verificationLabels = buildVerificationLabels(t);

  if (items.length === 0) {
    return (
      <Empty
        description={t('teacher.common.noData')}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        style={{ padding: '32px 0' }}
      />
    );
  }

  const columns = [
    {
      title: '#',
      key: 'index',
      width: 44,
      render: (_value: unknown, _record: WorkItem, index: number) => (
        <Text type="secondary" style={{ fontSize: 13 }}>
          {index + 1}
        </Text>
      ),
    },
    {
      title: t('teacher.personalPlan.table.title'),
      dataIndex: 'title',
      key: 'title',
      render: (v: string) => <strong>{v}</strong>,
    },
    {
      title: t('teacher.personalPlan.semester.1short'),
      children: [
        {
          title: t('teacher.personalPlan.table.planned'),
          key: 'kuzgiPlanned',
          width: 84,
          render: (_v: unknown, r: WorkItem) => <SemesterCell item={r} semesterNum={1} field="plannedCount" />,
        },
        {
          title: t('teacher.personalPlan.table.actual'),
          key: 'kuzgiActual',
          width: 84,
          render: (_v: unknown, r: WorkItem) => <SemesterCell item={r} semesterNum={1} field="actualCount" />,
        },
      ],
    },
    {
      title: t('teacher.personalPlan.semester.2short'),
      children: [
        {
          title: t('teacher.personalPlan.table.planned'),
          key: 'bahorgiPlanned',
          width: 84,
          render: (_v: unknown, r: WorkItem) => <SemesterCell item={r} semesterNum={2} field="plannedCount" />,
        },
        {
          title: t('teacher.personalPlan.table.actual'),
          key: 'bahorgiActual',
          width: 84,
          render: (_v: unknown, r: WorkItem) => <SemesterCell item={r} semesterNum={2} field="actualCount" />,
        },
      ],
    },
    {
      title: t('teacher.personalPlan.form.field.deadline'),
      dataIndex: 'deadline',
      key: 'deadline',
      width: 110,
      render: (v: string | null) => (v ? new Date(v).toLocaleDateString('uz-UZ') : <Dash />),
    },
    ...(showVenueColumn
      ? [
          {
            title: t('teacher.personalPlan.form.field.venue'),
            dataIndex: 'venue',
            key: 'venue',
            render: (v: string | null) => v ?? <Dash />,
          },
        ]
      : []),
    ...(showLinkColumn
      ? [
          {
            title: t('teacher.personalPlan.table.link'),
            dataIndex: 'link',
            key: 'link',
            render: (v: string | null) => {
              if (!v) return <Dash />;
              return isSafeLink(v) ? (
                <a href={v} target="_blank" rel="noreferrer">
                  <LinkOutlined /> {t('teacher.personalPlan.table.linkOpen')}
                </a>
              ) : (
                <Text type="secondary">{v}</Text>
              );
            },
          },
        ]
      : []),
    {
      title: t('teacher.personalPlan.table.status'),
      key: 'status',
      width: 130,
      render: (_v: unknown, r: WorkItem) => (
        <Tag color={WORK_ITEM_STATUS_COLORS[r.status] ?? 'default'}>{statusLabels[r.status] ?? r.status}</Tag>
      ),
    },
    {
      title: t('teacher.personalPlan.table.verification'),
      key: 'verification',
      width: 150,
      render: (_v: unknown, r: WorkItem) => {
        if (!r.verification) return <Dash />;
        const tag = (
          <Tag color={VERIFICATION_COLORS[r.verification.status]}>
            {verificationLabels[r.verification.status]}
          </Tag>
        );
        if (r.verification.status === 'rejected' && r.verification.comment) {
          return (
            <Tooltip title={r.verification.comment}>
              {tag} <InfoCircleOutlined style={{ color: 'var(--brand-error)' }} />
            </Tooltip>
          );
        }
        return tag;
      },
    },
    {
      title: t('teacher.personalPlan.table.actions'),
      key: 'actions',
      width: 120,
      render: (_v: unknown, r: WorkItem) => (
        <Can perform="personalWorkPlan:update">
          <div style={{ display: 'flex', gap: 2 }}>
            {canComplete && canSubmitEvidence(r) ? (
              <Tooltip
                title={t(
                  isEvidenceResubmit(r)
                    ? 'teacher.personalPlan.complete.resubmit'
                    : 'teacher.personalPlan.complete.action',
                )}
              >
                <Button
                  type="text"
                  size="small"
                  icon={isEvidenceResubmit(r) ? <RedoOutlined /> : <CheckOutlined />}
                  disabled={disabled}
                  style={{ color: 'var(--brand-success, #37CB94)' }}
                  onClick={() => onComplete(r)}
                />
              </Tooltip>
            ) : null}
            <Tooltip title={t('edit')}>
              <Button type="text" size="small" icon={<EditOutlined />} disabled={disabled} onClick={() => onEdit(r)} />
            </Tooltip>
            <Tooltip title={t('delete')}>
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                disabled={disabled}
                onClick={() => onDelete(r)}
              />
            </Tooltip>
          </div>
        </Can>
      ),
    },
  ];

  return (
    <Table<WorkItem>
      dataSource={items}
      columns={columns}
      rowKey="id"
      pagination={false}
      size="small"
      scroll={{ x: 900 }}
      style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}
    />
  );
};

export default ActivityTable;
