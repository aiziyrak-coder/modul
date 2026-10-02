import { useEffect, useState } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { App, Button, Descriptions, Flex, Modal } from 'antd';
import dayjs from 'dayjs';
import type { ColumnDef } from '@tanstack/react-table';
import { PageContainer, DataTable, ActionButtons, Filters, phoneToDisplay } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { PageHeader } from '../components/page-header';
import { BaseDrawer } from '../components/base-drawer';
import type { PracticeBase } from '../model/types';
import { usePracticeRole } from '../model/view-role';
import { useServerTable } from '../lib/use-server-table';
import { fetchBasesPage, useBaseRemove, useReferenceList } from '../api/practice-api';

export default function BazalarPage() {
  const { message, modal } = App.useApp();
  const role = usePracticeRole();
  const isDept = role === 'amaliyot_bolimi';

  const [search, setSearch] = useState('');
  const [orgTypeId, setOrgTypeId] = useState<string | undefined>();
  const [regionId, setRegionId] = useState<string | undefined>();
  const [drawer, setDrawer] = useState<{ open: boolean; base: PracticeBase | null }>({ open: false, base: null });
  const [view, setView] = useState<PracticeBase | null>(null);

  const { rows, total, page, limit, loading, setPage, setLimit, resetFilters, reload } =
    useServerTable<PracticeBase>(fetchBasesPage, { initialLimit: 12 });
  const orgTypes = useReferenceList('orgTypes');
  const regions = useReferenceList('regions');
  const remove = useBaseRemove();

  useEffect(() => {
    resetFilters({ search: search || undefined, orgTypeId, regionId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, orgTypeId, regionId]);

  const handleDelete = (base: PracticeBase) => {
    modal.confirm({
      title: "Bazani o'chirish",
      content: `"${base.title}" o'chirilsinmi?`,
      okText: "O'chirish",
      okType: 'danger',
      cancelText: 'Bekor qilish',
      centered: true,
      onOk: async () => {
        try {
          await remove.mutateAsync(base.id);
          message.success("O'chirildi");
          if (page > 1 && rows.length === 1) setPage(page - 1);
          else void reload();
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
    });
  };

  const columns: ColumnDef<PracticeBase>[] = [
    { header: '#', id: '_i', size: 44, cell: ({ row }) => (page - 1) * limit + row.index + 1 },
    {
      header: 'Tashkilot nomi',
      id: 'title',
      cell: ({ row }) => (
        <div>
          <div style={{ fontWeight: 500, color: 'var(--color-text)' }}>{row.original.title}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-soft, #697586)' }}>
            {row.original.region.title}, {row.original.district.title}
          </div>
        </div>
      ),
    },
    { header: 'Turi', id: 'orgType', cell: ({ row }) => row.original.orgType.title },
    { header: 'STIR', id: 'stir', size: 120, cell: ({ row }) => row.original.stir },
    { header: 'Rahbar', id: 'head', cell: ({ row }) => row.original.headName },
    {
      header: 'Amallar',
      id: '_a',
      size: 150,
      meta: { align: 'right' as const },
      cell: ({ row }) => (
        <ActionButtons
          onView={() => setView(row.original)}
          onEdit={isDept ? () => setDrawer({ open: true, base: row.original }) : undefined}
          onDelete={isDept ? () => handleDelete(row.original) : undefined}
          hideEdit={!isDept}
          hideDelete={!isDept}
          hideToggle
        />
      ),
    },
  ];

  return (
    <PageContainer title="Amaliyot bazalari">
      <PageHeader
        title="Amaliyot bazalari"
        extra={
          <Flex gap={12} align="center" wrap>
            {isDept && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setDrawer({ open: true, base: null })}
                style={{ height: 40 }}
              >
                Baza qo'shish
              </Button>
            )}
          </Flex>
        }
      />

      <Filters
        searchPlaceholder="Nomi, STIR yoki rahbar bo'yicha"
        onSearch={setSearch}
        selects={[
          {
            key: 'orgType',
            placeholder: 'Tashkilot turi',
            value: orgTypeId,
            options: (orgTypes.data ?? []).map((o) => ({ value: o.id, label: o.title })),
            onChange: setOrgTypeId,
          },
          {
            key: 'region',
            placeholder: 'Viloyat',
            value: regionId,
            options: (regions.data ?? []).map((o) => ({ value: o.id, label: o.title })),
            onChange: setRegionId,
          },
        ]}
      />

      <DataTable<PracticeBase>
        data={rows}
        columns={columns}
        loading={loading}
        page={page}
        pageSize={limit}
        total={total}
        onPageChange={(p) => setPage(p)}
        onPageSizeChange={(size) => setLimit(size)}
      />

      <BaseDrawer
        open={drawer.open}
        base={drawer.base}
        onClose={() => setDrawer({ open: false, base: null })}
        onSuccess={reload}
      />

      <Modal
        open={!!view}
        onCancel={() => setView(null)}
        footer={null}
        title={view?.title}
        centered
        width={560}
      >
        {view && (
          <Descriptions
            column={1}
            size="small"
            bordered
            styles={{ label: { width: 180 }, content: { textAlign: 'right', fontWeight: 500 } }}
          >
            <Descriptions.Item label="Tashkilot nomi">{view.title}</Descriptions.Item>
            <Descriptions.Item label="Turi">{view.orgType.title}</Descriptions.Item>
            <Descriptions.Item label="STIR">{view.stir}</Descriptions.Item>
            <Descriptions.Item label="Hudud">
              {view.region.title}, {view.district.title}
            </Descriptions.Item>
            <Descriptions.Item label="Manzil">{view.address}</Descriptions.Item>
            <Descriptions.Item label="Rahbar">{view.headName}</Descriptions.Item>
            <Descriptions.Item label="Rahbar JSHSHIR">{view.headJshshir}</Descriptions.Item>
            <Descriptions.Item label="Mas'ul vakillar">
              {view.responsibleUsers.length > 0
                ? view.responsibleUsers
                    .map((u) => [u.firstName, u.lastName].filter(Boolean).join(' '))
                    .join(', ')
                : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Sig'im">{view.capacity ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Telefon">{phoneToDisplay(view.headPhone) || '—'}</Descriptions.Item>
            <Descriptions.Item label="Email">{view.email ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Ro'yxatga olingan">
              {view.createdAt ? dayjs(view.createdAt).format('DD.MM.YYYY') : '—'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </PageContainer>
  );
}
