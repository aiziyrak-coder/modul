import { useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { Alert, App, Button, Tooltip, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { BarChartOutlined, DeleteOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { PageContainer, DataTable, Filters, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import { usePermission, useSessionStore } from '@/app/session';
import DeleteConfirm from '../../components/delete-confirm';
import { useAcademicYearsRef, useDepartmentsRef } from '../../workload/api/workload-api';
import {
  useDeleteDeptContingent,
  useDeptContingents,
  type DeptContingentsFilter,
} from '../api/department-contingent-api';
import type { DeptContingentListItem } from '../model/types';
import { canCreateContingent, isInstituteViewer } from '../model/scope';
import CreateContingentModal from '../components/create-contingent-modal';

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const BASE = '/study-load/department-contingents';

const DeleteBody = ({ item }: { item: DeptContingentListItem }) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const del = useDeleteDeptContingent();
  const handleConfirm = async () => {
    try {
      const res = await del.mutateAsync(item.id);
      message.success(t('studyLoad.deptContingent.deleted'));
      if (res.flaggedWorkloads > 0) {
        message.warning(t('studyLoad.deptContingent.flagged', { count: res.flaggedWorkloads }));
      }
      hideModal();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };
  return (
    <DeleteConfirm
      title={t('studyLoad.deptContingent.deleteTitle')}
      subtitle={t('studyLoad.deptContingent.deleteSubtitle', { year: item.academicYearTitle })}
      loading={del.isPending}
      onConfirm={() => void handleConfirm()}
    />
  );
};

const DepartmentContingentListPage = () => {
  const { t, lang } = useTranslation();
  const navigate = useNavigate();
  const can = usePermission();
  const showModal = useModalStore((s) => s.showModal);
  const role = useSessionStore((s) => s.user?.roles?.[0]?.name);
  const isSuper = useSessionStore((s) => s.permissions.includes('*'));
  const instituteViewer = isInstituteViewer(role, isSuper);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [yearId, setYearId] = useState<string | undefined>(undefined);
  const [departmentId, setDepartmentId] = useState<string | undefined>(undefined);

  const filter = useMemo<DeptContingentsFilter>(
    () => ({ page, limit: pageSize, academicYear: yearId, department: departmentId }),
    [page, pageSize, yearId, departmentId],
  );
  const { data, isLoading, isError, error, refetch } = useDeptContingents(filter);
  const { data: years = [] } = useAcademicYearsRef();
  const { data: departments = [] } = useDepartmentsRef();

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(lang, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

  const handleDelete = (item: DeptContingentListItem) =>
    showModal({ withHeader: false, maxWidth: '460px', body: () => <DeleteBody item={item} /> });

  const iconBtn = (title: string, icon: React.ReactNode, onClick: () => void, danger = false) => (
    <Tooltip title={title}>
      <Button type="text" size="small" danger={danger} icon={icon} onClick={onClick} aria-label={title} />
    </Tooltip>
  );

  const columns: ColumnDef<DeptContingentListItem>[] = [
    {
      header: t('studyLoad.deptContingent.column.department'),
      id: 'department',
      cell: ({ row }) => (
        <Typography.Text strong style={{ color: 'var(--color-text)' }}>
          {row.original.departmentTitle || '—'}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.deptContingent.column.academicYear'),
      id: 'year',
      cell: ({ row }) => row.original.academicYearTitle || '—',
    },
    {
      header: t('studyLoad.deptContingent.column.rowCount'),
      id: 'rowCount',
      meta: { align: 'center' as const },
      cell: ({ row }) => row.original.rowCount,
    },
    {
      header: t('studyLoad.deptContingent.column.streamCount'),
      id: 'streamCount',
      meta: { align: 'center' as const },
      cell: ({ row }) => row.original.streamCount,
    },
    {
      header: t('studyLoad.deptContingent.column.updatedAt'),
      id: 'updatedAt',
      cell: ({ row }) => fmtDate(row.original.updatedAt),
    },
    {
      header: t('studyLoad.deptContingent.column.actions'),
      id: 'actions',
      size: 120,
      meta: { align: 'right' as const },
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-1)' }}>
            {iconBtn(t('studyLoad.common.view'), <EyeOutlined />, () => navigate(`${BASE}/${item.id}`))}
            {can('departmentContingent:delete')
              ? iconBtn(t('studyLoad.common.delete'), <DeleteOutlined />, () => handleDelete(item), true)
              : null}
          </div>
        );
      },
    },
  ];

  const openCreate = () =>
    showModal({
      title: t('studyLoad.deptContingent.create'),
      maxWidth: '520px',
      bodyPadding: '0',
      body: () => <CreateContingentModal onCreated={(id) => navigate(`${BASE}/${id}`)} />,
    });

  return (
    <PageContainer title={t('studyLoad.nav.deptContingent')}>
      <Filters
        hideSearch
        onSearch={() => {}}
        selects={[
          ...(instituteViewer && departments.length
            ? [
                {
                  key: 'department',
                  placeholder: t('studyLoad.deptContingent.filter.allDepartments'),
                  value: departmentId,
                  options: departments.map((d) => ({ value: d.id, label: d.title })),
                  onChange: (v: string | undefined) => {
                    setDepartmentId(v);
                    setPage(1);
                  },
                },
              ]
            : []),
          {
            key: 'academicYear',
            placeholder: t('studyLoad.deptContingent.filter.allYears'),
            value: yearId,
            options: years.map((y) => ({ value: y.id, label: y.title })),
            onChange: (v) => {
              setYearId(v);
              setPage(1);
            },
          },
        ]}
        extra={
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {instituteViewer ? (
              <Button icon={<BarChartOutlined />} style={{ height: 38 }} onClick={() => navigate(`${BASE}/summary`)}>
                {t('studyLoad.deptContingent.summary.open')}
              </Button>
            ) : null}
            {canCreateContingent(can('departmentContingent:create'), isSuper) ? (
              <Button type="primary" icon={<PlusOutlined />} style={{ height: 38 }} onClick={openCreate}>
                {t('studyLoad.deptContingent.create')}
              </Button>
            ) : null}
          </div>
        }
      />
      {isError ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 'var(--space-4)' }}
          message={t('studyLoad.deptContingent.loadError')}
          description={getApiErrorMessage(error)}
          action={
            <Button size="small" onClick={() => void refetch()}>
              {t('studyLoad.deptContingent.retry')}
            </Button>
          }
        />
      ) : null}
      <DataTable<DeptContingentListItem>
        data={data?.items ?? []}
        columns={columns}
        loading={isLoading}
        page={page}
        pageSize={pageSize}
        total={data?.meta.total}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />
    </PageContainer>
  );
};

export default DepartmentContingentListPage;
