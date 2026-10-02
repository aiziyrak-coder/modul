import { useMemo, useState } from 'react';
import { Button, Empty, Select, Space, Table, Tooltip, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CalendarOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { PageContainer } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { ExportButton } from '../components/export-button';
import { downloadExcel, datedFileName, type ExcelRow } from '../lib/excel';
import { useSessionStore } from '@/app/session';
import { useMyWorks, useCreateWork, useUploadWorkFile } from '../api/science-council-api';
import { StatusTag } from '../components/status-tag';
import { SeminarResultTag } from '../components/seminar-result-tag';
import { WorkApplicationModal } from '../components/work-application-modal';
import { DOCUMENT_CATEGORIES } from '../lib/document-categories';
import { formatDate } from '../lib/format-date';
import type { ScientificWork, WorkInput } from '../model/types';
import { TablePagination } from '../components/table-pagination';
import { stickyFooterCard } from '../components/table-pagination/style';

const FilterBar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
`;

const FilterLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-tertiary, #6b7280);
`;

const Card = styled.div`
  background: var(--bg-surface, #fff);
  border-radius: var(--radius-lg, 14px);
  border: 1px solid var(--border-secondary, #e5e7eb);
  ${stickyFooterCard}
`;

export default function MyWorkPage() {
  const { t, lang } = useTranslation();
  const navigate = useNavigate();
  const userId = useSessionStore((s) => s.user?.id ?? '');
  const { data: works, isLoading } = useMyWorks();

  const [selectedYear, setSelectedYear] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const createMut = useCreateWork();
  const uploadFileMut = useUploadWorkFile();

  const handleApply = (values: Partial<WorkInput>, file: File) => {
    createMut.mutate({ ...values, authorId: userId }, {
      onSuccess: (res) => {
        uploadFileMut.mutate(
          { workId: res._id, file },
          {
            onSuccess: () => {
              message.success(t('scienceCouncil.apply.success'));
              setApplyModalOpen(false);
              setPage(1);
            },
            onError: () => {
              message.warning(t('scienceCouncil.apply.fileUploadError'));
              setApplyModalOpen(false);
              setPage(1);
            },
          },
        );
      },
    });
  };

  const allMyWorks = useMemo(() => {
    const list = works ?? [];
    return (
      list
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    );
  }, [works]);

  const yearOptions = useMemo(() => {
    const years = [...new Set(allMyWorks.map((w) => w.year))].sort().reverse();
    return years.map((y) => ({ label: y, value: y }));
  }, [allMyWorks]);

  const filtered = useMemo(
    () => (selectedYear ? allMyWorks.filter((w) => w.year === selectedYear) : allMyWorks),
    [allMyWorks, selectedYear],
  );

  const exportRows = () => {
    const rows: ExcelRow[] = filtered.map((w, i) => ({
      '#': i + 1,
      [t('scienceCouncil.work.title')]: w.title,
      [t('scienceCouncil.form.specialtyCode')]: w.specialty?.code ?? '—',
      [t('scienceCouncil.detail.specialty')]: w.specialty?.title ?? '—',
      [t('scienceCouncil.work.year')]: w.year ?? '—',
      [t('scienceCouncil.work.status')]: t(`scienceCouncil.status.${w.status}`),
      [t('scienceCouncil.work.date')]: w.createdAt?.slice(0, 10) ?? '—',
    }));
    downloadExcel(rows, datedFileName('Mening_ilmiy_ishlarim'), t('scienceCouncil.nav.myWork'),
      [5, 55, 14, 30, 13, 20, 13]);
  };


  const pageRows = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  const columns: ColumnsType<ScientificWork> = [
    {
      title: '№',
      key: 'index',
      width: 50,
      render: (_v, _r, i) => <span style={{ color: '#9ca3af', fontSize: 13 }}>{(page - 1) * pageSize + i + 1}</span>,
    },
    {
      title: lang === 'uz' ? 'Ilmiy ish nomi' : 'Название работы',
      key: 'title',
      render: (_v, w) => {
        const docsUploaded = Object.values(w.documents).filter((d) => d.uploaded).length;
        return (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-text, #111827)', fontSize: 13.5, marginBottom: 3 }}>
              {lang === 'ru' && w.titleRu ? w.titleRu : w.title}
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--color-text-tertiary, #6b7280)', flexWrap: 'wrap' }}>
              <span>{docsUploaded}/{DOCUMENT_CATEGORIES.length} {lang === 'uz' ? 'hujjat' : 'док.'}</span>
              {w.protocol?.eImzoSigned && (
                <span style={{ color: '#7c3aed' }}>{lang === 'uz' ? 'Dalolatnoma' : 'Акт'}</span>
              )}
              {w.seminarDate && (
                <span style={{ color: '#16a34a' }}>{formatDate(w.seminarDate)}</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: lang === 'uz' ? 'Sana' : 'Дата',
      key: 'date',
      width: 130,
      render: (_v, w) => (
        <div style={{ fontSize: 12 }}>
          <div style={{ color: 'var(--color-text, #374151)' }}>{w.createdAt?.slice(0, 10)}</div>
          {w.updatedAt !== w.createdAt && (
            <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 2 }}>
              ↻ {w.updatedAt?.slice(0, 10)}
            </div>
          )}
        </div>
      ),
    },
    {
      title: lang === 'uz' ? 'Holati' : 'Статус',
      key: 'status',
      width: 220,
      render: (_v, w) => (
        <div>
          <StatusTag status={w.status} reason={w.rejectionReason} />
          {w.status === 'revision' && w.revisionComment && (
            <Tooltip title={w.revisionComment}>
              <div style={{ fontSize: 11, color: '#9333ea', marginTop: 4, cursor: 'help', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {w.revisionComment}
              </div>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      title: t('scienceCouncil.seminar.date'),
      key: 'seminarDate',
      width: 130,
      render: (_v, w) => (
        <span style={{ fontSize: 12, color: 'var(--color-text, #374151)' }}>
          {formatDate(w.seminarDate)}
        </span>
      ),
    },
    {
      title: t('scienceCouncil.seminar.result'),
      key: 'seminarResult',
      width: 170,
      render: (_v, w) => <SeminarResultTag result={w.seminarResult} />,
    },
  ];

  const headerActions = (
    <Space size={12}>
      <ExportButton
        onExport={exportRows}
        disabled={filtered.length === 0}
        disabledReason={t('scienceCouncil.export.empty')}
      />
      <Button type="primary" icon={<PlusOutlined />} onClick={() => setApplyModalOpen(true)}>
        {t('scienceCouncil.apply.button')}
      </Button>
    </Space>
  );

  const applyModal = (
    <WorkApplicationModal
      open={applyModalOpen}
      onClose={() => setApplyModalOpen(false)}
      onSubmit={handleApply}
      loading={createMut.isPending || uploadFileMut.isPending}
    />
  );

  if (!isLoading && allMyWorks.length === 0) {
    return (
      <PageContainer title={t('scienceCouncil.nav.myWork')} extra={headerActions}>
        <Card style={{ padding: 60, textAlign: 'center' }}>
          <Empty
            description={
              lang === 'uz'
                ? "Sizning ilmiy ishlaringiz hali ro'yxatga olinmagan. \"Ariza berish\" tugmasi orqali yangi ilmiy ish uchun ariza bering."
                : 'У вас пока нет научных работ. Подайте заявку через кнопку «Подать заявку».'
            }
          />
        </Card>
        {applyModal}
      </PageContainer>
    );
  }

  return (
    <PageContainer title={t('scienceCouncil.nav.myWork')}>
      <FilterBar>
        <FilterLabel>
          <CalendarOutlined />
          {t('scienceCouncil.work.year')}:
        </FilterLabel>
        <Select
          value={selectedYear}
          onChange={(v) => { setSelectedYear(v); setPage(1); }}
          allowClear
          placeholder={lang === 'uz' ? 'Barcha yillar' : 'Все годы'}
          style={{ width: 180 }}
          options={yearOptions}
        />
        <span style={{ marginLeft: 'auto' }}>{headerActions}</span>
      </FilterBar>


      <Card>
        <>
          <Table<ScientificWork>
            dataSource={pageRows}
            columns={columns}
            rowKey="id"
            loading={isLoading}
            size="small"
            pagination={false}
            onRow={(record) => ({
              onClick: () => navigate(`/science-council/works/${record.id}?from=my-works`),
              style: { cursor: 'pointer' },
            })}
            locale={{ emptyText: t('scienceCouncil.noData') }}
          />
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={filtered.length}
          onChange={(p, ps) => { setPage(p); setPageSize(ps); }}
          onPageSizeChange={(ps) => { setPageSize(ps); setPage(1); }}
        />
        </>
      </Card>
      {applyModal}
    </PageContainer>
  );
}
