import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, DatePicker, Modal, Radio, Table, Tooltip, message } from 'antd';
import { DownloadOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { Filters, PageContainer } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import {
  useSeminarWorks,
  useUpdateSeminarResult,
  useUpdateSeminarDate,
  useSpecialties,
  useCouncilNumbers,
  workDetailQuery,
} from '../api/science-council-api';
import { apiMessage } from '../lib/api-error';
import { ExportButton } from '../components/export-button';
import { downloadExcel, datedFileName, type ExcelRow } from '../lib/excel';
import {
  buildFinalConclusion,
  buildHeading,
  buildIntro,
  buildItems,
  collectVars,
  isRecommended,
} from '../lib/dalolatnoma-template';
import {
  buildDalolatnomaHtml,
  printDalolatnomaPdf,
  safeFileName,
} from '../lib/dalolatnoma-doc';
import { SeminarResultTag } from '../components/seminar-result-tag';
import { STATUS_ORDER } from '../model/status';
import type { ScientificWork, SeminarResult } from '../model/types';
import * as S from '../components/works-table-styles';
import { TablePagination } from '../components/table-pagination';

const YEARS = [
  { value: '2024-2025', label: '2024-2025' },
  { value: '2025-2026', label: '2025-2026' },
  { value: '2026-2027', label: '2026-2027' },
];

export default function SeminarsPage() {
  const { t, lang } = useTranslation();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [yearFilter, setYearFilter] = useState<string>();
  const [councilFilter, setCouncilFilter] = useState<string>();
  const [specialtyFilter, setSpecialtyFilter] = useState<string>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [editing, setEditing] = useState<ScientificWork | null>(null);
  const [draftResult, setDraftResult] = useState<SeminarResult | 'none'>('none');

  const { data: works = [], isLoading } = useSeminarWorks(
    statusFilter,
    yearFilter,
    specialtyFilter,
    councilFilter,
  );
  const { data: specialties = [] } = useSpecialties();
  const { data: councilNumbers = [] } = useCouncilNumbers();
  const updateResultMut = useUpdateSeminarResult();
  const updateDateMut = useUpdateSeminarDate();
  const [savingDateId, setSavingDateId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const qc = useQueryClient();

  const isDatePassed = (d?: string | null) =>
    !!d && dayjs(d).startOf('day').valueOf() <= dayjs().startOf('day').valueOf();

  const resultGate = (r: ScientificWork): { allowed: boolean; reason?: string } => {
    if (!r.seminarDate) return { allowed: false, reason: t('scienceCouncil.seminar.needDate') };
    if (!isDatePassed(r.seminarDate)) {
      return { allowed: false, reason: t('scienceCouncil.seminar.notYetHeld') };
    }
    return { allowed: true };
  };

  const downloadAct = async (record: ScientificWork) => {
    setDownloadingId(record.id);
    try {
      const full = await qc.fetchQuery(workDetailQuery(record.id));
      const vars = collectVars(full);
      const html = buildDalolatnomaHtml({
        heading: buildHeading(vars),
        intro: full.protocol?.intro || buildIntro(vars),
        items: buildItems(full, lang),
        finalConclusion:
          full.protocol?.finalConclusion
          || buildFinalConclusion(vars, isRecommended(full.reviews ?? [])),
      });
      printDalolatnomaPdf(html, safeFileName(full.title));
    } catch (err) {
      message.error(apiMessage(err, t('scienceCouncil.protocol.downloadFailed')));
    } finally {
      setDownloadingId(null);
    }
  };

  const exportRows = () => {
    const rows: ExcelRow[] = filtered.map((r, i) => ({
      '#': i + 1,
      [t('scienceCouncil.work.title')]: r.title,
      [t('scienceCouncil.work.author')]: authorNameOf(r) || '—',
      [t('scienceCouncil.work.authorType')]:
        r.authorType === 'internal' ? t('scienceCouncil.work.internal') : t('scienceCouncil.work.external'),
      [t('scienceCouncil.work.year')]: r.year ?? '—',
      [t('scienceCouncil.form.specialtyCode')]: r.specialty?.code ?? '—',
      [t('scienceCouncil.seminar.date')]: r.seminarDate?.slice(0, 10) ?? '—',
      [t('scienceCouncil.seminar.result')]: r.seminarResult
        ? t(`scienceCouncil.seminar.${r.seminarResult === 'defended' ? 'defended' : 'notDefended'}`)
        : t('scienceCouncil.seminar.notSet'),
      [t('scienceCouncil.work.status')]: t(`scienceCouncil.status.${r.status}`),
    }));
    downloadExcel(rows, datedFileName('Seminarlar'), t('scienceCouncil.nav.seminars'),
      [5, 55, 28, 14, 13, 14, 15, 20, 18]);
  };

  const saveDate = (record: ScientificWork, value: string | null) => {
    setSavingDateId(record.id);
    updateDateMut.mutate(
      { id: record.id, seminarDate: value },
      {
        onSuccess: () => message.success(t('scienceCouncil.seminar.dateSaved')),
        onError: (err) => message.error(apiMessage(err, t('scienceCouncil.seminar.dateFailed'))),
        onSettled: () => setSavingDateId(null),
      },
    );
  };

  const authorNameOf = (r: ScientificWork) =>
    r.researcher?.name ?? r.externalAuthor?.name ?? '';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return works;
    return works.filter(
      (r) =>
        r.title.toLowerCase().includes(q) || authorNameOf(r).toLowerCase().includes(q),
    );
  }, [works, search]);

  const openEditor = (record: ScientificWork) => {
    setEditing(record);
    setDraftResult(record.seminarResult ?? 'none');
  };

  const saveResult = () => {
    if (!editing) return;
    updateResultMut.mutate(
      {
        id: editing.id,
        seminarResult: draftResult === 'none' ? null : draftResult,
      },
      {
        onSuccess: () => {
          message.success(t('scienceCouncil.seminar.resultSaved'));
          setEditing(null);
        },
        onError: (err) => message.error(apiMessage(err, t('scienceCouncil.seminar.resultFailed'))),
      },
    );
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
      render: (_v, _r, i) => <S.IndexCell>{(page - 1) * pageSize + i + 1}</S.IndexCell>,
    },
    {
      title: t('scienceCouncil.work.title'),
      key: 'title',
      minWidth: 260,
      render: (_v, r) => (
        <S.TitleCell>
          <div
            className="title-link"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/science-council/works/${r.id}?from=seminars`);
            }}
          >
            {r.title}
          </div>
        </S.TitleCell>
      ),
    },
    {
      title: t('scienceCouncil.work.author'),
      key: 'author',
      width: 190,
      render: (_v, r) => <S.MutedCell>{authorNameOf(r) || '—'}</S.MutedCell>,
    },
    {
      title: t('scienceCouncil.work.authorType'),
      dataIndex: 'authorType',
      key: 'authorType',
      width: 120,
      render: (val) => (
        <S.MutedCell>
          {val === 'internal'
            ? t('scienceCouncil.work.internal')
            : t('scienceCouncil.work.external')}
        </S.MutedCell>
      ),
    },
    {
      title: t('scienceCouncil.work.year'),
      dataIndex: 'year',
      key: 'year',
      width: 110,
      render: (y) => <S.SmallCell>{y || '—'}</S.SmallCell>,
    },
    {
      title: t('scienceCouncil.protocol.short'),
      key: 'protocol',
      width: 120,
      align: 'center',
      render: (_v, r) => {
        const ready = !!r.protocol?.generatedAt;
        return (
          <span onClick={(e) => e.stopPropagation()}>
            <Tooltip
              title={
                ready
                  ? t('scienceCouncil.protocol.download')
                  : t('scienceCouncil.protocol.downloadDraft')
              }
            >
              <S.ActionBtn
                $variant={ready ? 'edit' : 'view'}
                style={ready ? undefined : { opacity: 0.6 }}
                disabled={downloadingId === r.id}
                onClick={() => downloadAct(r)}
              >
                <DownloadOutlined />
              </S.ActionBtn>
            </Tooltip>
          </span>
        );
      },
    },
    {
      title: t('scienceCouncil.seminar.date'),
      dataIndex: 'seminarDate',
      key: 'seminarDate',
      width: 170,
      render: (d: string | undefined, r) => {
        const locked = !!r.seminarResult;
        return (
          <span onClick={(e) => e.stopPropagation()}>
            <Tooltip title={locked ? t('scienceCouncil.seminar.dateLocked') : undefined}>
              <DatePicker
                size="small"
                style={{ width: '100%' }}
                format="YYYY-MM-DD"
                placeholder={t('scienceCouncil.seminar.setDate')}
                value={d ? dayjs(d) : null}
                disabled={locked || savingDateId === r.id}
                onChange={(_date, dateString) =>
                  saveDate(r, typeof dateString === 'string' && dateString ? dateString : null)
                }
                allowClear
              />
            </Tooltip>
          </span>
        );
      },
    },
    {
      title: t('scienceCouncil.seminar.result'),
      key: 'seminarResult',
      width: 210,
      render: (_v, r) => {
        const gate = resultGate(r);
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <SeminarResultTag result={r.seminarResult} />
            <Tooltip title={gate.reason ?? t('scienceCouncil.seminar.editResult')}>
              <span>
                <S.ActionBtn
                  $variant="edit"
                  disabled={!gate.allowed}
                  style={gate.allowed ? undefined : { opacity: 0.45, cursor: 'not-allowed' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!gate.allowed) return;
                    openEditor(r);
                  }}
                >
                  <EditOutlined />
                </S.ActionBtn>
              </span>
            </Tooltip>
          </span>
        );
      },
    },
  ];

  return (
    <PageContainer title={t('scienceCouncil.seminar.title')}>
      <S.FiltersWrap>
        <Filters
          searchPlaceholder="scienceCouncil.seminar.searchPlaceholder"
          onSearch={(v) => { setSearch(v); setPage(1); }}
          selects={[
            {
              key: 'status',
              placeholder: 'scienceCouncil.work.status',
              value: statusFilter,
              options: STATUS_ORDER.map((s) => ({
                value: s,
                label: t(`scienceCouncil.status.${s}`),
              })),
              onChange: (v) => { setStatusFilter(v); setPage(1); },
            },
            {
              key: 'year',
              placeholder: 'scienceCouncil.work.year',
              value: yearFilter,
              options: YEARS,
              onChange: (v) => { setYearFilter(v); setPage(1); },
            },
            {
              key: 'councilNumber',
              placeholder: 'scienceCouncil.settings.councilNumber',
              value: councilFilter,
              options: councilNumbers.map((c) => ({ value: c.id, label: c.number })),
              onChange: (v) => { setCouncilFilter(v); setPage(1); },
            },
            {
              key: 'specialty',
              placeholder: 'scienceCouncil.form.specialtyCode',
              value: specialtyFilter,
              options: specialties.map((sp) => ({
                value: sp.id,
                label: `${sp.code} — ${sp.title}`,
              })),
              onChange: (v) => { setSpecialtyFilter(v); setPage(1); },
            },
          ]}
          extra={
            <ExportButton
              onExport={exportRows}
              disabled={filtered.length === 0}
              disabledReason={t('scienceCouncil.export.empty')}
            />
          }
        />
      </S.FiltersWrap>

      <S.Card>
        <>
          <Table<ScientificWork>
            dataSource={pageRows}
            columns={columns}
            rowKey="id"
            loading={isLoading}
            size="small"
            locale={{ emptyText: t('scienceCouncil.seminar.empty') }}
            pagination={false}
            onRow={(record) => ({
              onClick: () => navigate(`/science-council/works/${record.id}?from=seminars`),
              style: { cursor: 'pointer' },
            })}
          />
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={filtered.length}
          onChange={(p, ps) => { setPage(p); setPageSize(ps); }}
          onPageSizeChange={(ps) => { setPageSize(ps); setPage(1); }}
        />
        </>
      </S.Card>

      <Modal
        title={t('scienceCouncil.seminar.editResult')}
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={saveResult}
        confirmLoading={updateResultMut.isPending}
        okText={t('scienceCouncil.save')}
        cancelText={t('scienceCouncil.cancel')}
        destroyOnHidden
      >
        <div style={{ marginBottom: 12, fontWeight: 500 }}>{editing?.title}</div>
        <Radio.Group
          value={draftResult}
          onChange={(e) => setDraftResult(e.target.value)}
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          <Radio value="defended">{t('scienceCouncil.seminar.defended')}</Radio>
          <Radio value="not_defended">{t('scienceCouncil.seminar.notDefended')}</Radio>
          <Radio value="none">{t('scienceCouncil.seminar.notSet')}</Radio>
        </Radio.Group>

        {draftResult === 'defended' && (
          <Alert
            type="info"
            showIcon
            style={{ marginTop: 14 }}
            message={t('scienceCouncil.seminar.movesToDefenses')}
          />
        )}
      </Modal>
    </PageContainer>
  );
}
