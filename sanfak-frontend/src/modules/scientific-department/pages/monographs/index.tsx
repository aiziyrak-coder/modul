import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App, Button, Form, Input, Space, Tooltip, Upload } from 'antd';
import Modal from '../../components/scroll-modal';
import {
  BookOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloudUploadOutlined,
  EditOutlined,
  EyeOutlined,
  FileExcelOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import dayjs from 'dayjs';
import { type ColumnDef } from '@tanstack/react-table';
import { PageContainer, DataTable, Filters, Flex, RangePicker } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import { usePermission } from '@/app/session';
import {
  fetchMonographsForExport,
  useApproveMonograph,
  useCreateMonograph,
  useDataApproveMonograph,
  useDataRejectMonograph,
  useMonographsPaginate,
  useRejectMonograph,
  useSignMonograph,
  useSsvDecisionMonograph,
  useSsvSendMonograph,
  useUpdateMonograph,
} from '../../api/monograph-api';
import { departmentsOfFaculty, useDepartments, useFaculties } from '../../api/reference-api';
import { exportToExcel } from '../../lib/excel';
import StatusBadge from '../../components/status-badge';
import DecisionWarning from '../../components/decision-warning';
import FileUploadGrid from '../../components/file-upload-grid';
import TemplatesButton from '../../components/templates-button';
import TableGap from '../../components/table-gap';
import EriSignModal, { type EriSignValues } from '../../components/eri-sign-modal';
import {
  canEditMonograph,
  canReceiveSsv,
  canResubmitMonograph,
  canReviewData,
  canSendSsv,
  getMonographRoleStatus,
  monographActionStage,
  useSciRole,
} from '../../model/role-status';
import {
  MONOGRAPH_FILE_SLOTS,
  type BadgeStatus,
  type Monograph,
  type MonographSlot,
} from '../../model/types';

const STATUS_FILTER_OPTIONS: BadgeStatus[] = [
  'new',
  'pending',
  'finalReview',
  'kotibApproved',
  'prorektorApproved',
  'ssvSendPending',
  'ssvSent',
  'ssvReceived',
  'approved',
  'rejected',
];

const normFile = (e: UploadFile[] | { fileList: UploadFile[] }): UploadFile[] =>
  Array.isArray(e) ? e : e?.fileList;

export default function MonographsPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const can = usePermission();
  const role = useSciRole();
  const isReviewer = role !== 'teacher';
  const { data: departments = [] } = useDepartments();
  const { data: faculties = [] } = useFaculties();

  const canCreate = can('monograph:create');
  const canApprove = can('monograph:approve');
  const canSign = can('monograph:sign');
  const canReject = can('monograph:reject');

  const [statusFilter, setStatusFilter] = useState<BadgeStatus | undefined>();
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<string | undefined>();
  const [facultyFilter, setFacultyFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const filters = useMemo(
    () => ({
      status: statusFilter,
      search: search || undefined,
      faculty: isReviewer ? facultyFilter : undefined,
      department: isReviewer ? deptFilter : undefined,
      dateFrom: dateRange?.[0],
      dateTo: dateRange?.[1],
    }),
    [statusFilter, search, facultyFilter, deptFilter, isReviewer, dateRange],
  );

  const isRoleFilter =
    statusFilter !== undefined &&
    !['new', 'approved', 'rejected'].includes(statusFilter);
  const { data, isFetching } = useMonographsPaginate(
    isRoleFilter ? 1 : page,
    isRoleFilter ? 200 : pageSize,
    filters,
  );

  const monographs = useMemo(() => {
    const docs = data?.docs ?? [];
    if (!isRoleFilter) return docs;
    return docs.filter((mo) => getMonographRoleStatus(mo, role) === statusFilter);
  }, [data, isRoleFilter, statusFilter, role]);

  const pagedMonographs = useMemo(
    () =>
      isRoleFilter
        ? monographs.slice((page - 1) * pageSize, page * pageSize)
        : monographs,
    [isRoleFilter, monographs, page, pageSize],
  );
  const totalCount = isRoleFilter ? monographs.length : (data?.totalDocs ?? 0);

  const createMonograph = useCreateMonograph();
  const updateMonograph = useUpdateMonograph();
  const approveMonograph = useApproveMonograph();
  const signMonograph = useSignMonograph();
  const rejectMonograph = useRejectMonograph();
  const ssvSendMonograph = useSsvSendMonograph();
  const ssvDecisionMonograph = useSsvDecisionMonograph();
  const dataApproveMonograph = useDataApproveMonograph();
  const dataRejectMonograph = useDataRejectMonograph();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Monograph | null>(null);
  const [slotFiles, setSlotFiles] = useState<Partial<Record<string, File>>>({});

  const [approveTarget, setApproveTarget] = useState<Monograph | null>(null);
  const [signTarget, setSignTarget] = useState<Monograph | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Monograph | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [ssvSendTarget, setSsvSendTarget] = useState<Monograph | null>(null);
  const [ssvDecisionTarget, setSsvDecisionTarget] = useState<Monograph | null>(null);
  const [ssvRejecting, setSsvRejecting] = useState(false);
  const [ssvForm] = Form.useForm<{ responseFile?: UploadFile[]; reason?: string }>();

  const [dataApproveTarget, setDataApproveTarget] = useState<Monograph | null>(null);
  const [dataRejectTarget, setDataRejectTarget] = useState<Monograph | null>(null);
  const [dataRejectReason, setDataRejectReason] = useState('');

  const openAdd = () => {
    setEditing(null);
    setSlotFiles({});
    setFormOpen(true);
  };

  const openEdit = (mo: Monograph) => {
    setEditing(mo);
    setSlotFiles({});
    setFormOpen(true);
  };

  useEffect(() => {
    const resubmit = (location.state as { resubmit?: Monograph } | null)?.resubmit;
    if (resubmit) {
      openEdit(resubmit);
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const handleSubmit = async () => {
    const missing = MONOGRAPH_FILE_SLOTS.filter(
      (c) => !slotFiles[c.slot] && !(editing && editing.files[c.slot as MonographSlot]),
    );
    if (missing.length) {
      message.error(
        `${t('scientificDepartment.monographs.filesRequired')}: ${missing
          .map((c) => t(`scientificDepartment.${c.labelKey}`))
          .join(', ')}`,
      );
      return;
    }
    const payload = { slotFiles: slotFiles as Partial<Record<MonographSlot, File>> };
    try {
      if (editing) {
        await updateMonograph.mutateAsync({ id: editing.id, ...payload });
        message.success(
          editing.status === 'rejected'
            ? t('scientificDepartment.monographs.resubmitted')
            : t('scientificDepartment.monographs.updated'),
        );
      } else {
        await createMonograph.mutateAsync(payload);
        message.success(t('scientificDepartment.monographs.created'));
      }
      setFormOpen(false);
      setEditing(null);
      setSlotFiles({});
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    try {
      await approveMonograph.mutateAsync(approveTarget.id);
      message.success(t('scientificDepartment.monographs.ilmiyApproved'));
      setApproveTarget(null);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleSign = async (values: EriSignValues) => {
    if (!signTarget) return;
    try {
      await signMonograph.mutateAsync({ id: signTarget.id, eriKey: values.eriKey });
      message.success(t('scientificDepartment.monographs.signed'));
      setSignTarget(null);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    if (rejectReason.trim().length < 3) {
      message.error(t('scientificDepartment.articles.reasonRequired'));
      return;
    }
    try {
      await rejectMonograph.mutateAsync({
        id: rejectTarget.id,
        reason: rejectReason.trim(),
      });
      message.success(t('scientificDepartment.monographs.rejected'));
      setRejectTarget(null);
      setRejectReason('');
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleSsvSend = async () => {
    if (!ssvSendTarget) return;
    try {
      await ssvSendMonograph.mutateAsync(ssvSendTarget.id);
      message.success(t('scientificDepartment.monographs.ssvSentMsg'));
      setSsvSendTarget(null);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleSsvDecision = async (decision: 'approve' | 'reject') => {
    if (!ssvDecisionTarget) return;
    if (decision === 'reject' && !ssvRejecting) {
      setSsvRejecting(true);
      return;
    }
    const values = await ssvForm.validateFields(
      decision === 'reject' ? ['responseFile', 'reason'] : ['responseFile'],
    );
    const rawFile = values.responseFile?.[0]?.originFileObj as File | undefined;
    if (!rawFile) {
      message.error(t('scientificDepartment.monographs.ssvFileRequired'));
      return;
    }
    try {
      await ssvDecisionMonograph.mutateAsync({
        id: ssvDecisionTarget.id,
        decision,
        reason: decision === 'reject' ? values.reason?.trim() : undefined,
        file: rawFile,
      });
      message.success(
        decision === 'approve'
          ? t('scientificDepartment.monographs.ssvApproved')
          : t('scientificDepartment.monographs.ssvRejected'),
      );
      closeSsvDecision();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const closeSsvDecision = () => {
    setSsvDecisionTarget(null);
    setSsvRejecting(false);
    ssvForm.resetFields();
  };

  const handleDataApprove = async () => {
    if (!dataApproveTarget) return;
    try {
      await dataApproveMonograph.mutateAsync(dataApproveTarget.id);
      message.success(t('scientificDepartment.monographs.dataApproved'));
      setDataApproveTarget(null);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleDataReject = async () => {
    if (!dataRejectTarget) return;
    if (dataRejectReason.trim().length < 3) {
      message.error(t('scientificDepartment.articles.reasonRequired'));
      return;
    }
    try {
      await dataRejectMonograph.mutateAsync({
        id: dataRejectTarget.id,
        reason: dataRejectReason.trim(),
      });
      message.success(t('scientificDepartment.monographs.dataRejected'));
      setDataRejectTarget(null);
      setDataRejectReason('');
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const list = await fetchMonographsForExport(filters);
      const rows = isRoleFilter
        ? list.filter((mo) => getMonographRoleStatus(mo, role) === statusFilter)
        : list;
      if (!rows.length) {
        message.info(t('scientificDepartment.reports.exportEmpty'));
        return;
      }
      const data = rows.map((mo, i) => ({
        '№': i + 1,
        [t('scientificDepartment.monographs.colAuthorTitle')]: mo.authorName || '',
        [t('scientificDepartment.monographs.monographTitle')]: mo.title || '',
        ...(isReviewer
          ? {
              [t('scientificDepartment.plans.colDeptFaculty')]: [
                mo.departmentName,
                mo.facultyName,
              ]
                .filter(Boolean)
                .join(' / '),
            }
          : {}),
        ISBN: mo.isbn || '',
        [t('scientificDepartment.monographs.colPublisher')]: mo.publisher || '',
        [t('scientificDepartment.articles.colDate')]: mo.date || '',
        [t('scientificDepartment.articles.colStatus')]: t(
          `scientificDepartment.status.${getMonographRoleStatus(mo, role)}`,
        ),
      }));
      const title = t('scientificDepartment.monographs.title');
      exportToExcel(data, `${title}-${dayjs().format('YYYY-MM-DD')}`, title);
      message.success(t('scientificDepartment.reports.exportDone', { n: data.length }));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const columns: ColumnDef<Monograph, unknown>[] = [
    {
      id: 'idx',
      header: '№',
      size: 50,
      cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
    },
    {
      id: 'authorTitle',
      header: t('scientificDepartment.monographs.colAuthorTitle'),
      size: 280,
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div style={{ lineHeight: 1.4 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{r.authorName || '—'}</div>
            {r.title ? (
              <div style={{ fontSize: 12, color: 'var(--color-text-mute)', marginTop: 2 }}>
                {r.title}
              </div>
            ) : (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--color-text-mute)',
                  fontStyle: 'italic',
                  marginTop: 2,
                }}
              >
                {t(
                  r.ssvReceived
                    ? 'scientificDepartment.monographs.noTitleDataPending'
                    : 'scientificDepartment.monographs.noTitleSsvPending',
                )}
              </div>
            )}
          </div>
        );
      },
    },
    ...(role !== 'teacher'
      ? [
          {
            id: 'dept',
            header: t('scientificDepartment.plans.colDeptFaculty'),
            size: 200,
            cell: ({ row }) => {
              const r = row.original;
              return (
                <div style={{ lineHeight: 1.4 }}>
                  <div style={{ fontSize: 12.5 }}>{r.departmentName || '—'}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-mute)' }}>
                    {r.facultyName || '—'}
                  </div>
                </div>
              );
            },
          } as ColumnDef<Monograph, unknown>,
        ]
      : []),
    {
      id: 'isbn',
      header: 'ISBN',
      size: 140,
      cell: ({ row }) => row.original.isbn || '—',
    },
    {
      id: 'publisher',
      header: t('scientificDepartment.monographs.colPublisher'),
      size: 140,
      cell: ({ row }) => row.original.publisher || '—',
    },
    {
      id: 'date',
      header: t('scientificDepartment.articles.colDate'),
      size: 105,
      accessorKey: 'date',
    },
    {
      id: 'status',
      header: t('scientificDepartment.articles.colStatus'),
      size: 180,
      cell: ({ row }) => (
        <StatusBadge
          status={getMonographRoleStatus(row.original, role)}
          reason={row.original.rejectionReason}
          rejectedBy={row.original.rejectedByName}
        />
      ),
    },
    {
      id: 'actions',
      header: t('scientificDepartment.actions'),
      size: 210,
      meta: { align: 'center' as const },
      cell: ({ row }) => {
        const record = row.original;
        const stage = monographActionStage(record, role);
        const showApprove = stage === 'ilmiy' && canApprove;
        const showSign = (stage === 'kotib' || stage === 'prorektor') && canSign;
        return (
          <Space size={4} onClick={(e) => e.stopPropagation()}>
            {showApprove ? (
              <Tooltip title={t('scientificDepartment.approve')}>
                <Button
                  type="text"
                  size="small"
                  icon={
                    <CheckCircleOutlined
                      style={{ fontSize: 18, color: 'var(--brand-primary)' }}
                    />
                  }
                  onClick={() => setApproveTarget(record)}
                />
              </Tooltip>
            ) : null}
            {showSign ? (
              <Tooltip title={t('scientificDepartment.eri.signAction')}>
                <Button
                  type="text"
                  size="small"
                  icon={
                    <SafetyCertificateOutlined
                      style={{ fontSize: 18, color: 'var(--brand-primary)' }}
                    />
                  }
                  onClick={() => setSignTarget(record)}
                />
              </Tooltip>
            ) : null}
            {(showApprove || showSign) && canReject ? (
              <Tooltip title={t('scientificDepartment.reject')}>
                <Button
                  type="text"
                  size="small"
                  icon={
                    <CloseCircleOutlined style={{ fontSize: 18, color: 'var(--brand-error)' }} />
                  }
                  onClick={() => setRejectTarget(record)}
                />
              </Tooltip>
            ) : null}
            {canSendSsv(record, role) && canApprove ? (
              <Tooltip title={t('scientificDepartment.monographs.ssvSendAction')}>
                <Button
                  type="text"
                  size="small"
                  icon={<CloudUploadOutlined style={{ fontSize: 18, color: '#4f46e5' }} />}
                  onClick={() => setSsvSendTarget(record)}
                />
              </Tooltip>
            ) : null}
            {canReceiveSsv(record, role) && canApprove ? (
              <Tooltip title={t('scientificDepartment.monographs.ssvDecisionAction')}>
                <Button
                  type="text"
                  size="small"
                  icon={<BookOutlined style={{ fontSize: 18, color: '#0d9488' }} />}
                  onClick={() => setSsvDecisionTarget(record)}
                />
              </Tooltip>
            ) : null}
            {canReviewData(record, role) && canApprove ? (
              <>
                <Tooltip title={t('scientificDepartment.monographs.dataApproveAction')}>
                  <Button
                    type="text"
                    size="small"
                    icon={
                      <CheckCircleOutlined
                        style={{ fontSize: 18, color: 'var(--brand-primary)' }}
                      />
                    }
                    onClick={() => setDataApproveTarget(record)}
                  />
                </Tooltip>
                <Tooltip title={t('scientificDepartment.monographs.dataRejectAction')}>
                  <Button
                    type="text"
                    size="small"
                    icon={
                      <CloseCircleOutlined
                        style={{ fontSize: 18, color: 'var(--brand-error)' }}
                      />
                    }
                    onClick={() => setDataRejectTarget(record)}
                  />
                </Tooltip>
              </>
            ) : null}
            {canCreate && canEditMonograph(record, role) ? (
              <Tooltip title={t('scientificDepartment.edit')}>
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined style={{ fontSize: 18, color: 'var(--brand-info)' }} />}
                  onClick={() => openEdit(record)}
                />
              </Tooltip>
            ) : null}
            {canCreate && canResubmitMonograph(record, role) ? (
              <Tooltip title={t('scientificDepartment.articles.resubmit')}>
                <Button
                  type="text"
                  size="small"
                  icon={<ReloadOutlined style={{ fontSize: 18, color: 'var(--brand-warning)' }} />}
                  onClick={() => openEdit(record)}
                />
              </Tooltip>
            ) : null}
            <Tooltip title={t('scientificDepartment.view')}>
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined style={{ fontSize: 18, color: 'var(--color-text-mute)' }} />}
                onClick={() => navigate(`/scientific-department/monographs/${record.id}`)}
              />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <PageContainer title={t('scientificDepartment.monographs.title')}>
      <Filters
        hideSearch={role === 'teacher'}
        searchPlaceholder="scientificDepartment.monographs.searchPlaceholder"
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        selects={[
          {
            key: 'status',
            placeholder: 'scientificDepartment.allStatuses',
            value: statusFilter,
            options: STATUS_FILTER_OPTIONS.map((s) => ({
              value: s,
              label: t(`scientificDepartment.status.${s}`),
            })),
            onChange: (v) => {
              setStatusFilter(v as BadgeStatus | undefined);
              setPage(1);
            },
          },
          ...(isReviewer
            ? [
                {
                  key: 'faculty',
                  placeholder: 'scientificDepartment.allFaculties',
                  value: facultyFilter,
                  options: faculties.map((f) => ({ value: f.id, label: f.name })),
                  onChange: (v?: string) => {
                    setFacultyFilter(v);
                    setDeptFilter(undefined);
                    setPage(1);
                  },
                },
                {
                  key: 'department',
                  placeholder: 'scientificDepartment.allDepartments',
                  value: deptFilter,
                  options: departmentsOfFaculty(departments, facultyFilter).map((d) => ({ value: d.id, label: d.name })),
                  onChange: (v?: string) => {
                    setDeptFilter(v);
                    setPage(1);
                  },
                },
              ]
            : []),
        ]}
        extra={
          <Flex align="center" gap={12} wrap className="sci-toolbar-actions">
            <style>{`.sci-toolbar-actions .ant-btn { height: 38px; }`}</style>
            <RangePicker
              maxWidth={260}
              size="middle"
              placeholder={[t('scientificDepartment.rangeFrom'), t('scientificDepartment.rangeTo')]}
              style={{ height: 38, width: '100%' }}
              value={dateRange}
              onChange={(r) => {
                setDateRange(r);
                setPage(1);
              }}
            />
            <Button
              icon={<FileExcelOutlined />}
              loading={exporting}
              onClick={handleExport}
              style={{
                background: 'var(--brand-primary)',
                borderColor: 'var(--brand-primary)',
                color: '#fff',
              }}
            >
              {t('scientificDepartment.reports.exportExcel')}
            </Button>
            {canCreate ? (
              <>
                <TemplatesButton category="monograph" />
                <Button type="primary" icon={<UploadOutlined />} onClick={openAdd}>
                  {t('scientificDepartment.monographs.upload')}
                </Button>
              </>
            ) : null}
          </Flex>
        }
      />

      <TableGap>
        <DataTable<Monograph>
          data={pagedMonographs}
          columns={columns}
          loading={isFetching}
          page={page}
          pageSize={pageSize}
          total={totalCount}
          onPageChange={(p, ps) => {
            setPage(p);
            setPageSize(ps);
          }}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
          onRowClick={(row) => navigate(`/scientific-department/monographs/${row.id}`)}
        />
      </TableGap>

      <Modal centered
        title={
          editing
            ? editing.status === 'rejected'
              ? t('scientificDepartment.monographs.resubmitTitle')
              : t('scientificDepartment.monographs.editTitle')
            : t('scientificDepartment.monographs.addTitle')
        }
        open={formOpen}
        onCancel={() => {
          setFormOpen(false);
          setEditing(null);
          setSlotFiles({});
        }}
        onOk={handleSubmit}
        okText={
          editing
            ? t('scientificDepartment.methodical.saveAndSend')
            : t('scientificDepartment.save')
        }
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={createMonograph.isPending || updateMonograph.isPending}
        width={760}
      >
        <div
          style={{
            background: 'var(--brand-primary-soft)',
            border: '1px solid color-mix(in srgb, var(--brand-primary) 25%, #fff)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            fontSize: 12.5,
            color: 'var(--color-text-soft)',
            marginBottom: 16,
          }}
        >
          {t('scientificDepartment.monographs.uploadHint')}
        </div>
        <FileUploadGrid
          slots={MONOGRAPH_FILE_SLOTS}
          value={slotFiles}
          onChange={setSlotFiles}
          existingFiles={editing?.files}
        />
      </Modal>

      <Modal centered
        title={t('scientificDepartment.monographs.approveTitle')}
        open={!!approveTarget}
        onCancel={() => setApproveTarget(null)}
        onOk={handleApprove}
        okText={t('scientificDepartment.confirm')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={approveMonograph.isPending}
      >
        {approveTarget ? (
          <>
            <div
              style={{
                background: 'var(--color-bg-elevate)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                marginBottom: 8,
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {approveTarget.authorName} · {approveTarget.facultyName || '—'}
            </div>
            <div style={{ color: 'var(--color-text-soft)', fontSize: 12.5 }}>
              {t('scientificDepartment.monographs.approveBody')}
            </div>
            <DecisionWarning />
          </>
        ) : null}
      </Modal>

      <EriSignModal
        open={!!signTarget}
        mode="sign"
        summary={
          signTarget
            ? `${signTarget.authorName} · ${signTarget.title ?? t('scientificDepartment.monographs.noTitle')}`
            : ''
        }
        loading={signMonograph.isPending}
        onCancel={() => setSignTarget(null)}
        onOk={handleSign}
      />

      <Modal centered
        title={t('scientificDepartment.monographs.rejectTitle')}
        open={!!rejectTarget}
        onCancel={() => {
          setRejectTarget(null);
          setRejectReason('');
        }}
        onOk={handleReject}
        okText={t('scientificDepartment.send')}
        cancelText={t('scientificDepartment.cancel')}
        okButtonProps={{ danger: true }}
        confirmLoading={rejectMonograph.isPending}
      >
        <Form layout="vertical">
          <Form.Item label={t('scientificDepartment.rejectReason')} required>
            <Input.TextArea
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('scientificDepartment.rejectReasonPlaceholder')}
            />
          </Form.Item>
        </Form>
        <DecisionWarning />
      </Modal>

      <Modal centered
        title={
          <span>
            <CloudUploadOutlined style={{ color: '#4f46e5', marginRight: 8 }} />
            {t('scientificDepartment.monographs.ssvSendAction')}
          </span>
        }
        open={!!ssvSendTarget}
        onCancel={() => setSsvSendTarget(null)}
        onOk={handleSsvSend}
        okText={t('scientificDepartment.send')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={ssvSendMonograph.isPending}
      >
        {ssvSendTarget ? (
          <>
            <div
              style={{
                background: 'color-mix(in srgb, #4f46e5 8%, #fff)',
                border: '1px solid color-mix(in srgb, #4f46e5 25%, #fff)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                marginBottom: 8,
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {ssvSendTarget.authorName} · {ssvSendTarget.facultyName || '—'}
            </div>
            <div style={{ color: 'var(--color-text-soft)', fontSize: 12.5 }}>
              {t('scientificDepartment.monographs.ssvSendBody')}
            </div>
            <DecisionWarning />
          </>
        ) : null}
      </Modal>

      <Modal centered
        title={t('scientificDepartment.monographs.ssvDecisionTitle')}
        open={!!ssvDecisionTarget}
        onCancel={closeSsvDecision}
        width={480}
        footer={[
          <Button key="cancel" onClick={closeSsvDecision}>
            {t('scientificDepartment.cancel')}
          </Button>,
          <Button
            key="reject"
            danger
            loading={ssvRejecting && ssvDecisionMonograph.isPending}
            onClick={() => handleSsvDecision('reject')}
          >
            {t('scientificDepartment.reject')}
          </Button>,
          <Button
            key="approve"
            type="primary"
            style={{ background: '#0d9488', borderColor: '#0d9488' }}
            loading={!ssvRejecting && ssvDecisionMonograph.isPending}
            onClick={() => handleSsvDecision('approve')}
          >
            {t('scientificDepartment.approve')}
          </Button>,
        ]}
      >
        <Form form={ssvForm} layout="vertical">
          <Form.Item
            label={t('scientificDepartment.monographs.ssvResponseFile')}
            name="responseFile"
            valuePropName="fileList"
            getValueFromEvent={normFile}
            rules={[{ required: true, message: t('scientificDepartment.required') }]}
          >
            <Upload beforeUpload={() => false} maxCount={1} accept=".pdf">
              <Button icon={<UploadOutlined />}>
                {t('scientificDepartment.chooseFile')}
              </Button>
            </Upload>
          </Form.Item>
          {ssvRejecting ? (
            <Form.Item
              label={t('scientificDepartment.rejectReason')}
              name="reason"
              rules={[{ required: true, message: t('scientificDepartment.required') }]}
            >
              <Input.TextArea
                rows={3}
                placeholder={t('scientificDepartment.rejectReasonPlaceholder')}
              />
            </Form.Item>
          ) : null}
        </Form>
        <DecisionWarning />
      </Modal>

      <Modal centered
        title={t('scientificDepartment.monographs.dataApproveAction')}
        open={!!dataApproveTarget}
        onCancel={() => setDataApproveTarget(null)}
        onOk={handleDataApprove}
        okText={t('scientificDepartment.confirm')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={dataApproveMonograph.isPending}
      >
        {dataApproveTarget ? (
          <>
            <div
              style={{
                background: 'color-mix(in srgb, #7c3aed 8%, #fff)',
                border: '1px solid color-mix(in srgb, #7c3aed 25%, #fff)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                marginBottom: 8,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{dataApproveTarget.title}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-mute)', marginTop: 4 }}>
                ISBN: {dataApproveTarget.isbn || '—'} · {dataApproveTarget.publisher || '—'}
              </div>
            </div>
            <div style={{ color: 'var(--color-text-soft)', fontSize: 12.5 }}>
              {t('scientificDepartment.monographs.dataApproveBody')}
            </div>
            <DecisionWarning />
          </>
        ) : null}
      </Modal>

      <Modal centered
        title={t('scientificDepartment.monographs.dataRejectAction')}
        open={!!dataRejectTarget}
        onCancel={() => {
          setDataRejectTarget(null);
          setDataRejectReason('');
        }}
        onOk={handleDataReject}
        okText={t('scientificDepartment.send')}
        cancelText={t('scientificDepartment.cancel')}
        okButtonProps={{ danger: true }}
        confirmLoading={dataRejectMonograph.isPending}
      >
        <div style={{ color: 'var(--brand-error)', fontSize: 12.5, marginBottom: 10 }}>
          {t('scientificDepartment.monographs.dataRejectBody')}
        </div>
        <Form layout="vertical">
          <Form.Item label={t('scientificDepartment.rejectReason')} required>
            <Input.TextArea
              rows={3}
              value={dataRejectReason}
              onChange={(e) => setDataRejectReason(e.target.value)}
              placeholder={t('scientificDepartment.rejectReasonPlaceholder')}
            />
          </Form.Item>
        </Form>
        <DecisionWarning />
      </Modal>
    </PageContainer>
  );
}
