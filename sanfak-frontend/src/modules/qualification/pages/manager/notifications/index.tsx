import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { PlusOutlined } from '@ant-design/icons';
import { App, Button, Flex, Typography } from 'antd';
import dayjs from 'dayjs';
import { PageContainer, DataTable, ActionButtons, useModalStore } from '@/shared/ui';
import { TableGap } from '../../../components/table-gap';
import { getApiErrorMessage } from '@/shared/api';
import { Can } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import { useConfirm } from '../../../lib/use-confirm';
import { useNotificationsPaginated, useDeleteNotification } from '../../../api/notification-api';
import type { Notification } from '../../../model/notification.types';
import NotificationForm from '../../../components/notification-form-modal';

const { Text } = Typography;
const LIMIT = 12;
const fmtDate = (d?: string): string => (d ? dayjs(d).format('DD.MM.YYYY HH:mm') : '—');

export default function NotificationsPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { confirmDelete } = useConfirm();
  const showModal = useModalStore((s) => s.showModal);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);

  const { data, isFetching } = useNotificationsPaginated({ page, limit: pageSize });
  const remove = useDeleteNotification();

  const total = data?.meta.total ?? 0;

  const openForm = (item: Notification | null) =>
    showModal({
      title: item
        ? t('qualification.notifications.editTitle')
        : t('qualification.notifications.addTitle'),
      body: () => <NotificationForm editItem={item} />,
      maxWidth: '480px',
    });

  const handleDelete = (row: Notification) => {
    confirmDelete(
      async () => {
        try {
          await remove.mutateAsync(row.id);
          message.success(t('qualification.notifications.deleted'));
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
      {
        title: 'qualification.notifications.deleteTitle',
        content: 'qualification.notifications.deleteConfirm',
      },
    );
  };

  const columns: ColumnDef<Notification, unknown>[] = [
    {
      header: '#',
      id: 'idx',
      size: 56,
      cell: ({ row }) => (
        <span style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {(page - 1) * pageSize + row.index + 1}
        </span>
      ),
    },
    {
      header: t('qualification.notifications.col.text'),
      accessorKey: 'text',
      cell: ({ row }) => row.original.text,
    },
    {
      header: t('qualification.notifications.col.date'),
      id: 'date',
      size: 170,
      cell: ({ row }) => fmtDate(row.original.createdAt),
    },
    {
      header: t('actions'),
      id: 'actions',
      size: 110,
      meta: { align: 'center' as const },
      cell: ({ row }) => (
        <ActionButtons
          onEdit={() => openForm(row.original)}
          onDelete={() => handleDelete(row.original)}
          hideToggle
        />
      ),
    },
  ];

  return (
    <PageContainer title={t('qualification.notifications.nav')}>
      <Flex justify="space-between" align="center" style={{ marginBottom: 'var(--space-4)' }}>
        <Text strong>{t('qualification.notifications.count', { count: total })}</Text>
        <Can perform="qualNotification:create">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openForm(null)}
            style={{ height: 40 }}
          >
            {t('qualification.notifications.add')}
          </Button>
        </Can>
      </Flex>

      <TableGap>
        <DataTable<Notification>
          data={data?.items ?? []}
          columns={columns}
          loading={isFetching}
          page={page}
          pageSize={pageSize}
          total={data?.meta.total}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      </TableGap>
    </PageContainer>
  );
}
