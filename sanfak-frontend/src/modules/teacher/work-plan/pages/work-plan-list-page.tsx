import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type ColumnDef } from '@tanstack/react-table';
import { Alert, App, Button, Tooltip, Typography } from 'antd';
import { PlusOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { PageContainer, DataTable, Filters, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { Can, usePermission } from '@/app/session';
import {
  usePersonalPlans,
  useAcademicYearsForSelect,
  useDeletePersonalPlan,
  getApiErrorMessage,
  type PersonalPlansFilter,
} from '../api/work-plan-api';
import type { PersonalPlan, PersonalPlanStatus } from '../model/types';
import StatusBadge from '../../components/status-badge';
import DeleteConfirm from '../../components/delete-confirm';
import GenerateModal from '../components/generate-modal';
import { useMyTeacherProfile } from '../../profile/api/teacher-profile-api';

function buildStatusOptions(
  t: (key: string) => string,
): { label: string; value: PersonalPlanStatus }[] {
  return [
    { label: t('teacher.personalPlan.status.draft'), value: 'draft' },
    { label: t('teacher.personalPlan.status.submitted'), value: 'submitted' },
    { label: t('teacher.personalPlan.status.approved'), value: 'approved' },
    { label: t('teacher.personalPlan.status.rejected'), value: 'rejected' },
    { label: t('teacher.personalPlan.status.completed'), value: 'completed' },
  ];
}

interface IDeleteBodyProps {
  item: PersonalPlan;
}

const PersonalPlanDeleteBody = ({ item }: IDeleteBodyProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const deleteMutation = useDeletePersonalPlan();

  const handleConfirm = async () => {
    try {
      await deleteMutation.mutateAsync(item.id);
      message.success(t('teacher.personalPlan.deleted'));
      hideModal();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  return (
    <DeleteConfirm
      title={t('teacher.personalPlan.deleteConfirmTitle')}
      subtitle={t('teacher.personalPlan.deleteConfirmSubtitle', {
        year: item.academicYearTitle ?? t('teacher.personalPlan.pageTitleSingular'),
      })}
      loading={deleteMutation.isPending}
      onConfirm={() => { void handleConfirm(); }}
    />
  );
};

const PersonalPlanListPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const showModal = useModalStore((s) => s.showModal);
  const statusOptions = useMemo(() => buildStatusOptions(t), [t]);

  const [academicYearFilter, setAcademicYearFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<PersonalPlanStatus | '' | undefined>(undefined);

  const filter: PersonalPlansFilter = useMemo(
    () => ({
      academicYear: academicYearFilter,
      status: statusFilter ?? '',
    }),
    [academicYearFilter, statusFilter],
  );

  const { data: plans = [], isLoading } = usePersonalPlans(filter);
  const { data: academicYears = [] } = useAcademicYearsForSelect();
  const { data: myProfile, isSuccess: profileLoaded } = useMyTeacherProfile();
  const can = usePermission();
  const isBlocked =
    can('personalWorkPlan:update') &&
    profileLoaded &&
    (myProfile === null || myProfile.hrApprovalStatus !== 'approved');
  const blockedStatusLabel = !myProfile
    ? t('teacher.profile.status.newProfileTitle')
    : t(`teacher.profile.status.${myProfile.hrApprovalStatus}`);

  const academicYearOptions = useMemo(
    () => academicYears.map((ay) => ({ label: ay.title, value: ay.id })),
    [academicYears],
  );

  const handleDelete = (item: PersonalPlan) => {
    showModal({
      withHeader: false,
      maxWidth: '460px',
      body: () => <PersonalPlanDeleteBody item={item} />,
    });
  };

  const handleGenerateClick = () => {
    showModal({
      title: t('teacher.personalPlan.generate'),
      body: GenerateModal,
      maxWidth: '420px',
    });
  };

  const columns: ColumnDef<PersonalPlan>[] = [
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
      header: t('teacher.personalPlan.table.academicYear'),
      id: 'academicYear',
      cell: ({ row }) => (
        <strong style={{ color: 'var(--color-text)' }}>
          {row.original.academicYearTitle ?? '—'}
        </strong>
      ),
    },
    {
      header: t('teacher.personalPlan.table.scienceCount'),
      id: 'scienceCount',
      size: 120,
      cell: ({ row }) => (
        <Typography.Text style={{ fontWeight: 500 }}>
          {row.original.scienceCount}
        </Typography.Text>
      ),
    },
    {
      header: t('teacher.personalPlan.table.totalHour'),
      id: 'plannedHour',
      size: 110,
      cell: ({ row }) => (
        <Typography.Text style={{ fontWeight: 500 }}>
          {row.original.plannedHour}
        </Typography.Text>
      ),
    },
    {
      header: t('teacher.personalPlan.table.status'),
      id: 'status',
      size: 150,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      header: t('teacher.personalPlan.table.date'),
      id: 'createdAt',
      size: 120,
      cell: ({ row }) => {
        const raw = row.original.createdAt;
        if (!raw) return <Typography.Text type="secondary">—</Typography.Text>;
        const formatted = new Date(raw).toLocaleDateString('uz-UZ', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        return (
          <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
            {formatted}
          </Typography.Text>
        );
      },
    },
    {
      header: t('teacher.personalPlan.table.actions'),
      id: 'actions',
      size: 110,
      meta: { align: 'right' as const },
      cell: ({ row }) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <Tooltip title={t('teacher.common.view')}>
            <Button
              type="text"
              icon={<EyeOutlined />}
              size="small"
              style={{ color: 'var(--brand-primary)' }}
              onClick={() => navigate(`/teacher/work-plans/${row.original.id}`)}
            />
          </Tooltip>

          <Can perform="personalWorkPlan:delete">
            <Tooltip title={t('teacher.common.delete')}>
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                size="small"
                onClick={() => handleDelete(row.original)}
              />
            </Tooltip>
          </Can>
        </div>
      ),
    },
  ];

  return (
    <PageContainer title={t('teacher.nav.workPlan')}>
      {isBlocked ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 'var(--space-4)' }}
          message={t('teacher.personalPlan.blockedTitle')}
          description={t('teacher.personalPlan.blockedDesc', { status: blockedStatusLabel })}
          action={
            <Button size="small" onClick={() => navigate('/teacher/profile')}>
              {t('teacher.personalPlan.blockedGoToProfile')}
            </Button>
          }
        />
      ) : null}

      <Filters
        hideSearch
        onSearch={() => undefined}
        selects={[
          {
            key: 'academicYear',
            placeholder: t('teacher.personalPlan.filter.allYears'),
            value: academicYearFilter,
            options: academicYearOptions,
            onChange: (v) => setAcademicYearFilter(v),
          },
          {
            key: 'status',
            placeholder: t('teacher.personalPlan.filter.allStatuses'),
            value: statusFilter ?? undefined,
            options: statusOptions,
            onChange: (v) => setStatusFilter((v as PersonalPlanStatus | undefined) ?? ''),
          },
        ]}
        extra={
          <Can perform="personalWorkPlan:create">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleGenerateClick}
              style={{ height: 38 }}
            >
              {t('teacher.personalPlan.generate')}
            </Button>
          </Can>
        }
      />

      <DataTable<PersonalPlan>
        data={plans}
        columns={columns}
        loading={isLoading}
        page={1}
      />
    </PageContainer>
  );
};

export default PersonalPlanListPage;
