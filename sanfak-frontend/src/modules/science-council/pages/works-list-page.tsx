import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Table, Badge, Tag, Tooltip, Space, Modal, Form, Input, Select, message } from 'antd';
import {
  CommentOutlined,
  EyeOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { Filters, PageContainer } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import {
  useWorksPaginated,
  useSpecialties,
  useCouncilNumbers,
  useCouncilMembers,
  useAcceptApplication,
  useMakeDecision,
  allWorksQuery,
} from '../api/science-council-api';
import { ExportButton } from '../components/export-button';
import { downloadExcel, datedFileName, type ExcelRow } from '../lib/excel';
import { StatusTag } from '../components/status-tag';
import { STATUS_ORDER } from '../model/status';
import type { ScientificWork } from '../model/types';
import * as S from '../components/works-table-styles';
import { TablePagination } from '../components/table-pagination';

type QuickActionType = 'accept' | 'rejected';
interface QuickAction {
  type: QuickActionType;
  record: ScientificWork;
}

const YEARS = [
  { value: '2024-2025', label: '2024-2025' },
  { value: '2025-2026', label: '2025-2026' },
  { value: '2026-2027', label: '2026-2027' },
];

export default function WorksListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>();
  const [yearFilter, setYearFilter] = useState<string>();
  const [councilFilter, setCouncilFilter] = useState<string>();
  const [specialtyFilter, setSpecialtyFilter] = useState<string>();
  const [quickAction, setQuickAction] = useState<QuickAction | null>(null);
  const [actionForm] = Form.useForm();
  const [acceptMemberIds, setAcceptMemberIds] = useState<string[]>([]);

  const { data, isLoading } = useWorksPaginated({
    page,
    limit: pageSize,
    search: search || undefined,
    status: statusFilter,
    year: yearFilter,
    specialty: specialtyFilter,
    councilNumber: councilFilter,
    step: 'works',
  });
  const { data: specialties = [] } = useSpecialties();
  const { data: councilNumbers = [] } = useCouncilNumbers();
  const qc = useQueryClient();
  const { data: members = [] } = useCouncilMembers();
  const acceptMut = useAcceptApplication();
  const makeDecisionMut = useMakeDecision();

  const closeQuick = () => {
    setQuickAction(null);
    actionForm.resetFields();
    setAcceptMemberIds([]);
  };

  const handleQuickConfirm = async () => {
    if (!quickAction) return;
    const { type, record } = quickAction;

    if (type === 'accept') {
      if (acceptMemberIds.length === 0) {
        message.warning(t('scienceCouncil.quick.acceptMembersRequired'));
        return;
      }
      acceptMut.mutate(
        { id: record.id, memberIds: acceptMemberIds },
        { onSuccess: () => closeQuick() },
      );
      return;
    }

    const values = await actionForm.validateFields();
    makeDecisionMut.mutate(
      {
        workId: record.id,
        type,
        comment: values.reason,
        rejectionReason: values.reason,
      },
      { onSuccess: () => closeQuick() },
    );
  };

  const exportRows = async () => {
    const works = await qc.fetchQuery(
      allWorksQuery({
        search: search || undefined,
        status: statusFilter,
        year: yearFilter,
        specialty: specialtyFilter,
        councilNumber: councilFilter,
        step: 'works',
      }),
    );
    const rows: ExcelRow[] = works.map((w, i) => ({
      '#': i + 1,
      [t('scienceCouncil.work.title')]: w.title,
      [t('scienceCouncil.work.author')]: w.researcher?.name ?? w.externalAuthor?.name ?? '—',
      [t('scienceCouncil.work.authorType')]:
        w.authorType === 'internal' ? t('scienceCouncil.work.internal') : t('scienceCouncil.work.external'),
      [t('scienceCouncil.form.specialtyCode')]: w.specialty?.code ?? '—',
      [t('scienceCouncil.detail.specialty')]: w.specialty?.title ?? '—',
      [t('scienceCouncil.work.year')]: w.year ?? '—',
      [t('scienceCouncil.work.date')]: w.createdAt?.slice(0, 10) ?? '—',
      [t('scienceCouncil.work.reviews')]: w.reviewCount ?? 0,
      [t('scienceCouncil.work.status')]: t(`scienceCouncil.status.${w.status}`),
    }));
    downloadExcel(rows, datedFileName('Ilmiy_ishlar'), t('scienceCouncil.nav.works'),
      [5, 55, 28, 14, 14, 30, 13, 13, 11, 18]);
  };

  const quickModalTitle = () => {
    if (!quickAction) return '';
    const map: Record<QuickActionType, { icon: React.ReactNode; color: string; key: string }> = {
      accept: { icon: <CheckOutlined />, color: '#0891b2', key: 'scienceCouncil.quick.acceptTitle' },
      rejected: { icon: <CloseOutlined />, color: '#dc2626', key: 'scienceCouncil.quick.rejectTitle' },
    };
    const cfg = map[quickAction.type];
    return (
      <span style={{ color: cfg.color }}>
        {cfg.icon} <span style={{ marginLeft: 8 }}>{t(cfg.key)}</span>
      </span>
    );
  };

  const columns: ColumnsType<ScientificWork> = [
    {
      title: '№',
      key: 'index',
      width: 50,
      render: (_v, _r, i) => <S.IndexCell>{(page - 1) * 12 + i + 1}</S.IndexCell>,
    },
    {
      title: t('scienceCouncil.work.title'),
      key: 'title',
      minWidth: 260,
      render: (_v, r) => (
        <S.TitleCell>
          <div
            className="title-link"
            onClick={(e) => { e.stopPropagation(); navigate(`/science-council/works/${r.id}`); }}
          >
            {r.title}
          </div>
          <div className="author-sub">
            {r.researcher?.name ?? r.externalAuthor?.name ?? '—'}
          </div>
        </S.TitleCell>
      ),
    },
    {
      title: t('scienceCouncil.work.authorType'),
      dataIndex: 'authorType',
      key: 'authorType',
      width: 130,
      render: (val) => (
        <S.MutedCell>
          {val === 'internal' ? t('scienceCouncil.work.internal') : t('scienceCouncil.work.external')}
        </S.MutedCell>
      ),
    },
    {
      title: t('scienceCouncil.form.specialtyCode'),
      key: 'specialtyCode',
      width: 120,
      align: 'center',
      render: (_v, r) =>
        r.specialty ? (
          <Tooltip title={r.specialty.title}>
            <Tag color="processing" style={{ margin: 0, fontWeight: 600 }}>
              {r.specialty.code}
            </Tag>
          </Tooltip>
        ) : (
          <S.MutedCell>—</S.MutedCell>
        ),
    },
    {
      title: t('scienceCouncil.work.year'),
      dataIndex: 'year',
      key: 'year',
      width: 110,
      render: (y) => <S.SmallCell>{y}</S.SmallCell>,
    },
    {
      title: t('scienceCouncil.work.date'),
      dataIndex: 'createdAt',
      key: 'date',
      width: 110,
      render: (d) => <S.MutedCell>{d ? new Date(d).toLocaleDateString() : '—'}</S.MutedCell>,
    },
    {
      title: t('scienceCouncil.work.reviews'),
      key: 'reviews',
      width: 110,
      render: (_v, r) => {
        const count = r.reviewCount ?? 0;
        return (
          <Tooltip title={t('scienceCouncil.tab.reviews')}>
            <Button
              type="text"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/science-council/works/${r.id}`, { state: { tab: 'reviews' } });
              }}
              style={{ padding: '0 6px' }}
            >
              <Badge count={count} showZero size="small" color={count ? '#16a34a' : '#9ca3af'}>
                <CommentOutlined style={{ fontSize: 16, color: count ? '#16a34a' : '#9ca3af', paddingRight: 8 }} />
              </Badge>
            </Button>
          </Tooltip>
        );
      },
    },
    {
      title: t('scienceCouncil.work.status'),
      dataIndex: 'status',
      key: 'status',
      width: 180,
      render: (_v, r) => <StatusTag status={r.status} reason={r.rejectionReason} />,
    },
    {
      title: t('scienceCouncil.actions'),
      key: 'actions',
      width: 120,
      render: (_v, r) => {
        const stop = (e: React.MouseEvent) => e.stopPropagation();
        return (
          <Space size={4} onClick={stop}>
            <Tooltip title={t('scienceCouncil.actions.view')}>
              <S.ActionBtn $variant="view" onClick={() => navigate(`/science-council/works/${r.id}`)}>
                <EyeOutlined />
              </S.ActionBtn>
            </Tooltip>
            {r.status === 'new' && (
              <>
                <Tooltip title={t('scienceCouncil.actions.accept')}>
                  <S.ActionBtn $variant="accept" onClick={() => setQuickAction({ type: 'accept', record: r })}>
                    <CheckOutlined />
                  </S.ActionBtn>
                </Tooltip>
                <Tooltip title={t('scienceCouncil.actions.reject')}>
                  <S.ActionBtn $variant="reject" onClick={() => setQuickAction({ type: 'rejected', record: r })}>
                    <CloseOutlined />
                  </S.ActionBtn>
                </Tooltip>
              </>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <PageContainer title={t('scienceCouncil.nav.works')}>
      <S.FiltersWrap>
        <Filters
          searchPlaceholder="scienceCouncil.search"
          onSearch={(v) => { setSearch(v); setPage(1); }}
          selects={[
            {
              key: 'status',
              placeholder: 'scienceCouncil.work.status',
              value: statusFilter,
              options: STATUS_ORDER.filter((s) => s !== 'not_evaluated').map((s) => ({ value: s, label: t(`scienceCouncil.status.${s}`) })),
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
              disabled={(data?.meta.total ?? 0) === 0}
              disabledReason={t('scienceCouncil.export.empty')}
            />
          }
        />
      </S.FiltersWrap>

      <S.Card>
        <>
          <Table<ScientificWork>
            dataSource={data?.items ?? []}
            columns={columns}
            rowKey="id"
            loading={isLoading}
            size="small"
            scroll={{ x: 1180 }}
            pagination={false}
            onRow={(record) => ({
              onClick: () => navigate(`/science-council/works/${record.id}`),
              style: { cursor: 'pointer' },
            })}
          />
          <TablePagination
            page={data?.meta.page ?? 1}
            pageSize={data?.meta.limit ?? pageSize}
            total={data?.meta.total ?? 0}
            onChange={(p) => setPage(p)}
            onPageSizeChange={(ps) => { setPageSize(ps); setPage(1); }}
          />
        </>
      </S.Card>

      <Modal
        title={quickModalTitle()}
        open={!!quickAction}
        onCancel={closeQuick}
        onOk={handleQuickConfirm}
        confirmLoading={acceptMut.isPending || makeDecisionMut.isPending}
        okText={
          quickAction?.type === 'accept'
            ? t('scienceCouncil.quick.acceptOk')
            : t('scienceCouncil.quick.rejectOk')
        }
        cancelText={t('scienceCouncil.cancel')}
        okButtonProps={{
          danger: quickAction?.type === 'rejected',
          style: quickAction?.type === 'accept'
            ? { background: '#0891b2', borderColor: '#0891b2' }
            : undefined,
        }}
      >
        {quickAction && (
          <div style={{ marginTop: 8 }}>
            <div
              style={{
                background: '#f9fafb',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 14,
                fontSize: 13,
                color: '#374151',
                border: '1px solid #e5e7eb',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{quickAction.record.title}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                {quickAction.record.researcher?.name ?? quickAction.record.externalAuthor?.name ?? '—'}
              </div>
            </div>

            {quickAction.type === 'accept' && (
              <>
                <div style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
                  {t('scienceCouncil.quick.acceptConfirm')}
                </div>
                <div style={{ marginBottom: 6, fontWeight: 500 }}>
                  {t('scienceCouncil.form.selectMembers')}
                </div>
                <Select
                  mode="multiple"
                  allowClear
                  style={{ width: '100%' }}
                  placeholder={t('scienceCouncil.form.selectMembers')}
                  value={acceptMemberIds}
                  onChange={(val: string[]) => setAcceptMemberIds(val)}
                  optionFilterProp="label"
                  options={members.filter((m) => m.active).map((m) => ({
                    value: m.userId,
                    label: `${m.name} (${m.degree})`,
                  }))}
                />
              </>
            )}

            {quickAction.type === 'rejected' && (
              <Form form={actionForm} layout="vertical">
                <Form.Item
                  label={t('scienceCouncil.quick.reasonLabel')}
                  name="reason"
                  rules={[{ required: true, message: t('scienceCouncil.form.required') }]}
                >
                  <Input.TextArea
                    rows={4}
                    placeholder={t('scienceCouncil.quick.rejectPlaceholder')}
                  />
                </Form.Item>
              </Form>
            )}
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
