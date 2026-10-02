import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import dayjs from 'dayjs';
import {
  CheckOutlined,
  CloseOutlined,
  FilePdfOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { App, Button, Checkbox, Flex, Input, Modal, Tag, Tooltip, Typography } from 'antd';
import { PageContainer, DataTable, Filters } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { Can } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import { TableGap } from '../../../components/table-gap';
import { useConfirm } from '../../../lib/use-confirm';
import {
  useCertificateApproval,
  useCertificatesForApproval,
} from '../../../api/certificate-approval-api';
import {
  CERT_KIND,
  CERT_STATUS,
  type CertStatus,
  type CertificateRow,
} from '../../../model/certificate-approval.types';

const { Text } = Typography;
const LIMIT = 12;

const fmt = (s?: string | null) => (s ? dayjs(s).format('DD.MM.YYYY') : '—');

export default function RectorCertificatesPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { confirm } = useConfirm();

  const [status, setStatus] = useState<CertStatus | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);
  const [selected, setSelected] = useState<string[]>([]);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectIds, setRejectIds] = useState<string[]>([]);
  const [reason, setReason] = useState('');

  const { data, isFetching } = useCertificatesForApproval(status, page, pageSize);
  const { approve, reject } = useCertificateApproval();

  const rows = useMemo(() => data?.items ?? [], [data]);
  const total = data?.meta.total ?? 0;
  const busy = approve.isPending || reject.isPending;

  const goPage = (p: number) => {
    setSelected([]);
    setPage(p);
  };

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const pendingRows = rows.filter((r) => r.status === CERT_STATUS.PENDING);
  const allOnPage =
    pendingRows.length > 0 && pendingRows.every((r) => selected.includes(r.id));

  const toggleAll = () => setSelected(allOnPage ? [] : pendingRows.map((r) => r.id));

  const doApprove = (ids: string[]) =>
    confirm(
      async () => {
        try {
          const res = await approve.mutateAsync(ids);
          setSelected([]);
          if (res.failed.length) {
            message.warning(
              t('qualification.certApproval.partial', {
                ok: res.approved,
                bad: res.failed.length,
              }),
            );
          } else {
            message.success(t('qualification.certApproval.approved', { count: res.approved }));
          }
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
      {
        title: 'qualification.certApproval.approveTitle',
        content: 'qualification.certApproval.approveConfirm',
        okText: 'qualification.certApproval.approve',
      },
    );

  const openReject = (ids: string[]) => {
    setRejectIds(ids);
    setReason('');
    setRejectOpen(true);
  };

  const doReject = async () => {
    try {
      await reject.mutateAsync({ ids: rejectIds, reason: reason.trim() });
      setRejectOpen(false);
      setSelected([]);
      message.success(t('qualification.certApproval.rejected'));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const statusTag = (s: CertStatus) => {
    if (s === CERT_STATUS.APPROVED)
      return <Tag color="success">{t('qualification.certApproval.status.approved')}</Tag>;
    if (s === CERT_STATUS.REJECTED)
      return <Tag color="error">{t('qualification.certApproval.status.rejected')}</Tag>;
    return <Tag color="warning">{t('qualification.certApproval.status.pending')}</Tag>;
  };

  const columns: ColumnDef<CertificateRow, unknown>[] = [
    ...(status === CERT_STATUS.APPROVED || status === CERT_STATUS.REJECTED
      ? []
      : [
          {
            id: 'select',
            size: 44,
            header: () => (
              <Checkbox
                checked={allOnPage}
                onChange={toggleAll}
                disabled={pendingRows.length === 0}
              />
            ),
            cell: ({ row }) =>
              row.original.status === CERT_STATUS.PENDING ? (
                <Checkbox
                  checked={selected.includes(row.original.id)}
                  onChange={() => toggle(row.original.id)}
                />
              ) : null,
          } as ColumnDef<CertificateRow, unknown>,
        ]),
    {
      header: t('qualification.certApproval.col.listener'),
      accessorKey: 'listenerName',
      cell: ({ row }) => <Text strong>{row.original.listenerName || '—'}</Text>,
    },
    {
      header: t('qualification.certApproval.col.course'),
      accessorKey: 'courseName',
      cell: ({ row }) => (
        <Flex vertical gap={2}>
          <Text>{row.original.courseName || '—'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {fmt(row.original.startDate)} — {fmt(row.original.endDate)}
            {row.original.creditHours ? ` · ${row.original.creditHours}` : ''}
          </Text>
        </Flex>
      ),
    },
    {
      header: t('qualification.certApproval.col.kind'),
      size: 130,
      cell: ({ row }) =>
        row.original.kind === CERT_KIND.CERTIFICATE ? (
          <Tag color="blue">{t('qualification.certApproval.kind.certificate')}</Tag>
        ) : (
          <Tag>{t('qualification.certApproval.kind.reference')}</Tag>
        ),
    },
    {
      header: t('qualification.certApproval.col.number'),
      size: 130,
      cell: ({ row }) => (
        <Text style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace' }}>
          {row.original.code || '—'}
        </Text>
      ),
    },
    {
      header: t('qualification.certApproval.col.regNumber'),
      size: 130,
      cell: ({ row }) => <Text>{row.original.regNumber || '—'}</Text>,
    },
    {
      header: t('qualification.certApproval.col.createdAt'),
      size: 120,
      cell: ({ row }) => <Text>{fmt(row.original.createdAt)}</Text>,
    },
    {
      header: t('qualification.certApproval.col.status'),
      size: 150,
      cell: ({ row }) => (
        <Flex vertical gap={2} align="flex-start">
          {row.original.status === CERT_STATUS.REJECTED ? (
            <Flex align="center" gap={6}>
              <Tooltip
                color="var(--brand-error)"
                title={
                  row.original.rejectReason || t('qualification.certApproval.noReason')
                }
              >
                <InfoCircleOutlined style={{ color: 'var(--brand-error)', cursor: 'help' }} />
              </Tooltip>
              {statusTag(row.original.status)}
            </Flex>
          ) : (
            statusTag(row.original.status)
          )}
          {row.original.approvedBy ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.original.approvedBy} · {fmt(row.original.approvedAt)}
            </Text>
          ) : null}
        </Flex>
      ),
    },
    {
      header: t('actions'),
      id: 'actions',
      size: 130,
      meta: { align: 'center' as const },
      cell: ({ row }) => (
        <Flex gap={2} justify="center">
          {row.original.status === CERT_STATUS.APPROVED && row.original.file ? (
            <Tooltip title={t('qualification.certApproval.openFile')}>
              <Button
                type="text"
                size="small"
                icon={<FilePdfOutlined />}
                aria-label={t('qualification.certApproval.openFile')}
                href={row.original.file}
                target="_blank"
              />
            </Tooltip>
          ) : null}
          <Can perform="qualCertificate:update">
            {row.original.status !== CERT_STATUS.APPROVED && (
              <Tooltip title={t('qualification.certApproval.approve')}>
                <Button
                  type="text"
                  size="small"
                  icon={<CheckOutlined />}
                  aria-label={t('qualification.certApproval.approve')}
                  disabled={busy}
                  style={{ color: 'var(--brand-primary)' }}
                  onClick={() => doApprove([row.original.id])}
                />
              </Tooltip>
            )}
          </Can>
          <Can perform="qualCertificate:update">
            {row.original.status !== CERT_STATUS.REJECTED && (
              <Tooltip title={t('qualification.certApproval.reject')}>
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  aria-label={t('qualification.certApproval.reject')}
                  disabled={busy}
                  style={{ color: 'var(--brand-error)' }}
                  onClick={() => openReject([row.original.id])}
                />
              </Tooltip>
            )}
          </Can>
        </Flex>
      ),
    },
  ];

  const statusOptions = [
    { value: String(CERT_STATUS.PENDING), label: t('qualification.certApproval.status.pending') },
    { value: String(CERT_STATUS.APPROVED), label: t('qualification.certApproval.status.approved') },
    { value: String(CERT_STATUS.REJECTED), label: t('qualification.certApproval.status.rejected') },
  ];

  return (
    <PageContainer title={t('qualification.certApproval.nav')}>
      <Filters
        hideSearch
        onSearch={() => {}}
        selects={[
          {
            key: 'status',
            placeholder: 'qualification.certApproval.filterStatus',
            value: status ? String(status) : undefined,
            options: statusOptions,
            onChange: (v) => {
              setSelected([]);
              setStatus(v ? ((Number(v) || undefined) as CertStatus | undefined) : undefined);
              setPage(1);
            },
          },
        ]}
        extra={
          <Flex align="center" gap={12}>
            <Text type="secondary">
              {t('qualification.certApproval.count', { count: total })}
            </Text>
            {selected.length > 0 && (
              <Can perform="qualCertificate:update">
                <Flex align="center" gap={8}>
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    loading={approve.isPending}
                    onClick={() => doApprove(selected)}
                  >
                    {t('qualification.certApproval.approveMany', { count: selected.length })}
                  </Button>
                  <Button danger icon={<CloseOutlined />} onClick={() => openReject(selected)}>
                    {t('qualification.certApproval.reject')}
                  </Button>
                </Flex>
              </Can>
            )}
          </Flex>
        }
      />

      <TableGap>
        <DataTable<CertificateRow>
          data={rows}
          columns={columns}
          loading={isFetching}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={goPage}
          onPageSizeChange={(size) => {
            setSelected([]);
            setPageSize(size);
            setPage(1);
          }}
        />
      </TableGap>

      <Modal
        centered
        open={rejectOpen}
        title={t('qualification.certApproval.rejectTitle')}
        okText={t('qualification.certApproval.reject')}
        cancelText={t('cancel')}
        okButtonProps={{ danger: true, disabled: !reason.trim(), loading: reject.isPending }}
        onOk={doReject}
        onCancel={() => setRejectOpen(false)}
      >
        <Text type="secondary">
          {t('qualification.certApproval.rejectHint', { count: rejectIds.length })}
        </Text>
        <Input.TextArea
          rows={3}
          maxLength={500}
          value={reason}
          style={{ marginTop: 8 }}
          placeholder={t('qualification.certApproval.reasonPlaceholder')}
          onChange={(e) => setReason(e.target.value)}
        />
      </Modal>
    </PageContainer>
  );
}
