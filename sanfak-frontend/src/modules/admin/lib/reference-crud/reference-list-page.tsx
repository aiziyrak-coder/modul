import { useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { PlusOutlined } from '@ant-design/icons';
import { Button, App } from 'antd';
import { PageContainer, DataTable, ActionButtons, Filters } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { Can, usePermission } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import { PageHeader } from '../../components/page-header';
import type { ReferenceRecord } from './reference-types';
import type { ReferenceConfig } from './types';
import { useReferenceList, useReferenceRemove } from './reference-api';
import { ReferenceFormModal } from './reference-form-modal';

const LIMIT = 12;

export function ReferenceListPage({ config }: { config: ReferenceConfig }) {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();

  const can = usePermission();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);
  const [search, setSearch] = useState('');
  const [modalState, setModalState] = useState<{ open: boolean; editId: string | null }>({
    open: false,
    editId: null,
  });

  const { data, isLoading, refetch } = useReferenceList(config.root, {
    page,
    limit: pageSize,
    ...(search ? { search } : {}),
  });
  const remove = useReferenceRemove(config.root);

  const openCreate = () => setModalState({ open: true, editId: null });
  const openEdit = (id: string) => setModalState({ open: true, editId: id });
  const closeModal = () => setModalState({ open: false, editId: null });

  const handleDelete = (record: ReferenceRecord) => {
    modal.confirm({
      title: t('admin.common.deleteConfirmTitle', { title: t(config.labels.listTitleKey) }),
      content: t('admin.common.deleteConfirmContent', { title: record.title ?? '' }),
      okText: t('admin.common.deleteConfirmOk'),
      okType: 'danger',
      cancelText: t('admin.common.cancel'),
      centered: true,
      onOk: async () => {
        try {
          await remove.mutateAsync(record.id);
          message.success(t('admin.common.deleted'));
          void refetch();
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
    });
  };

  const configCols: ColumnDef<ReferenceRecord>[] = config.columns.map((col) => ({
    header: t(col.titleKey),
    id: col.key,
    size: col.width,
    meta: col.align ? { align: col.align } : undefined,
    cell: ({ row }) => {
      if (col.render) return col.render(row.original);
      const val = row.original[col.key];
      return val != null && val !== '' ? (
        String(val)
      ) : (
        <span style={{ color: 'var(--color-text-mute)' }}>—</span>
      );
    },
  }));

  const columns: ColumnDef<ReferenceRecord>[] = [
    {
      header: t('admin.common.index'),
      id: '_index',
      size: 48,
      cell: ({ row }) => (
        <span style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {(page - 1) * pageSize + row.index + 1}
        </span>
      ),
    },
    ...configCols,
    {
      header: t('admin.common.actions'),
      id: '_actions',
      size: 170,
      meta: { align: 'right' as const },
      cell: ({ row }) => {
        const canEdit = can(`${config.section}:update`);
        const canDelete = can(`${config.section}:delete`);
        return (
          <ActionButtons
            onEdit={canEdit ? () => openEdit(row.original.id) : undefined}
            onDelete={canDelete ? () => handleDelete(row.original) : undefined}
            hideEdit={!canEdit}
            hideDelete={!canDelete}
            hideToggle
          />
        );
      },
    },
  ];

  return (
    <PageContainer title="">
      <PageHeader title={t(config.labels.listTitleKey)} />

      <Filters
        searchPlaceholder={t(config.labels.searchPlaceholderKey)}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        hideSearch={config.searchable === false}
        extra={
          <Can perform={`${config.section}:create`}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreate}
              style={{ height: 40 }}
            >
              {t(config.labels.newButtonKey)}
            </Button>
          </Can>
        }
      />

      <DataTable<ReferenceRecord>
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

      <ReferenceFormModal
        config={config}
        editId={modalState.editId}
        open={modalState.open}
        onClose={closeModal}
        onSuccess={() => void refetch()}
      />
    </PageContainer>
  );
}
