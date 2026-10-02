import { useMemo, useState } from 'react';
import { DatePicker, Modal, Radio, Table, Tooltip, message } from 'antd';
import dayjs from 'dayjs';
import { EditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { Filters, PageContainer } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import {
  useDefenseWorks,
  useUpdateDefenseResult,
  useUpdateDefenseDate,
  useSpecialties,
  useCouncilNumbers,
} from '../api/science-council-api';
import { apiMessage } from '../lib/api-error';
import { ExportButton } from '../components/export-button';
import { downloadExcel, datedFileName, type ExcelRow } from '../lib/excel';
import { DefenseResultTag } from '../components/defense-result-tag';
import type { ScientificWork, SeminarResult } from '../model/types';
import * as S from '../components/works-table-styles';
import { TablePagination } from '../components/table-pagination';

const YEARS = [
  { value: '2024-2025', label: '2024-2025' },
  { value: '2025-2026', label: '2025-2026' },
  { value: '2026-2027', label: '2026-2027' },
];

export default function DefensesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [yearFilter, setYearFilter] = useState<string>();
  const [councilFilter, setCouncilFilter] = useState<string>();
  const [specialtyFilter, setSpecialtyFilter] = useState<string>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [editing, setEditing] = useState<ScientificWork | null>(null);
  const [draftResult, setDraftResult] = useState<SeminarResult | 'none'>('none');

  const { data: works = [], isLoading } = useDefenseWorks(
    statusFilter === 'none' ? undefined : statusFilter,
    yearFilter,
    specialtyFilter,
    councilFilter,
  );
  const { data: specialties = [] } = useSpecialties();
  const { data: councilNumbers = [] } = useCouncilNumbers();
  const updateResultMut = useUpdateDefenseResult();
  const updateDateMut = useUpdateDefenseDate();
  const [savingDateId, setSavingDateId] = useState<string | null>(null);

  const exportRows = () => {
    const rows: ExcelRow[] = filtered.map((r, i) => ({
      '#': i + 1,
      [t('scienceCouncil.work.title')]: r.title,
      [t('scienceCouncil.work.author')]: authorNameOf(r) || '—',
      [t('scienceCouncil.work.authorType')]:
        r.authorType === 'internal' ? t('scienceCouncil.work.internal') : t('scienceCouncil.work.external'),
      [t('scienceCouncil.work.year')]: r.year ?? '—',
      [t('scienceCouncil.form.specialtyCode')]: r.specialty?.code ?? '—',
      [t('scienceCouncil.defense.date')]: r.defenseDate?.slice(0, 10) ?? '—',
      [t('scienceCouncil.defense.result')]: r.defenseResult
        ? t(`scienceCouncil.defense.${r.defenseResult === 'defended' ? 'defended' : 'notDefended'}`)
        : t('scienceCouncil.defense.notSet'),
    }));
    downloadExcel(rows, datedFileName('Himoyalar'), t('scienceCouncil.nav.defenses'),
      [5, 55, 28, 14, 13, 14, 15, 20]);
  };

  const saveDate = (record: ScientificWork, value: string | null) => {
    setSavingDateId(record.id);
    updateDateMut.mutate(
      { id: record.id, defenseDate: value },
      {
        onSuccess: () => message.success(t('scienceCouncil.defense.dateSaved')),
        onError: (err) => message.error(apiMessage(err, t('scienceCouncil.defense.dateFailed'))),
        onSettled: () => setSavingDateId(null),
      },
    );
  };

  const authorNameOf = (r: ScientificWork) =>
    r.researcher?.name ?? r.externalAuthor?.name ?? '';

  const filtered = useMemo(() => {
    let list = works;
    if (statusFilter === 'none') list = list.filter((r) => r.defenseResult == null);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) || authorNameOf(r).toLowerCase().includes(q),
      );
    }
    return list;
  }, [works, search, statusFilter]);

  const openEditor = (record: ScientificWork) => {
    setEditing(record);
    setDraftResult(record.defenseResult ?? 'none');
  };

  const saveResult = () => {
    if (!editing) return;
    updateResultMut.mutate(
      {
        id: editing.id,
        defenseResult: draftResult === 'none' ? null : draftResult,
      },
      {
        onSuccess: () => {
          message.success(t('scienceCouncil.defense.resultSaved'));
          setEditing(null);
        },
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
              navigate(`/science-council/works/${r.id}?from=defenses`);
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
      title: t('scienceCouncil.defense.date'),
      dataIndex: 'defenseDate',
      key: 'defenseDate',
      width: 170,
      render: (d: string | undefined, r) => {
        const locked = !!r.defenseResult;
        return (
          <span onClick={(e) => e.stopPropagation()}>
            <Tooltip title={locked ? t('scienceCouncil.defense.dateLocked') : undefined}>
              <DatePicker
                size="small"
                style={{ width: '100%' }}
                format="YYYY-MM-DD"
                placeholder={t('scienceCouncil.defense.setDate')}
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
      title: t('scienceCouncil.defense.result'),
      key: 'defenseResult',
      width: 210,
      render: (_v, r) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <DefenseResultTag result={r.defenseResult} />
          <Tooltip title={t('scienceCouncil.defense.editResult')}>
            <S.ActionBtn
              $variant="edit"
              onClick={(e) => {
                e.stopPropagation();
                openEditor(r);
              }}
            >
              <EditOutlined />
            </S.ActionBtn>
          </Tooltip>
        </span>
      ),
    },
  ];

  return (
    <PageContainer title={t('scienceCouncil.defense.title')}>
      <S.FiltersWrap>
        <Filters
          searchPlaceholder="scienceCouncil.defense.searchPlaceholder"
          onSearch={(v) => { setSearch(v); setPage(1); }}
          selects={[
            {
              key: 'status',
              placeholder: 'scienceCouncil.defense.result',
              value: statusFilter,
              options: [
                { value: 'defended', label: t('scienceCouncil.defense.defended') },
                { value: 'not_defended', label: t('scienceCouncil.defense.notDefended') },
                { value: 'none', label: t('scienceCouncil.defense.notSet') },
              ],
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
            locale={{ emptyText: t('scienceCouncil.defense.empty') }}
            pagination={false}
            onRow={(record) => ({
              onClick: () => navigate(`/science-council/works/${record.id}?from=defenses`),
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
        title={t('scienceCouncil.defense.editResult')}
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
          <Radio value="defended">{t('scienceCouncil.defense.defended')}</Radio>
          <Radio value="not_defended">{t('scienceCouncil.defense.notDefended')}</Radio>
          <Radio value="none">{t('scienceCouncil.defense.notSet')}</Radio>
        </Radio.Group>
      </Modal>
    </PageContainer>
  );
}
