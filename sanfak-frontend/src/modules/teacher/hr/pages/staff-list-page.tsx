import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type ColumnDef } from '@tanstack/react-table';
import { App, Button, Tooltip, Typography } from 'antd';
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { PageContainer, DataTable, Filters, useModalStore, phoneToDisplay } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { Can } from '@/app/session';
import {
  downloadStaffExport,
  fetchProfileIdByUser,
  getApiErrorMessage,
  useDeleteStaff,
  useDepartmentsForSelect,
  useFacultiesForSelect,
  usePositionsForSelect,
  useRestoreStaff,
  useStaffPaginated,
  type StaffFilter,
} from '../api/staff-api';
import type { StaffListItem } from '../model/staff-types';
import { formatSubmittedDate } from '../model/helper';
import StaffAvatarCell from '../components/staff-avatar-cell';
import StaffDeleteConfirm from '../components/staff-delete-confirm';
import StaffRestoreConfirm from '../components/staff-restore-confirm';

type StaffStatusFilter = 'active' | 'deleted';

const StaffListPage = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const showModal = useModalStore((s) => s.showModal);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [search, setSearch] = useState('');
  const [facultyFilter, setFacultyFilter] = useState<string | undefined>(undefined);
  const [departmentFilter, setDepartmentFilter] = useState<string | undefined>(undefined);
  const [positionFilter, setPositionFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<StaffStatusFilter>('active');
  const [exporting, setExporting] = useState(false);
  const [viewLoadingId, setViewLoadingId] = useState<string | null>(null);

  const { data: faculties = [] } = useFacultiesForSelect();
  const { data: departments = [] } = useDepartmentsForSelect(facultyFilter);
  const { data: positions = [] } = usePositionsForSelect();

  const facultyOptions = useMemo(() => faculties.map((f) => ({ label: f.title, value: f.id })), [faculties]);
  const departmentOptions = useMemo(
    () => departments.map((d) => ({ label: d.title, value: d.id })),
    [departments],
  );
  const positionOptions = useMemo(() => positions.map((p) => ({ label: p.title, value: p.id })), [positions]);

  const statusOptions = useMemo(
    () => [
      { label: t('teacher.hr.staff.filter.status.active'), value: 'active' },
      { label: t('teacher.hr.staff.filter.status.deleted'), value: 'deleted' },
    ],
    [t],
  );

  const filter: StaffFilter = useMemo(
    () => ({
      page,
      limit: pageSize,
      search: search || undefined,
      faculty: facultyFilter,
      department: departmentFilter,
      position: positionFilter,
      active: statusFilter === 'active',
    }),
    [page, pageSize, search, facultyFilter, departmentFilter, positionFilter, statusFilter],
  );

  const { data, isLoading } = useStaffPaginated(filter);
  const deleteMutation = useDeleteStaff();
  const restoreMutation = useRestoreStaff();

  const handleDelete = (item: StaffListItem) => {
    showModal({
      withHeader: false,
      maxWidth: '460px',
      body: () => (
        <StaffDeleteConfirm
          loading={deleteMutation.isPending}
          onConfirm={async () => {
            try {
              await deleteMutation.mutateAsync(item.id);
              message.success(t('teacher.hr.staff.delete.success'));
              useModalStore.getState().hideModal();
            } catch (err) {
              message.error(getApiErrorMessage(err));
            }
          }}
        />
      ),
    });
  };

  const handleRestore = (item: StaffListItem) => {
    showModal({
      withHeader: false,
      maxWidth: '460px',
      body: () => (
        <StaffRestoreConfirm
          loading={restoreMutation.isPending}
          onConfirm={async () => {
            try {
              await restoreMutation.mutateAsync(item.id);
              message.success(t('teacher.hr.staff.restore.success'));
              useModalStore.getState().hideModal();
            } catch (err) {
              message.error(getApiErrorMessage(err));
            }
          }}
        />
      ),
    });
  };

  const handleView = async (item: StaffListItem) => {
    setViewLoadingId(item.id);
    try {
      const profileId = await fetchProfileIdByUser(item.id);
      if (profileId) {
        navigate(`/teacher/hr/profiles/${profileId}`);
      } else {
        message.info(t('teacher.hr.staff.noProfileYet'));
      }
    } catch (err) {
      message.error(getApiErrorMessage(err));
    } finally {
      setViewLoadingId(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadStaffExport({
        search: search || undefined,
        faculty: facultyFilter,
        department: departmentFilter,
        position: positionFilter,
      });
    } catch (err) {
      message.error(getApiErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const columns: ColumnDef<StaffListItem>[] = [
    {
      header: t('teacher.hr.staff.column.fullName'),
      id: 'fullName',
      cell: ({ row }) => (
        <StaffAvatarCell
          fullName={row.original.fullName}
          email={row.original.email}
          photo={row.original.photo}
        />
      ),
    },
    {
      header: t('teacher.hr.staff.column.position'),
      id: 'position',
      cell: ({ row }) => row.original.positionTitle ?? '—',
    },
    {
      header: t('teacher.hr.staff.column.department'),
      id: 'department',
      cell: ({ row }) => row.original.departmentTitle ?? '—',
    },
    {
      header: t('teacher.hr.staff.column.faculty'),
      id: 'faculty',
      cell: ({ row }) => row.original.facultyTitle ?? '—',
    },
    {
      header: t('teacher.hr.staff.column.phone'),
      id: 'phone',
      cell: ({ row }) => phoneToDisplay(row.original.phone) || '—',
    },
    {
      header: t('teacher.hr.staff.column.date'),
      id: 'date',
      size: 120,
      cell: ({ row }) => (
        <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {formatSubmittedDate(row.original.createdAt)}
        </Typography.Text>
      ),
    },
    {
      header: t('actions'),
      id: 'actions',
      size: 140,
      meta: { align: 'right' as const },
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
            <Tooltip title={t('teacher.hr.staff.action.view')}>
              <Button
                type="text"
                icon={<EyeOutlined />}
                size="small"
                loading={viewLoadingId === item.id}
                onClick={() => void handleView(item)}
              />
            </Tooltip>
            {statusFilter === 'deleted' ? (
              <Can perform="staff:update">
                <Tooltip title={t('teacher.hr.staff.action.restore')}>
                  <Button
                    type="text"
                    icon={<UndoOutlined style={{ color: 'var(--brand-success)' }} />}
                    size="small"
                    onClick={() => handleRestore(item)}
                  />
                </Tooltip>
              </Can>
            ) : (
              <>
                <Can perform="staff:update">
                  <Tooltip title={t('teacher.hr.staff.action.edit')}>
                    <Button
                      type="text"
                      icon={<EditOutlined />}
                      size="small"
                      onClick={() => navigate(`/teacher/hr/staff/${item.id}/edit`)}
                    />
                  </Tooltip>
                </Can>
                <Can perform="staff:delete">
                  <Tooltip title={t('teacher.hr.staff.action.delete')}>
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      size="small"
                      onClick={() => handleDelete(item)}
                    />
                  </Tooltip>
                </Can>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <PageContainer title={t('teacher.hr.staff.pageTitle')}>
      <Filters
        searchValue={search}
        searchPlaceholder="teacher.hr.staff.searchPlaceholder"
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        selects={[
          {
            key: 'faculty',
            placeholder: t('teacher.hr.staff.filter.faculty'),
            value: facultyFilter,
            options: facultyOptions,
            onChange: (v) => {
              setFacultyFilter(v);
              setDepartmentFilter(undefined);
              setPage(1);
            },
          },
          {
            key: 'department',
            placeholder: t('teacher.hr.staff.filter.department'),
            value: departmentFilter,
            options: departmentOptions,
            onChange: (v) => {
              setDepartmentFilter(v);
              setPage(1);
            },
          },
          {
            key: 'position',
            placeholder: t('teacher.hr.staff.filter.position'),
            value: positionFilter,
            options: positionOptions,
            onChange: (v) => {
              setPositionFilter(v);
              setPage(1);
            },
          },
          {
            key: 'status',
            placeholder: t('teacher.hr.staff.filter.status'),
            value: statusFilter,
            options: statusOptions,
            onChange: (v) => {
              setStatusFilter((v as StaffStatusFilter) ?? 'active');
              setPage(1);
            },
          },
        ]}
        extra={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Can perform="staff:export">
              <Button icon={<DownloadOutlined />} loading={exporting} onClick={() => void handleExport()}>
                {t('teacher.hr.staff.export')}
              </Button>
            </Can>
            <Can perform="staff:create">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate('/teacher/hr/staff/new')}
              >
                {t('teacher.hr.staff.add')}
              </Button>
            </Can>
          </div>
        }
      />

      <DataTable<StaffListItem>
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

export default StaffListPage;
