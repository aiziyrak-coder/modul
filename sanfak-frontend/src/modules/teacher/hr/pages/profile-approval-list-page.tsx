import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type ColumnDef } from '@tanstack/react-table';
import { App, Button, Tooltip, Typography } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { PageContainer, DataTable, Filters, useModalStore, phoneToDisplay } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { Can } from '@/app/session';
import {
  useHrProfiles,
  useApproveHrProfile,
  useRejectHrProfile,
  getApiErrorMessage,
  type HrProfilesFilter,
} from '../api/hr-api';
import type { HrProfileListItem } from '../model/types';
import { formatSubmittedDate } from '../model/helper';
import HrStatusBadge from '../components/hr-status-badge';
import RejectModal from '../components/reject-modal';
import ApproveConfirm from '../components/approve-confirm';
import { useDepartmentsForSelect } from '../../profile/api/teacher-profile-api';

function buildStatusOptions(t: (key: string) => string) {
  return [
    { label: t('teacher.hr.status.pending'), value: 'pending' },
    { label: t('teacher.hr.status.approved'), value: 'approved' },
    { label: t('teacher.hr.status.rejected'), value: 'rejected' },
  ];
}

const ProfileApprovalListPage = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const showModal = useModalStore((s) => s.showModal);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [departmentFilter, setDepartmentFilter] = useState<string | undefined>(undefined);

  const statusOptions = useMemo(() => buildStatusOptions(t), [t]);
  const { data: departments = [] } = useDepartmentsForSelect();
  const departmentOptions = useMemo(
    () => departments.map((d) => ({ label: d.title, value: d.id })),
    [departments],
  );

  const filter: HrProfilesFilter = useMemo(
    () => ({ page, limit: pageSize, hrApprovalStatus: statusFilter, department: departmentFilter }),
    [page, pageSize, statusFilter, departmentFilter],
  );

  const { data, isLoading } = useHrProfiles(filter);
  const approveMutation = useApproveHrProfile();
  const rejectMutation = useRejectHrProfile();

  const handleApprove = (item: HrProfileListItem) => {
    showModal({
      withHeader: false,
      maxWidth: '460px',
      body: () => (
        <ApproveConfirm
          loading={approveMutation.isPending}
          onConfirm={async () => {
            try {
              await approveMutation.mutateAsync({ id: item.id });
              message.success(t('teacher.hr.approve.success'));
              useModalStore.getState().hideModal();
            } catch (err) {
              message.error(getApiErrorMessage(err));
            }
          }}
        />
      ),
    });
  };

  const handleReject = (item: HrProfileListItem) => {
    showModal({
      title: t('teacher.hr.reject.title'),
      maxWidth: '460px',
      body: () => (
        <RejectModal
          teacherName={item.fullName}
          loading={rejectMutation.isPending}
          onConfirm={async (comment) => {
            try {
              await rejectMutation.mutateAsync({ id: item.id, comment });
              message.success(t('teacher.hr.reject.success'));
              useModalStore.getState().hideModal();
            } catch (err) {
              message.error(getApiErrorMessage(err));
            }
          }}
        />
      ),
    });
  };

  const columns: ColumnDef<HrProfileListItem>[] = [
    {
      header: t('teacher.hr.column.fullName'),
      id: 'fullName',
      cell: ({ row }) => (
        <strong style={{ color: 'var(--color-text)' }}>{row.original.fullName || '—'}</strong>
      ),
    },
    {
      header: t('teacher.hr.column.position'),
      id: 'position',
      cell: ({ row }) => row.original.positionTitle ?? '—',
    },
    {
      header: t('teacher.hr.column.department'),
      id: 'department',
      cell: ({ row }) => row.original.departmentTitle ?? '—',
    },
    {
      header: t('teacher.hr.column.phone'),
      id: 'phone',
      cell: ({ row }) => phoneToDisplay(row.original.phone) || '—',
    },
    {
      header: t('teacher.hr.column.submittedAt'),
      id: 'submittedAt',
      size: 120,
      cell: ({ row }) => (
        <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {formatSubmittedDate(row.original.submittedAt)}
        </Typography.Text>
      ),
    },
    {
      header: t('teacher.hr.column.status'),
      id: 'status',
      size: 160,
      cell: ({ row }) => (
        <HrStatusBadge status={row.original.hrApprovalStatus} comment={row.original.hrComment} />
      ),
    },
    {
      header: t('actions'),
      id: 'actions',
      size: 180,
      meta: { align: 'right' as const },
      cell: ({ row }) => {
        const item = row.original;
        const isPending = item.hrApprovalStatus === 'pending';
        return (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
            {isPending ? (
              <Can perform="teacher:approve">
                <Tooltip title={t('teacher.hr.action.approve')}>
                  <Button
                    type="text"
                    icon={<CheckCircleOutlined />}
                    size="small"
                    style={{ color: 'var(--brand-primary)' }}
                    onClick={() => handleApprove(item)}
                  />
                </Tooltip>
              </Can>
            ) : null}
            {isPending ? (
              <Can perform="teacher:reject">
                <Tooltip title={t('teacher.hr.action.reject')}>
                  <Button
                    type="text"
                    danger
                    icon={<CloseCircleOutlined />}
                    size="small"
                    onClick={() => handleReject(item)}
                  />
                </Tooltip>
              </Can>
            ) : null}
            <Tooltip title={t('teacher.hr.action.view')}>
              <Button
                type="text"
                icon={<EyeOutlined />}
                size="small"
                onClick={() => navigate(`/teacher/hr/profiles/${item.id}`)}
              />
            </Tooltip>
          </div>
        );
      },
    },
  ];

  return (
    <PageContainer title={t('teacher.hr.pageTitle')}>
      <Filters
        hideSearch
        onSearch={() => undefined}
        selects={[
          {
            key: 'status',
            placeholder: t('teacher.hr.filter.allStatuses'),
            value: statusFilter,
            options: statusOptions,
            onChange: (v) => {
              setStatusFilter(v);
              setPage(1);
            },
          },
          {
            key: 'department',
            placeholder: t('teacher.hr.filter.allDepartments'),
            value: departmentFilter,
            options: departmentOptions,
            onChange: (v) => {
              setDepartmentFilter(v);
              setPage(1);
            },
          },
        ]}
      />

      <DataTable<HrProfileListItem>
        data={data?.items ?? []}
        columns={columns}
        loading={isLoading}
        page={page}
        pageSize={pageSize}
        total={data?.meta.total}
        onPageChange={(p) => setPage(p)}
        pageSizeOptions={[12, 24, 36, 48]}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </PageContainer>
  );
};

export default ProfileApprovalListPage;
