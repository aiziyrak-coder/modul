import { useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { App, Button, Flex, Tag, Tooltip, Typography } from 'antd';
import { DownloadOutlined, SendOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { DataTable, Filters, PageContainer, useModalStore } from '@/shared/ui';
import { usePageTitle } from '@/shared/lib/page-title-store';
import { Can } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import type { AdmissionMessage, SeasonName } from '../model/admission-types';
import { refName, toOptions } from '../model/content-lang';
import { REF_ROOTS, useAllLangRecords } from '../api/reference-api';
import { useMessagesPaginated } from '../api/message-api';
import { useAcademicYears } from '../api/season-api';
import { TableGap } from '../components/table-gap';
import SendMessageForm from '../components/send-message-modal';
import { SEASON_META, SEASON_ORDER } from '../lib/season-options';
import { downloadExcel } from '../lib/excel';

const LIMIT = 12;

export default function MessagesPage() {
  const { t, lang } = useTranslation();
  const { message } = App.useApp();
  usePageTitle(t('foreignAdmission.nav.messages'));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState<string>();
  const [year, setYear] = useState<string>();
  const [season, setSeason] = useState<SeasonName>();
  const showModal = useModalStore((s) => s.showModal);

  const openSendForm = () =>
    showModal({
      title: t('foreignAdmission.messages.send'),
      maxWidth: '480px',
      body: SendMessageForm,
    });

  const directions = useAllLangRecords(REF_ROOTS.directions);
  const academicYears = useAcademicYears();

  const filters = {
    ...(search ? { search } : {}),
    ...(direction ? { direction } : {}),
    ...(year ? { academicYear: year } : {}),
    ...(season ? { season } : {}),
  };

  const { data, isLoading } = useMessagesPaginated({ page, limit: pageSize, ...filters });

  const asRefs = (records: ReturnType<typeof useAllLangRecords>['data']) =>
    (records ?? []).map((r) => ({
      id: r.id,
      titleUz: r.titleUz ?? '',
      titleRu: r.titleRu,
      titleEn: r.titleEn,
    }));

  const resetPage = () => setPage(1);

  const handleExport = () => {
    const rows = (data?.items ?? []).map((m, i) => ({
      '#': (page - 1) * pageSize + i + 1,
      [t('foreignAdmission.messages.text')]: m.text,
      [t('foreignAdmission.col.direction')]: refName(m.direction, lang, t('foreignAdmission.messages.direction_all')),
      [t('foreignAdmission.nav.educationLanguages')]: refName(m.educationLanguage, lang),
      [t('foreignAdmission.field.academic_year')]: m.academicYear,
      [t('foreignAdmission.seasons.season')]: t(SEASON_META[m.season].titleKey),
      [t('foreignAdmission.messages.delivered')]: `${m.deliveredCount}/${m.recipientCount}`,
      [t('foreignAdmission.col.created')]: dayjs(m.sentAt).format('DD/MM/YYYY HH:mm'),
    }));
    if (!rows.length) {
      message.warning(t('foreignAdmission.messages.export_empty'));
      return;
    }
    downloadExcel(rows, 'xalqaro-qabul-xabarlar', t('foreignAdmission.nav.messages'));
  };

  const columns: ColumnDef<AdmissionMessage>[] = [
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
    {
      header: t('foreignAdmission.messages.text'),
      id: 'text',
      cell: ({ row }) => (
        <Tooltip title={row.original.text}>
          <Typography.Text ellipsis style={{ maxWidth: 320, fontSize: 13 }}>
            {row.original.text}
          </Typography.Text>
        </Tooltip>
      ),
    },
    {
      header: t('foreignAdmission.col.direction'),
      id: 'direction',
      size: 180,
      cell: ({ row }) =>
        refName(row.original.direction, lang, t('foreignAdmission.messages.direction_all')),
    },
    {
      header: t('foreignAdmission.nav.educationLanguages'),
      id: 'educationLanguage',
      size: 120,
      cell: ({ row }) => refName(row.original.educationLanguage, lang),
    },
    {
      header: t('foreignAdmission.field.academic_year'),
      accessorKey: 'academicYear',
      size: 110,
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
      header: t('foreignAdmission.messages.delivered'),
      id: 'delivered',
      size: 110,
      meta: { align: 'center' as const },
      cell: ({ row }) => (
        <span style={{ fontSize: 13 }}>
          {row.original.deliveredCount}/{row.original.recipientCount}
        </span>
      ),
    },
    {
      header: t('foreignAdmission.col.created'),
      id: 'sentAt',
      size: 150,
      cell: ({ row }) => dayjs(row.original.sentAt).format('DD/MM/YYYY HH:mm'),
    },
  ];

  return (
    <PageContainer title={t('foreignAdmission.nav.messages')}>
      <Filters
        searchPlaceholder="foreignAdmission.messages.search_ph"
        onSearch={(v) => {
          setSearch(v);
          resetPage();
        }}
        selects={[
          {
            key: 'direction',
            placeholder: 'foreignAdmission.messages.direction_all',
            value: direction,
            options: toOptions(asRefs(directions.data), lang),
            onChange: (v) => {
              setDirection(v);
              resetPage();
            },
          },
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
        ]}
        extra={
          <Flex gap={10}>
            <Can perform="admissionMessage:export">
              <Button icon={<DownloadOutlined />} onClick={handleExport} style={{ height: 40 }}>
                {t('foreignAdmission.messages.export')}
              </Button>
            </Can>
            <Can perform="admissionMessage:create">
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={openSendForm}
                style={{ height: 40 }}
              >
                {t('foreignAdmission.messages.send')}
              </Button>
            </Can>
          </Flex>
        }
      />

      <TableGap>
        <DataTable<AdmissionMessage>
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
