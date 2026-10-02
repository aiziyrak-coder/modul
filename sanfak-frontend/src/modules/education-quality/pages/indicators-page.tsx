import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Input, Select, Switch, Tooltip, Modal, App as AntApp } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  SearchOutlined, ExclamationCircleFilled, CloseCircleFilled,
} from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';
import type { Indicator, IndicatorInput } from '../model/types';
import {
  useIndicatorList,
  useCreateIndicator,
  useUpdateIndicator,
  useToggleIndicatorStatus,
  useDeleteIndicator,
} from '../api/education-quality-api';
import IndicatorDrawer from '../components/indicator-drawer';
import { useDebouncedSearch } from '../lib/use-debounced';
import { apiErrorBody } from '../lib/api-error';
import { TablePagination } from '../components/table-pagination';
import { Page, TableCard } from '../components/table-pagination/style';
import { ExportButton } from '../components/export-button';
import { downloadExcel, datedFileName, type ExcelRow } from '../lib/excel';

export default function IndicatorsPage() {
  const { message } = AntApp.useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Indicator | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Indicator | null>(null);

  const activeParam = useMemo(() => {
    if (statusFilter === 'active') return true;
    if (statusFilter === 'inactive') return false;
    return undefined;
  }, [statusFilter]);

  const debouncedSearch = useDebouncedSearch(search);

  const { data, isLoading } = useIndicatorList({ search: debouncedSearch, active: activeParam });
  const createMut = useCreateIndicator();
  const updateMut = useUpdateIndicator();
  const toggleMut = useToggleIndicatorStatus();
  const deleteMut = useDeleteIndicator();

  const rows = useMemo(() => data?.docs ?? [], [data]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter]);
  const pageRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize],
  );

  const exportRows = () => {
    const excelRows: ExcelRow[] = rows.map((r, i) => ({
      '#': i + 1,
      [t('educationQuality.indicators.name')]: r.title,
      [t('educationQuality.indicators.desc')]: r.desc ?? '',
      [t('educationQuality.indicators.fieldCount')]: r.dataFields.length,
      [t('educationQuality.common.score')]: r.coefficient,
      [t('educationQuality.common.status')]: r.active
        ? t('educationQuality.indicators.active')
        : t('educationQuality.indicators.inactive'),
    }));
    const sheet = t('educationQuality.indicators.title');
    downloadExcel(excelRows, datedFileName(sheet), sheet, [5, 45, 50, 15, 8, 10]);
  };

  const openTeacherReport = useCallback(
    (indicatorId: string, event: React.MouseEvent<HTMLElement>) => {
      if ((event.target as HTMLElement).closest('button, a, .ant-switch')) return;
      navigate(`/education-quality/reports/teacher?indicator=${indicatorId}`);
    },
    [navigate],
  );

  const openCreate = useCallback(() => {
    setEditing(null);
    setDrawerOpen(true);
  }, []);

  const openEdit = useCallback((record: Indicator) => {
    setEditing(record);
    setDrawerOpen(true);
  }, []);

  const handleSave = useCallback(
    (input: IndicatorInput, id?: string) => {
      if (id) {
        updateMut.mutate({ id, body: input }, {
          onSuccess: () => {
            message.success(t('educationQuality.indicators.updated'));
            setDrawerOpen(false);
          },
        });
      } else {
        createMut.mutate(input, {
          onSuccess: () => {
            message.success(t('educationQuality.indicators.created'));
            setDrawerOpen(false);
          },
        });
      }
    },
    [createMut, updateMut, message, t],
  );

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    const title = deleteTarget.title;
    deleteMut.mutate(deleteTarget._id, {
      onSuccess: () => {
        message.success(t('educationQuality.indicators.deleted'));
        setDeleteTarget(null);
      },
      onError: (err) => {
        const { reason, submissionCount } = apiErrorBody(err);
        setDeleteTarget(null);
        if (reason !== 'has_submissions') {
          message.error(t('educationQuality.indicators.deleteFailed'));
          return;
        }
        message.error({
          duration: 7,
          icon: <CloseCircleFilled style={{ alignSelf: 'flex-start', marginTop: 2 }} />,
          content: (
            <span style={{ display: 'inline-block', textAlign: 'left', maxWidth: 420 }}>
              <span style={{ fontWeight: 600 }}>
                {t('educationQuality.indicators.deleteBlocked', {
                  title,
                  count: submissionCount ?? 0,
                })}
              </span>
              <span
                style={{
                  display: 'block',
                  marginTop: 4,
                  fontWeight: 400,
                  color: 'var(--color-text-tertiary, #667085)',
                }}
              >
                {t('educationQuality.indicators.deleteBlockedHint')}
              </span>
            </span>
          ),
        });
      },
    });
  }, [deleteTarget, deleteMut, message, t]);

  const columns: ColumnsType<Indicator> = [
    {
      title: '#',
      width: 56,
      align: 'center',
      render: (_v, _r, idx) => (page - 1) * pageSize + idx + 1,
    },
    {
      title: t('educationQuality.indicators.name'),
      dataIndex: 'title',
      render: (text: string, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{text}</div>
          {r.desc && (
            <div style={{ fontSize: 13, color: 'var(--color-text-tertiary, #667085)', maxWidth: 520 }}>
              {r.desc}
            </div>
          )}
        </div>
      ),
    },
    {
      title: t('educationQuality.indicators.fields'),
      width: 110,
      align: 'center',
      render: (_v, r) => (
        <span style={{
          padding: '2px 10px',
          borderRadius: 'var(--radius-md, 8px)',
          background: 'var(--color-fill-quaternary, #f0f0f0)',
          fontSize: 13,
        }}>
          {t('educationQuality.indicators.fieldsCount', { count: r.dataFields.length })}
        </span>
      ),
    },
    {
      title: t('educationQuality.common.score'),
      dataIndex: 'coefficient',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.coefficient - b.coefficient,
      render: (c: number) => <strong style={{ fontSize: 15 }}>{c}</strong>,
    },
    {
      title: t('educationQuality.common.status'),
      width: 140,
      render: (_v, r) => (
        <Switch
          checked={r.active}
          checkedChildren={t('educationQuality.indicators.active')}
          unCheckedChildren={t('educationQuality.indicators.inactive')}
          onChange={() => toggleMut.mutate({ id: r._id, active: !r.active })}
        />
      ),
    },
    {
      title: t('educationQuality.common.actions'),
      width: 110,
      align: 'right',
      render: (_v, r) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <Tooltip title={t('educationQuality.common.edit')}>
            <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Tooltip title={t('educationQuality.common.delete')}>
            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => setDeleteTarget(r)} />
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <Page>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>{t('educationQuality.indicators.title')}</h2>
        <div style={{ color: 'var(--color-text-tertiary, #667085)', marginTop: 4 }}>
          {t('educationQuality.indicators.subtitle')}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <Input
          placeholder={t('educationQuality.indicators.searchPlaceholder')}
          prefix={<SearchOutlined />}
          style={{ width: 320 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ width: 200 }}
          allowClear
          placeholder={t('educationQuality.common.allStatuses')}
          options={[
            { label: t('educationQuality.indicators.active'), value: 'active' },
            { label: t('educationQuality.indicators.inactive'), value: 'inactive' },
          ]}
        />
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 12 }}>
          <ExportButton
            onExport={exportRows}
            disabled={rows.length === 0}
            disabledReason={t('educationQuality.indicators.exportEmpty')}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            {t('educationQuality.indicators.newButton')}
          </Button>
        </span>
      </div>

      <TableCard>
        <Table
          rowKey="_id"
          columns={columns}
          dataSource={pageRows}
          loading={isLoading}
          pagination={false}
          onRow={(r) => ({
            onClick: (event) => openTeacherReport(r._id, event),
            style: { cursor: 'pointer' },
          })}
        />
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={rows.length}
          totalText={t('educationQuality.indicators.totalLabel')}
          onChange={(p, ps) => { setPage(p); setPageSize(ps); }}
          onPageSizeChange={(ps) => { setPageSize(ps); setPage(1); }}
        />
      </TableCard>

      <IndicatorDrawer
        open={drawerOpen}
        indicator={editing}
        onClose={() => setDrawerOpen(false)}
        onSave={handleSave}
      />

      <Modal
        open={!!deleteTarget}
        title={
          <span>
            <ExclamationCircleFilled style={{ color: 'var(--brand-error, #F04438)', marginRight: 8 }} />
            {t('educationQuality.indicators.deleteTitle')}
          </span>
        }
        onCancel={() => setDeleteTarget(null)}
        onOk={handleDelete}
        okText={t('educationQuality.common.delete')}
        cancelText={t('educationQuality.common.cancel')}
        okButtonProps={{ danger: true }}
        confirmLoading={deleteMut.isPending}
        centered
      >
        {deleteTarget && (
          <div style={{ fontSize: 14, lineHeight: 1.7 }}>
            <div>{t('educationQuality.indicators.deleteBody', { title: deleteTarget.title })}</div>
            <div style={{ color: 'var(--color-text-tertiary, #667085)', marginTop: 4 }}>
              {t('educationQuality.common.irreversible')}
            </div>
          </div>
        )}
      </Modal>
    </Page>
  );
}
