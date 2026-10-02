import { useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { App, Button, Flex, Tag, Tooltip } from 'antd';
import { EyeOutlined, LockOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ActionButtons, DataTable, Filters, PageContainer, useModalStore } from '@/shared/ui';
import { usePageTitle } from '@/shared/lib/page-title-store';
import { getApiErrorMessage } from '@/shared/api';
import { Can } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import type { AdmissionSeason, SeasonName, SeasonStatus } from '../model/admission-types';
import { pickLang } from '../model/content-lang';
import {
  useAcademicYears,
  useCloseSeason,
  useDeleteSeason,
  useSeasonsPaginated,
} from '../api/season-api';
import { TableGap } from '../components/table-gap';
import SeasonForm from '../components/season-form-modal';
import { useConfirm } from '../lib/use-confirm';
import {
  SEASON_META,
  SEASON_ORDER,
  SEASON_STATUS_META,
  SEASON_STATUS_ORDER,
  isSeasonEditable,
} from '../lib/season-options';

const LIMIT = 12;

export default function SeasonsPage() {
  const { t, lang } = useTranslation();
  const { message } = App.useApp();
  usePageTitle(t('foreignAdmission.nav.seasons'));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);
  const [search, setSearch] = useState('');
  const [year, setYear] = useState<string>();
  const [season, setSeason] = useState<SeasonName>();
  const [status, setStatus] = useState<SeasonStatus>();
  const showModal = useModalStore((s) => s.showModal);
  const { confirmDelete, confirm } = useConfirm();

  const openForm = (record: AdmissionSeason | null, readOnly = false) =>
    showModal({
      title: t(
        readOnly
          ? 'foreignAdmission.seasons.view'
          : record
            ? 'foreignAdmission.seasons.edit'
            : 'foreignAdmission.seasons.create',
      ),
      maxWidth: '560px',
      body: () => <SeasonForm season={record} readOnly={readOnly} />,
    });

  const { data, isLoading } = useSeasonsPaginated({
    page,
    limit: pageSize,
    ...(search ? { search } : {}),
    ...(year ? { academicYear: year } : {}),
    ...(season ? { season } : {}),
    ...(status ? { status } : {}),
  });
  const remove = useDeleteSeason();
  const close = useCloseSeason();
  const academicYears = useAcademicYears();

  const resetPage = () => setPage(1);

  const seasonName = (record: AdmissionSeason) =>
    pickLang(record as unknown as Record<string, string | undefined>, 'title', lang);

  const handleDelete = (record: AdmissionSeason) =>
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
        title: t('foreignAdmission.seasons.delete_title'),
        content: `"${seasonName(record)}" — ${t('foreignAdmission.crud.delete_warning')}`,
      },
    );

  const handleClose = (record: AdmissionSeason) =>
    confirm(
      async () => {
        try {
          await close.mutateAsync(record.id);
          message.success(t('foreignAdmission.seasons.closed'));
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
      {
        title: t('foreignAdmission.seasons.close_title'),
        content: `"${seasonName(record)}" — ${t('foreignAdmission.seasons.close_warning')}`,
        okText: t('foreignAdmission.seasons.close_ok'),
        danger: true,
      },
    );

  const columns: ColumnDef<AdmissionSeason>[] = [
    {
      header: t('foreignAdmission.seasons.title'),
      id: 'title',
      cell: ({ row }) => (
        <strong>
          {pickLang(row.original as unknown as Record<string, string | undefined>, 'title', lang)}
        </strong>
      ),
    },
    {
      header: t('foreignAdmission.seasons.season'),
      id: 'season',
      size: 120,
      cell: ({ row }) => {
        const meta = SEASON_META[row.original.season];
        return (
          <Tag color={meta.color} style={{ borderRadius: 999 }}>
            {t(meta.titleKey)}
          </Tag>
        );
      },
    },
    {
      header: t('foreignAdmission.field.academic_year'),
      accessorKey: 'academicYear',
      size: 120,
    },
    {
      header: t('foreignAdmission.seasons.open_date'),
      id: 'openDate',
      size: 140,
      cell: ({ row }) => dayjs(row.original.openDate).format('DD/MM/YYYY'),
    },
    {
      header: t('foreignAdmission.seasons.close_date'),
      id: 'closeDate',
      size: 140,
      cell: ({ row }) => dayjs(row.original.closeDate).format('DD/MM/YYYY'),
    },
    {
      header: t('foreignAdmission.col.status'),
      id: 'status',
      size: 130,
      cell: ({ row }) => {
        const meta = SEASON_STATUS_META[row.original.status];
        return (
          <Tag color={meta.color} style={{ borderRadius: 999 }}>
            {t(meta.titleKey)}
          </Tag>
        );
      },
    },
    {
      header: t('foreignAdmission.col.actions'),
      id: '_actions',
      size: 190,
      meta: { align: 'right' as const },
      cell: ({ row }) => {
        const record = row.original;
        if (!isSeasonEditable(record.status)) {
          return (
            <Flex justify="flex-end">
              <Tooltip title={t('foreignAdmission.view')}>
                <Button
                  type="text"
                  icon={<EyeOutlined />}
                  onClick={() => openForm(record, true)}
                />
              </Tooltip>
            </Flex>
          );
        }
        return (
          <Flex align="center" justify="flex-end" gap={4}>
            <Can perform="admissionSeason:changeStatus">
              <Tooltip title={t('foreignAdmission.seasons.close_ok')}>
                <Button type="text" icon={<LockOutlined />} onClick={() => handleClose(record)} />
              </Tooltip>
            </Can>
            <ActionButtons
              onEdit={() => openForm(record)}
              onDelete={() => handleDelete(record)}
              hideToggle
            />
          </Flex>
        );
      },
    },
  ];

  return (
    <PageContainer title={t('foreignAdmission.nav.seasons')}>
      <Filters
        searchPlaceholder="foreignAdmission.seasons.search_ph"
        onSearch={(v) => {
          setSearch(v);
          resetPage();
        }}
        selects={[
          {
            key: 'year',
            placeholder: 'foreignAdmission.seasons.year_all',
            value: year,
            options: (academicYears.data ?? []).map((y) => ({ value: y, label: y })),
            onChange: (v) => {
              setYear(v);
              resetPage();
            },
          },
          {
            key: 'season',
            placeholder: 'foreignAdmission.seasons.season_all',
            value: season,
            options: SEASON_ORDER.map((s) => ({ value: s, label: t(SEASON_META[s].titleKey) })),
            onChange: (v) => {
              setSeason(v as SeasonName | undefined);
              resetPage();
            },
          },
          {
            key: 'status',
            placeholder: 'foreignAdmission.filters.status_ph',
            value: status,
            options: SEASON_STATUS_ORDER.map((s) => ({
              value: s,
              label: t(SEASON_STATUS_META[s].titleKey),
            })),
            onChange: (v) => {
              setStatus(v as SeasonStatus | undefined);
              resetPage();
            },
          },
        ]}
        extra={
          <Can perform="admissionSeason:create">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openForm(null)}
              style={{ height: 40 }}
            >
              {t('foreignAdmission.seasons.new')}
            </Button>
          </Can>
        }
      />

      <TableGap>
        <DataTable<AdmissionSeason>
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
