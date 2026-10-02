import { useEffect, useState } from 'react';
import { ClearOutlined, DownloadOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, DatePicker, Descriptions, Flex, Modal, Tag, Typography } from 'antd';
import type { ColumnDef } from '@tanstack/react-table';
import dayjs, { type Dayjs } from 'dayjs';
import { PageContainer, DataTable, ActionButtons, Filters } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { usePermission } from '@/app/session';
import { PageHeader } from '../components/page-header';
import { AnnouncementModal } from '../components/announcement-modal';
import type { Announcement, RecipientGroup } from '../model/types';
import { fetchAnnouncementsPage, useAnnouncementRemove } from '../api/council-api';
import { useServerTable } from '../lib/use-server-table';

const { Paragraph } = Typography;
const { RangePicker } = DatePicker;

const fmt = (d?: string) => (d ? dayjs(d).format('DD.MM.YYYY HH:mm') : '—');

type DateRange = [Dayjs | null, Dayjs | null] | null;

const RECIPIENT_META: Record<RecipientGroup, { label: string; color: string }> = {
  all: { label: "Barcha o'qituvchilar", color: 'blue' },
  professors: { label: 'Professorlar', color: 'purple' },
  dotsents: { label: 'Dotsentlar', color: 'geekblue' },
  deptHeads: { label: 'Kafedra mudirlari', color: 'gold' },
};

const RECIPIENT_OPTIONS = (Object.keys(RECIPIENT_META) as RecipientGroup[]).map((g) => ({
  value: g,
  label: RECIPIENT_META[g].label,
}));

const recipientTag = (group: RecipientGroup) => {
  const meta = RECIPIENT_META[group];
  return (
    <Tag color={meta.color} style={{ borderRadius: 6, fontWeight: 500, margin: 0 }}>
      {meta.label}
    </Tag>
  );
};

