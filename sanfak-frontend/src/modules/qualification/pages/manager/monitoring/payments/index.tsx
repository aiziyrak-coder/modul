import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type { ColumnsType } from 'antd/es/table';
import { CheckOutlined, CloseOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { App, Button, ConfigProvider, DatePicker, Flex, Input, InputNumber, Modal, Select, Skeleton, Table, Tag, Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import { PageContainer, DataTable, Filters } from '@/shared/ui';
import { TableGap } from '../../../../components/table-gap';
import { ScrollBox } from '../../../../components/scroll-box';
import { getApiErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/lib/i18n';
import {
  usePaymentsMonitoring,
  fetchPaymentsExport,
  useContractPaymentHistory,
  useUpdatePayment,
} from '../../../../api/monitoring-api';
import { useCourseOptions } from '../../../../api/course-api';
import { downloadExcel } from '../../../../lib/excel';
import type { PaymentMonitorRow, PaymentHistoryItem } from '../../../../model/monitoring.types';
import ExcelExportButton from '../../../../components/excel-export-button';

const { Text } = Typography;
const LIMIT = 12;
const fmtSum = (n: number) => `${(n || 0).toLocaleString('ru-RU')} so'm`;

const STATUS_TAG: Record<string, { color: string; key: string }> = {
  paid: { color: 'green', key: 'qualification.monitoring.statusPaid' },
  partial: { color: 'gold', key: 'qualification.monitoring.statusPartial' },
  unpaid: { color: 'red', key: 'qualification.monitoring.statusUnpaid' },
  pending: { color: 'blue', key: 'qualification.monitoring.statusPending' },
};

const METHOD_KEY: Record<number, string> = {
  1: 'qualification.monitoring.methodClick',
  2: 'qualification.monitoring.methodPayme',
  3: 'qualification.monitoring.methodBank',
};
const PAY_ITEM_STATUS: Record<number, { bg: string; fg: string; key: string }> = {
  1: { bg: 'color-mix(in srgb, var(--brand-warning) 16%, #fff)', fg: '#a16207', key: 'qualification.monitoring.payPending' },
  2: { bg: 'var(--brand-primary-soft)', fg: 'var(--brand-primary)', key: 'qualification.monitoring.payConfirmed' },
  3: { bg: 'color-mix(in srgb, var(--brand-error) 12%, #fff)', fg: 'var(--brand-error)', key: 'qualification.monitoring.payRejected' },
};

const fmtDate = (d: string | null) => (d ? dayjs(d).format('DD.MM.YYYY HH:mm') : '—');

function SumCard({ label, value, tone }: { label: string; value: string; tone: 'neutral' | 'green' | 'red' }) {
  const cfg = {
    neutral: { bg: 'var(--color-fill-tertiary, #f1f5f9)', color: 'var(--color-text)' },
    green: { bg: 'color-mix(in srgb, var(--brand-primary) 10%, transparent)', color: 'var(--brand-primary)' },
    red: { bg: 'color-mix(in srgb, var(--brand-error) 10%, transparent)', color: 'var(--brand-error)' },
  }[tone];
  return (
    <div style={{ flex: 1, minWidth: 170, background: cfg.bg, borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontSize: 12, color: 'var(--color-text-soft, #64748b)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: cfg.color }}>{value}</div>
    </div>
  );
}

export default function PaymentMonitoringPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [search, setSearch] = useState('');
  const [course, setCourse] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);

  const [exporting, setExporting] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);

  const { data: courseOptions = [] } = useCourseOptions();
  const { data, isFetching } = usePaymentsMonitoring({ page, limit: pageSize, search, course, status });
  const history = useContractPaymentHistory(historyId ?? undefined);
  const updatePayment = useUpdatePayment();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editAmount, setEditAmount] = useState<number | null>(null);
  const [editTxid, setEditTxid] = useState('');
  const [editStatus, setEditStatus] = useState<number>(2);

  const openEdit = (item: PaymentHistoryItem) => {
    setEditingId(item.id);
    setEditDate(item.date ? item.date.slice(0, 10) : '');
    setEditAmount(item.amount);
    setEditTxid(item.transactionId ?? '');
    setEditStatus(item.status);
  };
  const cancelEdit = () => setEditingId(null);
  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await updatePayment.mutateAsync({
        id: editingId,
        date: editDate || undefined,
        amount: editAmount ?? undefined,
        transactionId: editTxid,
        status: editStatus,
      });
      message.success(t('qualification.monitoring.saved'));
      setEditingId(null);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const onExport = async () => {
    setExporting(true);
    try {
      const rows = await fetchPaymentsExport({ search, course, status });
      const excel = rows.map((r) => ({
        [t('qualification.monitoring.colFio')]: r.studentName,
        [t('qualification.monitoring.colCourse')]: r.courseName,
        [t('qualification.monitoring.colMode')]:
          r.form === 1
            ? t('qualification.monitoring.online')
            : r.form === 2
              ? t('qualification.monitoring.offline')
              : '—',
        [t('qualification.monitoring.colTotal')]: fmtSum(r.totalAmount),
        [t('qualification.monitoring.colPaid')]: fmtSum(r.paidAmount),
        [t('qualification.monitoring.colRemaining')]: fmtSum(r.remainingAmount),
        [t('qualification.monitoring.colDue')]: r.paymentDueAt
          ? dayjs(r.paymentDueAt).format('DD.MM.YYYY')
          : '',
        [t('qualification.monitoring.locked')]: r.paymentLocked
          ? t('qualification.monitoring.locked')
          : '',
        [t('qualification.monitoring.colStatus')]: t(
          (STATUS_TAG[r.status] ?? { key: 'qualification.monitoring.statusUnpaid' }).key,
        ),
      }));
      downloadExcel(excel, 'tolovlar-monitoring', 'Tolovlar', [24, 24, 12, 16, 16, 16, 14, 10, 14]);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const columns: ColumnDef<PaymentMonitorRow, unknown>[] = [
    { id: 'idx', header: '#', cell: ({ row }) => (page - 1) * pageSize + row.index + 1 },
    { accessorKey: 'studentName', header: t('qualification.monitoring.colFio') },
    { accessorKey: 'courseName', header: t('qualification.monitoring.colCourse') },
    {
      id: 'form',
      header: t('qualification.monitoring.colMode'),
      cell: ({ row }) =>
        row.original.form === 1 ? (
          <Tag color="blue">{t('qualification.monitoring.online')}</Tag>
        ) : row.original.form === 2 ? (
          <Tag color="gold">{t('qualification.monitoring.offline')}</Tag>
        ) : (
          '—'
        ),
    },
    { id: 'total', header: t('qualification.monitoring.colTotal'), cell: ({ row }) => fmtSum(row.original.totalAmount) },
    {
      id: 'paid',
      header: t('qualification.monitoring.colPaid'),
      cell: ({ row }) => <span style={{ color: 'var(--brand-primary)', fontWeight: 500 }}>{fmtSum(row.original.paidAmount)}</span>,
    },
    {
      id: 'due',
      header: t('qualification.monitoring.colDue'),
      size: 150,
      cell: ({ row }) => {
        const { paymentDueAt, paymentLocked } = row.original;
        if (!paymentDueAt) return <span style={{ color: 'var(--color-text-mute)' }}>—</span>;
        return (
          <Flex vertical gap={2}>
            <span style={{ color: paymentLocked ? 'var(--brand-error)' : undefined }}>
              {dayjs(paymentDueAt).format('DD.MM.YYYY')}
            </span>
            {paymentLocked ? (
              <Tag color="red" style={{ margin: 0, width: 'fit-content' }}>
                {t('qualification.monitoring.locked')}
              </Tag>
            ) : null}
          </Flex>
        );
      },
    },
    {
      id: 'remaining',
      header: t('qualification.monitoring.colRemaining'),
      cell: ({ row }) => (
        <span style={{ color: row.original.remainingAmount === 0 ? 'var(--brand-primary)' : 'var(--brand-error)', fontWeight: 500 }}>
          {fmtSum(row.original.remainingAmount)}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('qualification.monitoring.colStatus'),
      cell: ({ row }) => {
        const s = STATUS_TAG[row.original.status] ?? { color: 'default', key: 'qualification.monitoring.statusUnpaid' };
        return <Tag color={s.color}>{t(s.key)}</Tag>;
      },
    },
    {
      id: 'detail',
      header: t('qualification.monitoring.colDetail'),
      cell: ({ row }) => (
        <Tooltip title={t('qualification.monitoring.colDetail')}>
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setHistoryId(row.original.contractId)}
          />
        </Tooltip>
      ),
    },
  ];

  const historyCols: ColumnsType<PaymentHistoryItem> = [
    { key: 'idx', title: '#', width: 48, render: (_v, _r, i) => i + 1 },
    {
      key: 'date',
      title: t('qualification.monitoring.colDate'),
      render: (_v, r) =>
        r.id === editingId ? (
          <DatePicker
            size="small"
            style={{ width: 150 }}
            format="YYYY-MM-DD"
            allowClear={false}
            value={editDate ? dayjs(editDate) : null}
            onChange={(d) => setEditDate(d ? d.format('YYYY-MM-DD') : '')}
          />
        ) : (
          fmtDate(r.createdAt)
        ),
    },
    {
      key: 'amount',
      title: t('qualification.monitoring.colAmount'),
      render: (_v, r) =>
        r.id === editingId ? (
          <InputNumber<number>
            size="small"
            style={{ width: 130 }}
            value={editAmount ?? undefined}
            min={0}
            onChange={(v) => setEditAmount(v ?? null)}
            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
            parser={(v) => Number((v ?? '').replace(/\s/g, ''))}
          />
        ) : (
          <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>{fmtSum(r.amount)}</span>
        ),
    },
    { key: 'method', title: t('qualification.monitoring.colMethod'), render: (_v, r) => t(METHOD_KEY[r.method] ?? 'qualification.monitoring.methodBank') },
    {
      key: 'txid',
      title: t('qualification.monitoring.colTxId'),
      render: (_v, r) =>
        r.id === editingId ? (
          <Input size="small" style={{ width: 150 }} value={editTxid} onChange={(e) => setEditTxid(e.target.value)} />
        ) : r.transactionId ? (
          <Text code>{r.transactionId}</Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      key: 'status',
      title: t('qualification.monitoring.colStatus'),
      render: (_v, r) => {
        if (r.id === editingId) {
          return (
            <Select
              size="small"
              style={{ width: 140 }}
              value={editStatus}
              onChange={setEditStatus}
              options={[
                { value: 1, label: t('qualification.monitoring.payPending') },
                { value: 2, label: t('qualification.monitoring.payConfirmed') },
                { value: 3, label: t('qualification.monitoring.payRejected') },
              ]}
            />
          );
        }
        const s =
          PAY_ITEM_STATUS[r.status] ?? {
            bg: 'var(--color-bg-elevate)',
            fg: 'var(--color-text-soft)',
            key: 'qualification.monitoring.payPending',
          };
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 10px',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              fontWeight: 500,
              background: s.bg,
              color: s.fg,
            }}
          >
            {t(s.key)}
          </span>
        );
      },
    },
    {
      key: 'actions',
      title: t('qualification.monitoring.colActions'),
      width: 110,
      align: 'center',
      render: (_v, r) =>
        r.id === editingId ? (
          <Flex gap={2} justify="center">
            <Tooltip title={t('qualification.monitoring.save')}>
              <Button
                type="text"
                size="small"
                loading={updatePayment.isPending}
                icon={<CheckOutlined style={{ color: 'var(--brand-primary)' }} />}
                onClick={saveEdit}
              />
            </Tooltip>
            <Tooltip title={t('qualification.monitoring.cancel')}>
              <Button type="text" size="small" icon={<CloseOutlined />} onClick={cancelEdit} />
            </Tooltip>
          </Flex>
        ) : (
          <Flex gap={2} justify="center">
            <Tooltip title={t('qualification.monitoring.view')}>
              <Button
                type="text"
                size="small"
                disabled={!r.file}
                icon={<EyeOutlined />}
                onClick={() => r.file && window.open(r.file, '_blank', 'noopener,noreferrer')}
              />
            </Tooltip>
            {r.method === 3 ? (
              <Tooltip title={t('qualification.monitoring.edit')}>
                <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
              </Tooltip>
            ) : null}
          </Flex>
        ),
    },
  ];

  const statusOptions = [
    { value: 'paid', label: t('qualification.monitoring.statusPaid') },
    { value: 'partial', label: t('qualification.monitoring.statusPartial') },
    { value: 'unpaid', label: t('qualification.monitoring.statusUnpaid') },
    { value: 'pending', label: t('qualification.monitoring.statusPending') },
  ];

  return (
    <PageContainer title={t('qualification.monitoring.paymentsNav')}>
      <Filters
        searchValue={search}
        searchPlaceholder="qualification.monitoring.searchPh"
        onSearch={(v) => { setSearch(v); setPage(1); }}
        selects={[
          { key: 'course', placeholder: 'qualification.monitoring.filterCourse', value: course || undefined, options: courseOptions, onChange: (v) => { setCourse(v ?? ''); setPage(1); } },
          { key: 'status', placeholder: 'qualification.monitoring.filterStatus', value: status || undefined, options: statusOptions, onChange: (v) => { setStatus(v ?? ''); setPage(1); } },
        ]}
        extra={
          <Flex align="center" gap={12}>
            <Text type="secondary">{t('qualification.monitoring.count', { count: data?.total ?? 0 })}</Text>
            <ExcelExportButton loading={exporting} onClick={onExport} />
          </Flex>
        }
      />
      <TableGap>
        <DataTable<PaymentMonitorRow>
          data={data?.items ?? []}
          columns={columns}
          loading={isFetching}
          page={page}
          pageSize={pageSize}
          total={data?.total}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      </TableGap>

      <Modal
        open={!!historyId}
        onCancel={() => {
          setHistoryId(null);
          cancelEdit();
        }}
        footer={null}
        centered
        width={1040}
        title={`${t('qualification.monitoring.historyTitle')}${history.data ? ' — ' + history.data.studentName : ''}`}
      >
        <ScrollBox $maxHeight="70vh">
        {history.isFetching ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : history.data ? (
          <>
            <Flex gap={16} align="center" wrap style={{ marginBottom: 16 }}>
              <Text strong>{history.data.courseName}</Text>
              {history.data.creditHours ? (
                <Text type="secondary">{t('qualification.monitoring.hours', { h: history.data.creditHours })}</Text>
              ) : null}
              {history.data.form ? (
                <Tag color={history.data.form === 1 ? 'blue' : 'gold'}>
                  {history.data.form === 1 ? t('qualification.monitoring.online') : t('qualification.monitoring.offline')}
                </Tag>
              ) : null}
            </Flex>
            <Flex gap={12} wrap style={{ marginBottom: 16 }}>
              <SumCard label={t('qualification.monitoring.colTotal')} value={fmtSum(history.data.totalAmount)} tone="neutral" />
              <SumCard label={t('qualification.monitoring.colPaid')} value={fmtSum(history.data.paidAmount)} tone="green" />
              <SumCard
                label={t('qualification.monitoring.colRemaining')}
                value={fmtSum(history.data.remainingAmount)}
                tone={history.data.remainingAmount > 0 ? 'red' : 'green'}
              />
            </Flex>
            <ConfigProvider theme={{ token: { borderRadiusSM: 8 } }}>
              <Table<PaymentHistoryItem>
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={history.data.items}
                columns={historyCols}
                locale={{ emptyText: t('qualification.monitoring.noPayments') }}
              />
            </ConfigProvider>
          </>
        ) : null}
        </ScrollBox>
      </Modal>
    </PageContainer>
  );
}
