import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type ColumnDef } from '@tanstack/react-table';
import { PlusOutlined } from '@ant-design/icons';
import { Button, App, Typography } from 'antd';
import styled from 'styled-components';
import { PageContainer, DataTable, ActionButtons, Filters, StatusTag } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { Can, usePermission } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import { useAdminRoles, useDeleteRole } from '../api/roles-api';
import type { AdminRole } from '../model/types';
import { scopeLevelLabelKey } from '../lib/scope-labels';

const PermCount = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  padding: 2px 8px;
  border-radius: var(--radius-pill, 9999px);
  background: var(--color-bg-elevate, #f5f7fb);
  color: var(--brand-primary, #37cb94);
  font-weight: 600;
  font-size: 13px;
  border: 1px solid var(--color-border-soft, #eef2f6);
`;

const LIMIT = 12;

export default function RolesListPage() {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const [pageSize, setPageSize] = useState(LIMIT);
  const [search, setSearch] = useState('');

  const can = usePermission();
  const { data, isLoading } = useAdminRoles(page, pageSize, search || undefined);
  const deleteRole = useDeleteRole();

  const handleDelete = (role: AdminRole) => {
    if (role.isSystem) {
      message.warning(t('admin.role.systemRoleCannotDelete'));
      return;
    }
    modal.confirm({
      title: t('admin.role.deleteConfirmTitle'),
      content: t('admin.role.deleteConfirmContent', { title: role.title }),
      okText: t('admin.common.deleteConfirmOk'),
      okType: 'danger',
      cancelText: t('admin.common.cancel'),
      centered: true,
      onOk: async () => {
        try {
          await deleteRole.mutateAsync(role.id);
          message.success(t('admin.role.deleted', { title: role.title }));
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
    });
  };

  const columns: ColumnDef<AdminRole>[] = [
    {
      header: t('admin.common.index'),
      id: 'index',
      size: 48,
      cell: ({ row }) => (
        <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {(page - 1) * pageSize + row.index + 1}
        </Typography.Text>
      ),
    },
    {
      header: t('admin.role.columns.title'),
      accessorKey: 'title',
      cell: ({ row }) => (
        <strong style={{ color: 'var(--color-text)' }}>{row.original.title}</strong>
      ),
    },
    {
      header: t('admin.role.columns.desc'),
      accessorKey: 'desc',
      cell: ({ row }) => (
        <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {row.original.desc || '—'}
        </Typography.Text>
      ),
    },
    {
      header: t('admin.role.columns.permissions'),
      id: 'perms',
      size: 110,
      cell: ({ row }) => (
        <PermCount>{t('admin.role.permissionsCount', { count: row.original.permissions.length })}</PermCount>
      ),
    },
    {
      header: t('admin.role.columns.scope'),
      accessorKey: 'scopeLevel',
      size: 120,
      cell: ({ row }) => (
        <StatusTag status="info" label={t(scopeLevelLabelKey(row.original.scopeLevel))} />
      ),
    },
    {
      header: t('admin.role.columns.active'),
      id: 'active',
      size: 110,
      cell: ({ row }) => (
        <StatusTag
          status={row.original.active ? 'active' : 'inactive'}
          label={row.original.active ? t('admin.role.statusActive') : t('admin.role.statusInactive')}
        />
      ),
    },
    {
      header: t('admin.common.actions'),
      id: 'actions',
      size: 170,
      meta: { align: 'right' as const },
      cell: ({ row }) => (
        <ActionButtons
          onEdit={() => navigate(`/admin/roles/${row.original.id}/edit`)}
          onDelete={() => handleDelete(row.original)}
          hideEdit={!can('role:update')}
          hideDelete={!can('role:delete')}
          hideToggle
        />
      ),
    },
  ];

  return (
    <PageContainer title="">
      <Filters
        searchPlaceholder={t('admin.role.searchPlaceholder')}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        extra={
          <Can perform="role:create">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/admin/roles/new')}
              style={{ height: 40 }}
            >
              {t('admin.role.newButton')}
            </Button>
          </Can>
        }
      />

      <DataTable<AdminRole>
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
    </PageContainer>
  );
}
