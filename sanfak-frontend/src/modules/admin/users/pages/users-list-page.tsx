import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { PlusOutlined } from '@ant-design/icons';
import { Button, App, Typography } from 'antd';
import { PageContainer, DataTable, ActionButtons, Filters, StatusTag } from '@/shared/ui';
import { usePermission } from '@/app/session';
import { getApiErrorMessage } from '@/shared/api';
import { Can } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import { UserFormModal } from '../components/user-form-modal';
import { useAdminUsers, useDeleteUser, useToggleUserActive } from '../api/users-api';
import { useAdminRoles } from '../../roles/api/roles-api';
import type { AdminUser } from '../model/types';

function resolveName(u: { id: string; title: string } | string | undefined): string {
  if (!u) return '—';
  return typeof u === 'object' ? u.title : u;
}

const LIMIT = 12;

export default function UsersListPage() {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const can = usePermission();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const [pageSize, setPageSize] = useState(LIMIT);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>();
  const [activeFilter, setActiveFilter] = useState<string | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const { data, isLoading } = useAdminUsers({
    page,
    limit: pageSize,
    search: search || undefined,
    role: roleFilter,
    active: activeFilter === undefined ? undefined : activeFilter === 'true',
  });
  const { data: rolesData } = useAdminRoles(1, 100);
  const deleteUser = useDeleteUser();
  const toggleActive = useToggleUserActive();

  const openCreate = () => { setEditId(null); setModalOpen(true); };
  const openEdit = (id: string) => { setEditId(id); setModalOpen(true); };

  const handleDelete = (user: AdminUser) => {
    modal.confirm({
      title: t('admin.user.deleteConfirmTitle'),
      content: t('admin.user.deleteConfirmContent', { name: `${user.lastName} ${user.firstName}` }),
      okText: t('admin.common.deleteConfirmOk'),
      okType: 'danger',
      cancelText: t('admin.common.cancel'),
      centered: true,
      onOk: async () => {
        try {
          await deleteUser.mutateAsync(user.id);
          message.success(t('admin.common.deleted'));
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
    });
  };

  const handleToggle = async (user: AdminUser) => {
    try {
      await toggleActive.mutateAsync(user.id);
      message.success(user.active ? t('admin.user.blocked') : t('admin.user.activated'));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const roleOptions = (rolesData?.items ?? []).map((r) => ({ value: r.id, label: r.title }));
  const statusOptions = [
    { value: 'true', label: t('admin.user.statusActive') },
    { value: 'false', label: t('admin.user.statusBlocked') },
  ];

  const columns: ColumnDef<AdminUser>[] = [
    {
      header: t('admin.user.columns.fullName'),
      id: 'fullname',
      cell: ({ row }) => (
        <Typography.Text strong style={{ color: 'var(--color-text)' }}>
          {row.original.lastName} {row.original.firstName}
          {row.original.middleName ? ` ${row.original.middleName}` : ''}
        </Typography.Text>
      ),
    },
    {
      header: t('admin.user.columns.position'),
      id: 'position',
      cell: ({ row }) => <span>{resolveName(row.original.position as { id: string; title: string } | undefined)}</span>,
    },
    {
      header: t('admin.user.columns.division'),
      id: 'division',
      cell: ({ row }) => <span>{resolveName(row.original.division as { id: string; title: string } | undefined)}</span>,
    },
    {
      header: t('admin.user.columns.role'),
      id: 'role',
      cell: ({ row }) => <span>{row.original.role ? row.original.role.title : '—'}</span>,
    },
    {
      header: t('admin.user.columns.email'),
      accessorKey: 'email',
      cell: ({ row }) => <span>{row.original.email || '—'}</span>,
    },
    {
      header: t('admin.user.columns.phone'),
      accessorKey: 'phone',
      cell: ({ row }) => <span>{row.original.phone || '—'}</span>,
    },
    {
      header: t('admin.user.columns.status'),
      id: 'status',
      cell: ({ row }) => (
        <StatusTag
          status={row.original.active ? 'active' : 'inactive'}
          label={row.original.active ? t('admin.user.statusActive') : t('admin.user.statusBlocked')}
        />
      ),
    },
    {
      header: t('admin.common.actions'),
      id: 'actions',
      size: 120,
      meta: { align: 'right' as const },
      cell: ({ row }) => (
        <ActionButtons
          onEdit={() => openEdit(row.original.id)}
          onToggleActive={() => handleToggle(row.original)}
          isActive={row.original.active}
          onDelete={() => handleDelete(row.original)}
          hideToggle={false}
          hideEdit={!can('user:update')}
          hideDelete={!can('user:delete')}
        />
      ),
    },
  ];

  return (
    <PageContainer title="">
      <Filters
        searchPlaceholder={t('admin.user.searchPlaceholder')}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        selects={[
          {
            key: 'role',
            placeholder: t('admin.user.allRoles'),
            value: roleFilter,
            options: roleOptions,
            onChange: (v) => { setRoleFilter(v); setPage(1); },
          },
          {
            key: 'active',
            placeholder: t('admin.user.allStatuses'),
            value: activeFilter,
            options: statusOptions,
            onChange: (v) => { setActiveFilter(v); setPage(1); },
          },
        ]}
        extra={
          <Can perform="user:create">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreate}
              style={{ height: 44, borderRadius: 8, fontWeight: 500 }}
            >
              {t('admin.user.newButton')}
            </Button>
          </Can>
        }
      />

      <DataTable<AdminUser>
        data={data?.items ?? []}
        columns={columns}
        loading={isLoading}
        page={page}
        pageSize={pageSize}
        total={data?.meta.total}
        onPageChange={(p) => setPage(p)}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />

      <UserFormModal
        open={modalOpen}
        editId={editId}
        onClose={() => setModalOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['admin-users'] })}
      />
    </PageContainer>
  );
}
