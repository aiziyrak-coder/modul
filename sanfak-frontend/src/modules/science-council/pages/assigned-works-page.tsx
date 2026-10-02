import { useMemo, useState } from 'react';
import { Flex, Spin, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { ActionButtons, PageContainer } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useSessionStore } from '@/app/session';
import { useAssignedWorks } from '../api/science-council-api';
import { StatusTag } from '../components/status-tag';
import type { ScientificWork } from '../model/types';
import { TablePagination } from '../components/table-pagination';
import { Shell } from '../components/table-pagination/style';
import { ExportButton } from '../components/export-button';
import { downloadExcel, datedFileName, type ExcelRow } from '../lib/excel';

export default function AssignedWorksPage() {
  const { t, lang } = useTranslation();
  const navigate = useNavigate();
  const CURRENT_MEMBER_ID = useSessionStore((s) => s.user?.id ?? '');
  const { data: works, isLoading } = useAssignedWorks(CURRENT_MEMBER_ID);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const pageRows = useMemo(
    () => (works ?? []).slice((page - 1) * pageSize, page * pageSize),
    [works, page, pageSize],
  );

  if (isLoading) {
    return (
      <PageContainer title={t('scienceCouncil.nav.assigned')}>
        <Flex justify="center" style={{ padding: 64 }}><Spin size="large" /></Flex>
      </PageContainer>
    );
  }

  const exportRows = () => {
    const rows: ExcelRow[] = (works ?? []).map((w, i) => ({
      '#': i + 1,
      [t('scienceCouncil.work.title')]: w.title,
      [t('scienceCouncil.work.author')]: w.researcher?.name ?? w.externalAuthor?.name ?? '—',
      [t('scienceCouncil.form.specialtyCode')]: w.specialty?.code ?? '—',
      [t('scienceCouncil.work.year')]: w.year ?? '—',
      [t('scienceCouncil.work.status')]: t(`scienceCouncil.status.${w.status}`),
      [t('scienceCouncil.work.date')]: w.createdAt?.slice(0, 10) ?? '—',
    }));
    downloadExcel(rows, datedFileName('Biriktirilgan_ishlar'), t('scienceCouncil.nav.assigned'),
      [5, 55, 28, 14, 13, 20, 13]);
  };

  const columns: ColumnsType<ScientificWork> = [
    {
      title: '№',
      key: 'index',
      width: 50,
      align: 'center' as const,
      render: (_v, _r, i) => (page - 1) * pageSize + i + 1,
    },
    { title: t('scienceCouncil.work.title'), dataIndex: 'title', key: 'title', ellipsis: true },
    {
      title: t('scienceCouncil.work.author'),
      key: 'author',
      width: 220,
      render: (_v, r) => r.researcher?.name ?? r.externalAuthor?.name ?? '—',
    },
    {
      title: t('scienceCouncil.work.status'),
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (_v, r) => <StatusTag status={r.status} />,
    },
    {
      title: lang === 'uz' ? 'Xulosalarim' : 'Мои заключения',
      key: 'reviewStatus',
      width: 140,
      render: (_v, r) => {
        const assignedDocKeys = Object.entries(r.docAssignments)
          .filter(([, arr]) => arr.includes(CURRENT_MEMBER_ID))
          .map(([k]) => k);
        const totalAssigned = assignedDocKeys.length;
        const writtenCount = r.reviews.filter(
          (rv) => rv.memberId === CURRENT_MEMBER_ID && assignedDocKeys.includes(rv.docKey),
        ).length;
        const allDone = totalAssigned > 0 && writtenCount >= totalAssigned;
        return (
          <Tag
            color={allDone ? 'green' : writtenCount > 0 ? 'blue' : 'orange'}
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/science-council/works/${r.id}?tab=reviews&from=assigned`);
            }}
          >
            {writtenCount}/{totalAssigned}
          </Tag>
        );
      },
    },
    {
      title: t('scienceCouncil.actions'),
      key: 'actions',
      width: 80,
      render: (_v, r) => (
        <ActionButtons onView={() => navigate(`/science-council/works/${r.id}?from=assigned`)} />
      ),
    },
  ];

  return (
    <PageContainer
      title={t('scienceCouncil.nav.assigned')}
      extra={
        <ExportButton
          onExport={exportRows}
          disabled={(works ?? []).length === 0}
          disabledReason={t('scienceCouncil.export.empty')}
        />
      }
    >
      <Shell>
        <Table<ScientificWork>
          dataSource={pageRows}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="small"
          locale={{ emptyText: t('scienceCouncil.noData') }}
        />
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={(works ?? []).length}
          onChange={(p, ps) => { setPage(p); setPageSize(ps); }}
          onPageSizeChange={(ps) => { setPageSize(ps); setPage(1); }}
        />
      </Shell>
    </PageContainer>
  );
}
