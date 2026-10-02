import { useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { Typography } from 'antd';
import dayjs from 'dayjs';
import { PageContainer, DataTable } from '@/shared/ui';
import { usePermission } from '@/app/session';
import { usePageTitle } from '@/shared/lib/page-title-store';
import { useApplicantsPaginated } from '../api/foreign-admission-api';
import { TableGap } from '../components/table-gap';
import { ApplicantsFilters, type ApplicantFilters } from '../widgets/applicants-filters';
import { ApplicantRowActions } from '../components/applicant-row-actions';
import { StatusTag } from '../components/status-tag';
import { useTranslation } from '@/shared/lib/i18n';
import { refName } from '../model/content-lang';
import { useCountryLocalizer } from '../lib/use-country-localizer';
import type { Applicant } from '../model/types';

const LIMIT = 12;

const TO_BACKEND_STATUS = {
  yangi: 'new',
  tasdiqlangan: 'approved',
  radEtilgan: 'rejected',
} as const;

export default function AdminListPage() {
  const { t, lang } = useTranslation();
  const can = usePermission();
  const showActions = can('internationalAdmission:approve') || can('internationalAdmission:reject');
  usePageTitle(t('foreignAdmission.nav.applications'));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);
  const [filters, setFilters] = useState<ApplicantFilters>({
    search: '',
    country: undefined,
    status: undefined,
    dateFrom: undefined,
    dateTo: undefined,
  });

  const { data, isLoading } = useApplicantsPaginated({
    page,
    limit: pageSize,
    search: filters.search || undefined,
    country: filters.country,
    status: filters.status ? TO_BACKEND_STATUS[filters.status] : undefined,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  });

  const localizeCountry = useCountryLocalizer();

  const columns: ColumnDef<Applicant>[] = [
    {
      header: t('foreignAdmission.col.id'),
      id: 'applicationNumber',
      size: 150,
      cell: ({ row }) => {
        const num = row.original.applicationNumber;
        return (
          <Typography.Text
            copyable={num ? { text: num } : false}
            style={{ fontSize: 12, color: 'var(--color-text-soft)' }}
          >
            {num ?? row.original.id.slice(-8)}
          </Typography.Text>
        );
      },
    },
    {
      header: t('foreignAdmission.col.name'),
      accessorKey: 'fullName',
      cell: ({ row }) => <strong>{row.original.fullName}</strong>,
    },
    {
      header: t('foreignAdmission.col.country'),
      id: 'country',
      cell: ({ row }) => localizeCountry(row.original.country),
    },
    {
      header: t('foreignAdmission.col.direction'),
      id: 'direction',
      cell: ({ row }) => refName(row.original.direction, lang),
    },
    {
      header: t('foreignAdmission.col.created'),
      accessorKey: 'createdAt',
      size: 130,
      cell: ({ row }) =>
        row.original.createdAt ? dayjs(row.original.createdAt).format('YYYY-MM-DD') : '—',
    },
    {
      header: t('foreignAdmission.col.status'),
      id: 'status',
      size: 150,
      cell: ({ row }) => (
        <StatusTag status={row.original.status} rejectionReason={row.original.rejectionReason} />
      ),
    },
    ...(showActions
      ? [
          {
            header: t('foreignAdmission.col.actions'),
            id: 'actions',
            size: 160,
            meta: { align: 'right' as const },
            cell: ({ row }) => <ApplicantRowActions applicant={row.original} />,
          } satisfies ColumnDef<Applicant>,
        ]
      : []),
  ];

  return (
    <PageContainer title={t('foreignAdmission.nav.applications')}>
      <ApplicantsFilters
        value={filters}
        onChange={(v) => {
          setFilters(v);
          setPage(1);
        }}
      />

      <TableGap>
        <DataTable<Applicant>
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
      </TableGap>
    </PageContainer>
  );
}