export default function ElonlarPage() {
  const { message, modal } = App.useApp();
  const can = usePermission();
  const canCreate = can('announcement:create');
  const canDelete = can('announcement:delete');

  const [search, setSearch] = useState('');
  const [recipientGroup, setRecipientGroup] = useState<RecipientGroup | undefined>();
  const [range, setRange] = useState<DateRange>(null);
  const [filtersKey, setFiltersKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [view, setView] = useState<Announcement | null>(null);

  const { rows, total, page, limit, loading, setPage, setLimit, resetFilters, reload } =
    useServerTable<Announcement>(fetchAnnouncementsPage, { initialLimit: 12 });
  const remove = useAnnouncementRemove();

  const [from, to] = range ?? [null, null];
  useEffect(() => {
    resetFilters({
      search: search || undefined,
      recipientGroup,
      from: from ? from.format('YYYY-MM-DD') : undefined,
      to: to ? to.format('YYYY-MM-DD') : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, recipientGroup, from, to]);

  const hasFilter = Boolean(search.trim() || recipientGroup || range?.[0] || range?.[1]);

  const handleReset = () => {
    setSearch('');
    setRecipientGroup(undefined);
    setRange(null);
    setFiltersKey((k) => k + 1);
  };

  const handleDelete = (item: Announcement) => {
    modal.confirm({
      title: "E'lonni o'chirish",
      content: `"${item.title}" o'chirilsinmi?`,
      okText: "O'chirish",
      okType: 'danger',
      cancelText: 'Bekor qilish',
      centered: true,
      onOk: async () => {
        try {
          await remove.mutateAsync(item.id);
          message.success("O'chirildi");
          if (page > 1 && rows.length === 1) setPage(page - 1);
          else void reload();
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
    });
  };

  const columns: ColumnDef<Announcement>[] = [
    { header: '#', id: '_i', size: 44, cell: ({ row }) => row.index + 1 },
    {
      header: 'Sarlavha',
      id: 'title',
      cell: ({ row }) => (
        <Typography.Link
          onClick={() => setView(row.original)}
          style={{ fontWeight: 500, cursor: 'pointer' }}
        >
          {row.original.title}
        </Typography.Link>
      ),
    },
    {
      header: 'Qabul qiluvchilar',
      id: 'recipientGroup',
      size: 180,
      cell: ({ row }) => recipientTag(row.original.recipientGroup),
    },
    {
      header: 'Qabul qiluvchilar soni',
      id: 'recipientCount',
      size: 190,
      cell: ({ row }) => row.original.recipientCount ?? '—',
    },
    {
      header: 'Fayl',
      id: 'fileUrl',
      size: 110,
      cell: ({ row }) =>
        row.original.fileUrl ? (
          <Typography.Link href={row.original.fileUrl} target="_blank" rel="noreferrer">
            <DownloadOutlined /> Yuklab olish
          </Typography.Link>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      header: 'Yuborilgan sana',
      id: 'createdAt',
      size: 170,
      cell: ({ row }) => fmt(row.original.createdAt),
    },
    {
      header: 'Amallar',
      id: '_a',
      size: 120,
      meta: { align: 'right' as const },
      cell: ({ row }) => (
        <ActionButtons
          onView={() => setView(row.original)}
          onDelete={canDelete ? () => handleDelete(row.original) : undefined}
          hideEdit
          hideDelete={!canDelete}
          hideToggle
        />
      ),
    },
  ];

  return (
    <PageContainer title="E'lonlar">
      <PageHeader
        title="E'lonlar"
        extra={
          <Flex gap={12} align="center" wrap>
            {canCreate && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateOpen(true)}
                style={{ height: 40 }}
              >
                E'lon yuborish
              </Button>
            )}
          </Flex>
        }
      />

      <Filters
        key={filtersKey}
        searchValue={search}
        searchPlaceholder="Sarlavha yoki mazmun bo'yicha"
        onSearch={setSearch}
        selects={[
          {
            key: 'recipientGroup',
            placeholder: 'Qabul qiluvchilar',
            value: recipientGroup,
            options: RECIPIENT_OPTIONS,
            onChange: (v) => setRecipientGroup(v as RecipientGroup | undefined),
          },
        ]}
        extra={
          <Flex gap={12} align="center" wrap>
            <RangePicker
              value={range}
              onChange={(v) => setRange(v)}
              format="DD.MM.YYYY"
              style={{ height: 38 }}
            />
            {hasFilter && (
              <Button icon={<ClearOutlined />} onClick={handleReset}>
                Tozalash
              </Button>
            )}
          </Flex>
        }
      />

      <DataTable<Announcement>
        data={rows}
        columns={columns}
        loading={loading}
        page={page}
        pageSize={limit}
        total={total}
        onPageChange={(p) => setPage(p)}
        onPageSizeChange={(size) => setLimit(size)}
      />

      <AnnouncementModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={reload}
      />

      <Modal
        open={!!view}
        onCancel={() => setView(null)}
        footer={null}
        title={view?.title}
        centered
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden' } }}
        width={560}
      >
        {view && (
          <>
            <Descriptions column={1} size="small" bordered styles={{ label: { width: 160 } }}>
              <Descriptions.Item label="Qabul qiluvchilar">
                {recipientTag(view.recipientGroup)}
              </Descriptions.Item>
              <Descriptions.Item label="Qamrov">{view.recipientCount ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Yuborgan">
                {view.createdBy?.fullName ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Sana">{fmt(view.createdAt)}</Descriptions.Item>
              {view.fileUrl && (
                <Descriptions.Item label="Fayl">
                  <Typography.Link href={view.fileUrl} target="_blank" rel="noreferrer">
                    <DownloadOutlined /> Yuklab olish
                  </Typography.Link>
                </Descriptions.Item>
              )}
            </Descriptions>
            <Paragraph style={{ marginTop: 16, whiteSpace: 'pre-wrap', color: 'var(--color-text)' }}>
              {view.content}
            </Paragraph>
          </>
        )}
      </Modal>
    </PageContainer>
  );
}
