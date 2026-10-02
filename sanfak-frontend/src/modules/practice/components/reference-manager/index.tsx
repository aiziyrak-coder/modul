import { useEffect, useMemo, useState } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { App, Button, Form, Input, Modal, Select } from 'antd';
import type { ColumnDef } from '@tanstack/react-table';
import { PageContainer, DataTable, ActionButtons, Filters } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { Can } from '@/app/session';
import { PageHeader } from '../page-header';
import type { RefItem } from '../../model/types';
import type { ReferenceName } from '../../api/mock-store';
import { useServerTable } from '../../lib/use-server-table';
import {
  fetchReferencePage,
  useReferenceList,
  useReferenceCreate,
  useReferenceUpdate,
  useReferenceRemove,
} from '../../api/practice-api';

type Row = RefItem & { region?: RefItem };

export interface ReferenceManagerConfig {
  name: ReferenceName;
  section: string;
  title: string;
  newButton: string;
  columnLabel: string;
  withRegion?: boolean;
  withDistrictCount?: boolean;
  pattern?: { re: RegExp; message: string };
}

interface EditState {
  open: boolean;
  id: string | null;
  title: string;
  regionId?: string;
}

export function ReferenceManager({ config }: { config: ReferenceManagerConfig }) {
  const { message, modal } = App.useApp();
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState<string | undefined>();
  const [edit, setEdit] = useState<EditState>({ open: false, id: null, title: '' });

  const fetcher = useMemo(() => fetchReferencePage(config.name), [config.name]);
  const { rows, total, page, limit, loading, setPage, setLimit, resetFilters, reload } =
    useServerTable<Row>(fetcher, { initialLimit: 10 });
  const regions = useReferenceList('regions');
  const districts = useReferenceList('districts');
  const create = useReferenceCreate(config.name);
  const update = useReferenceUpdate(config.name);
  const remove = useReferenceRemove(config.name);

  useEffect(() => {
    resetFilters({ search: search || undefined, region: config.withRegion ? regionFilter : undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, regionFilter]);

  const regionOptions = (regions.data ?? []).map((r) => ({ value: r.id, label: r.title }));

  const districtCountByRegion = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of (districts.data ?? []) as Row[]) {
      const rid = d.region?.id;
      if (rid) map.set(rid, (map.get(rid) ?? 0) + 1);
    }
    return map;
  }, [districts.data]);

  const openCreate = () => setEdit({ open: true, id: null, title: '', regionId: undefined });
  const openEdit = (row: Row) =>
    setEdit({ open: true, id: row.id, title: row.title, regionId: row.region?.id });
  const close = () => setEdit({ open: false, id: null, title: '' });

  const submit = async () => {
    if (!edit.title.trim()) {
      message.error('Nom kiriting');
      return;
    }
    if (config.withRegion && !edit.regionId) {
      message.error('Viloyatni tanlang');
      return;
    }
    if (config.pattern && !config.pattern.re.test(edit.title.trim())) {
      message.error(config.pattern.message);
      return;
    }
    try {
      if (edit.id) {
        await update.mutateAsync({ id: edit.id, title: edit.title.trim(), regionId: edit.regionId });
        message.success('Yangilandi');
      } else {
        await create.mutateAsync({ title: edit.title.trim(), regionId: edit.regionId });
        message.success('Qo‘shildi');
      }
      close();
      void reload();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleDelete = (row: Row) => {
    modal.confirm({
      title: `${config.title} — o'chirish`,
      content: `"${row.title}" o'chirilsinmi?`,
      okText: "O'chirish",
      okType: 'danger',
      cancelText: 'Bekor qilish',
      centered: true,
      onOk: async () => {
        try {
          await remove.mutateAsync(row.id);
          message.success("O'chirildi");
          if (page > 1 && rows.length === 1) setPage(page - 1);
          else void reload();
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
    });
  };

  const columns: ColumnDef<Row>[] = [
    { header: '#', id: '_i', size: 48, cell: ({ row }) => (page - 1) * limit + row.index + 1 },
    { header: config.columnLabel, id: 'title', cell: ({ row }) => row.original.title },
    ...(config.withRegion
      ? [
          {
            header: 'Viloyat',
            id: 'region',
            cell: ({ row }) => row.original.region?.title ?? '—',
          } as ColumnDef<Row>,
        ]
      : []),
    ...(config.withDistrictCount
      ? [
          {
            header: 'Shahar / Tumanlar',
            id: '_dcount',
            size: 150,
            cell: ({ row }) => districtCountByRegion.get(row.original.id) ?? 0,
          } as ColumnDef<Row>,
        ]
      : []),
    {
      header: 'Amallar',
      id: '_a',
      size: 140,
      meta: { align: 'right' as const },
      cell: ({ row }) => (
        <ActionButtons
          onEdit={() => openEdit(row.original)}
          onDelete={() => handleDelete(row.original)}
          hideToggle
        />
      ),
    },
  ];

  return (
    <PageContainer title={config.title}>
      <PageHeader title={config.title} />
      <Filters
        searchPlaceholder="Qidirish"
        onSearch={(v) => setSearch(v)}
        selects={
          config.withRegion
            ? [
                {
                  key: 'region',
                  placeholder: 'Viloyat',
                  value: regionFilter,
                  options: regionOptions,
                  onChange: setRegionFilter,
                },
              ]
            : undefined
        }
        extra={
          <Can perform={`${config.section}:create`}>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} style={{ height: 40 }}>
              {config.newButton}
            </Button>
          </Can>
        }
      />
      <DataTable<Row>
        data={rows}
        columns={columns}
        loading={loading}
        page={page}
        pageSize={limit}
        total={total}
        onPageChange={(p) => setPage(p)}
        onPageSizeChange={(size) => setLimit(size)}
      />

      <Modal
        open={edit.open}
        onCancel={close}
        onOk={submit}
        title={edit.id ? `${config.title} — tahrirlash` : config.newButton}
        okText="Saqlash"
        cancelText="Bekor qilish"
        centered
        confirmLoading={create.isPending || update.isPending}
      >
        <Form layout="vertical" style={{ marginTop: 12 }}>
          {config.withRegion && (
            <Form.Item label="Viloyat" required>
              <Select
                value={edit.regionId}
                options={regionOptions}
                onChange={(v) => setEdit((p) => ({ ...p, regionId: v }))}
                placeholder="Viloyatni tanlang"
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          )}
          <Form.Item label={config.columnLabel} required>
            <Input
              value={edit.title}
              onChange={(e) => setEdit((p) => ({ ...p, title: e.target.value }))}
              placeholder={config.columnLabel}
              onPressEnter={submit}
            />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}
