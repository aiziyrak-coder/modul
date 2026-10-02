import { useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { App, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ActionButtons, DataTable, Filters, PageContainer, useModalStore } from '@/shared/ui';
import { usePageTitle } from '@/shared/lib/page-title-store';
import { getApiErrorMessage } from '@/shared/api';
import { Can } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import type { ContentLang, LangRecord } from '../../model/admission-types';
import { recordName } from '../../model/content-lang';
import { useLangRecords, useRemoveLangRecord } from '../../api/reference-api';
import { TableGap } from '../../components/table-gap';
import LangForm from './lang-form-modal';
import { useConfirm } from '../use-confirm';
import type { LangCrudColumn, LangCrudConfig } from './types';

const LIMIT = 12;

function renderCell(col: LangCrudColumn, record: LangRecord, lang: ContentLang) {
  if (col.kind === 'image') {
    const url = record[col.key];
    return url ? (
      <img
        src={url}
        alt=""
        style={{
          width: 32,
          height: 22,
          objectFit: 'cover',
          borderRadius: 3,
          border: '1px solid var(--color-border, #e2e8f0)',
        }}
      />
    ) : (
      <span style={{ color: 'var(--color-text-mute)' }}>—</span>
    );
  }

  const value = col.langBase ? recordName(record, col.langBase, lang) : record[col.key];
  return value ? (
    <span>{value}</span>
  ) : (
    <span style={{ color: 'var(--color-text-mute)' }}>—</span>
  );
}

export function LangCrudPage({ config }: { config: LangCrudConfig }) {
  const { t, lang } = useTranslation();
  const { message } = App.useApp();
  usePageTitle(t(config.titleKey));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);
  const [search, setSearch] = useState('');
  const showModal = useModalStore((s) => s.showModal);
  const { confirmDelete } = useConfirm();

  const openForm = (record: LangRecord | null) =>
    showModal({
      title: t(record ? config.editTitleKey : config.createTitleKey),
      maxWidth: '480px',
      body: () => <LangForm config={config} record={record} />,
    });

  const { data, isLoading } = useLangRecords(config.root, {
    page,
    limit: pageSize,
    ...(search ? { search } : {}),
  });
  const remove = useRemoveLangRecord(config.root);

  const handleDelete = (record: LangRecord) =>
    confirmDelete(
      async () => {
        try {
          await remove.mutateAsync(record.id);
          message.success(t('foreignAdmission.crud.deleted'));
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
      {
        title: t(config.deleteTitleKey),
        content: `"${recordName(record, 'title', lang)}" — ${t('foreignAdmission.crud.delete_warning')}`,
      },
    );

  const columns: ColumnDef<LangRecord>[] = [
    {
      header: '#',
      id: '_index',
      size: 48,
      cell: ({ row }) => (
        <span style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {(page - 1) * pageSize + row.index + 1}
        </span>
      ),
    },
    ...config.columns.map<ColumnDef<LangRecord>>((col) => ({
      header: t(col.titleKey),
      id: col.key,
      size: col.width,
      cell: ({ row }) => renderCell(col, row.original, lang),
    })),
    {
      header: t('foreignAdmission.col.created'),
      id: 'createdAt',
      size: 140,
      cell: ({ row }) =>
        row.original.createdAt ? dayjs(row.original.createdAt).format('DD/MM/YYYY') : '—',
    },
    {
      header: t('foreignAdmission.col.actions'),
      id: '_actions',
      size: 140,
      meta: { align: 'right' as const },
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
    <PageContainer title={t(config.titleKey)}>
      <Filters
        searchPlaceholder={config.searchPlaceholderKey}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        extra={
          <Can perform={`${config.section}:create`}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openForm(null)}
              style={{ height: 40 }}
            >
              {t(config.newButtonKey)}
            </Button>
          </Can>
        }
      />

      <TableGap>
        <DataTable<LangRecord>
          data={data?.items ?? []}
          columns={columns}
          loading={isLoading}
          page={page}
          pageSize={pageSize}
          total={data?.meta.total}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </TableGap>

    </PageContainer>
  );
}
