import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  BookOutlined,
  DownloadOutlined,
  ExportOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { App, Button, Flex, Typography } from 'antd';
import dayjs from 'dayjs';
import { PageContainer, DataTable, ActionButtons, Select, useModalStore } from '@/shared/ui';
import { TableGap } from '../../../components/table-gap';
import { getApiErrorMessage } from '@/shared/api';
import { Can } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import { useConfirm } from '../../../lib/use-confirm';
import { useSourcesPaginated, useDeleteSource } from '../../../api/source-api';
import { useCourseOptions } from '../../../api/course-api';
import type { Source } from '../../../model/source.types';
import SourceForm from '../../../components/source-form-modal';

const { Text } = Typography;
const LIMIT = 12;
const BRAND = 'var(--brand-primary, #37cb94)';
const LINK_BLUE = 'var(--ant-color-info, #1677ff)';
const fmtDate = (d?: string): string => (d ? dayjs(d).format('DD.MM.YYYY') : '—');
const Dash = () => <span style={{ color: 'var(--color-text-mute, #9aa3b2)' }}>—</span>;

export default function ResourcesPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { confirmDelete } = useConfirm();
  const showModal = useModalStore((s) => s.showModal);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);
  const [course, setCourse] = useState<string | undefined>(undefined);

  const courseOptions = useCourseOptions();
  const { data, isFetching } = useSourcesPaginated({
    page,
    limit: pageSize,
    ...(course ? { course } : {}),
  });
  const remove = useDeleteSource();

  const total = data?.meta.total ?? 0;

  const handleDelete = (row: Source) => {
    confirmDelete(
      async () => {
        try {
          await remove.mutateAsync(row.id);
          message.success(t('qualification.resources.deleted'));
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
      {
        title: 'qualification.resources.deleteTitle',
        content: 'qualification.resources.deleteConfirm',
      },
    );
  };

  const openUrl = (url?: string | null) => {
    if (url && url !== '#') window.open(url, '_blank', 'noopener,noreferrer');
    else message.warning(t('qualification.resources.noFile'));
  };

  const columns: ColumnDef<Source, unknown>[] = [
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
      header: t('qualification.resources.col.name'),
      accessorKey: 'title',
      cell: ({ row }) => (
        <Flex align="center" gap={8}>
          <BookOutlined style={{ color: BRAND }} />
          <strong>{row.original.title}</strong>
        </Flex>
      ),
    },
    {
      header: t('qualification.resources.col.course'),
      id: 'course',
      cell: ({ row }) => row.original.courseTitle ?? '—',
    },
    {
      header: t('qualification.resources.col.link'),
      id: 'link',
      size: 120,
      cell: ({ row }) =>
        row.original.link ? (
          <Button
            type="link"
            size="small"
            icon={<ExportOutlined />}
            onClick={() => openUrl(row.original.link)}
            style={{ padding: 0, color: LINK_BLUE }}
          >
            {t('qualification.resources.open')}
          </Button>
        ) : (
          <Dash />
        ),
    },
    {
      header: t('qualification.resources.col.file'),
      id: 'file',
      size: 190,
      cell: ({ row }) =>
        row.original.fileUrl && row.original.fileUrl !== '#' ? (
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => openUrl(row.original.fileUrl)}
            style={{ padding: 0, color: BRAND, maxWidth: 180 }}
          >
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.original.fileName ?? t('qualification.resources.open')}
            </span>
          </Button>
        ) : (
          <Dash />
        ),
    },
    {
      header: t('qualification.resources.col.date'),
      id: 'date',
      size: 130,
      cell: ({ row }) => fmtDate(row.original.createdAt),
    },
    {
      header: t('actions'),
      id: 'actions',
      size: 80,
      meta: { align: 'center' as const },
      cell: ({ row }) => <ActionButtons onDelete={() => handleDelete(row.original)} />,
    },
  ];

  return (
    <PageContainer title={t('qualification.resources.nav')}>
      <Flex
        justify="space-between"
        align="center"
        wrap
        gap={12}
        style={{ marginBottom: 'var(--space-4)' }}
      >
        <Flex align="center" gap={12} wrap>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={t('qualification.resources.filterCourse')}
            options={courseOptions.data ?? []}
            loading={courseOptions.isFetching}
            value={course}
            onChange={(v) => {
              setCourse(v);
              setPage(1);
            }}
            style={{ minWidth: 240 }}
          />
          <Text strong>{t('qualification.resources.count', { count: total })}</Text>
        </Flex>
        <Can perform="qualSource:create">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() =>
              showModal({
                title: t('qualification.resources.formTitle'),
                body: SourceForm,
                maxWidth: '545px',
              })
            }
            style={{ height: 40 }}
          >
            {t('qualification.resources.add')}
          </Button>
        </Can>
      </Flex>

      <TableGap>
        <DataTable<Source>
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
