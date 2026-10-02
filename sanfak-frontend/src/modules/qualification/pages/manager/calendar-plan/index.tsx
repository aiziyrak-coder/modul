import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { UploadOutlined, CalendarOutlined } from '@ant-design/icons';
import { App, Button, Flex, Typography } from 'antd';
import dayjs from 'dayjs';
import { PageContainer, DataTable, ActionButtons, useModalStore } from '@/shared/ui';
import { TableGap } from '../../../components/table-gap';
import { getApiErrorMessage } from '@/shared/api';
import { Can } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import { useConfirm } from '../../../lib/use-confirm';
import { useCalendarPlansPaginated, useDeleteCalendarPlan } from '../../../api/calendar-plan-api';
import type { CalendarPlan } from '../../../model/calendar-plan.types';
import CalendarPlanForm from '../../../components/calendar-plan-form-modal';

const { Text } = Typography;
const LIMIT = 12;
const fmtDate = (d?: string): string => (d ? dayjs(d).format('DD.MM.YYYY') : '—');

export default function CalendarPlanPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { confirmDelete } = useConfirm();
  const showModal = useModalStore((s) => s.showModal);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);

  const { data, isFetching, refetch } = useCalendarPlansPaginated({ page, limit: pageSize });
  const remove = useDeleteCalendarPlan();

  const total = data?.meta.total ?? 0;

  const handleDelete = (row: CalendarPlan) => {
    confirmDelete(
      async () => {
        try {
          await remove.mutateAsync(row.id);
          message.success(t('qualification.calendarPlan.deleted'));
          void refetch();
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
      {
        title: 'qualification.calendarPlan.deleteTitle',
        content: 'qualification.calendarPlan.deleteConfirm',
      },
    );
  };

  const download = (url: string) => {
    if (url && url !== '#') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      message.warning(t('qualification.calendarPlan.noFile'));
    }
  };

  const columns: ColumnDef<CalendarPlan, unknown>[] = [
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
      header: t('qualification.calendarPlan.colName'),
      accessorKey: 'title',
      cell: ({ row }) => (
        <Flex align="center" gap={8}>
          <CalendarOutlined style={{ color: 'var(--brand-primary)' }} />
          <strong>{row.original.title}</strong>
        </Flex>
      ),
    },
    {
      header: t('qualification.calendarPlan.colDate'),
      id: 'uploadedAt',
      size: 160,
      cell: ({ row }) => fmtDate(row.original.uploadedAt),
    },
    {
      header: t('actions'),
      id: 'actions',
      size: 120,
      meta: { align: 'center' as const },
      cell: ({ row }) => (
        <ActionButtons
          onDownload={() => download(row.original.fileUrl)}
          onDelete={() => handleDelete(row.original)}
        />
      ),
    },
  ];

  return (
    <PageContainer title={t('qualification.calendarPlan.nav')}>
      <Flex justify="space-between" align="center" style={{ marginBottom: 'var(--space-4)' }}>
        <Text strong>{t('qualification.calendarPlan.count', { count: total })}</Text>
        <Can perform="qualCalendarPlan:create">
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={() =>
              showModal({
                title: t('qualification.calendarPlan.formTitle'),
                body: CalendarPlanForm,
                maxWidth: '545px',
              })
            }
            style={{ height: 40 }}
          >
            {t('qualification.calendarPlan.upload')}
          </Button>
        </Can>
      </Flex>

      <TableGap>
        <DataTable<CalendarPlan>
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
