import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App, Button, DatePicker, Form, Input, InputNumber, Select, Space, Tooltip } from 'antd';
import Modal from '../../components/scroll-modal';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FileExcelOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { type ColumnDef } from '@tanstack/react-table';
import { PageContainer, DataTable, Filters, Flex, RangePicker, moneyFormatter, moneyParser } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import { usePermission } from '@/app/session';
import {
  fetchContractsForExport,
  useApproveContract,
  useContractsPaginate,
  useCreateContract,
  useDeleteContract,
  useRejectContract,
  useUpdateContract,
} from '../../api/contract-api';
import { exportToExcel } from '../../lib/excel';
import { useDepartments, useTeachers } from '../../api/reference-api';
import StatusBadge from '../../components/status-badge';
import TableGap from '../../components/table-gap';
import DecisionWarning from '../../components/decision-warning';
import FileUploadGrid from '../../components/file-upload-grid';
import { useConfirm } from '../../lib/use-confirm';
import { useSciRole } from '../../model/role-status';
import {
  CONTRACT_FILE_SLOTS,
  type ArticleStatus,
  type ContractSlot,
  type EconomicContract,
} from '../../model/types';

interface FormValues {
  teacher?: string;
  title: string;
  partnerOrganization: string;
  amount: number;
  contractDate: dayjs.Dayjs;
}

const formatMoney = (amount: number): string =>
  `${new Intl.NumberFormat('uz-UZ').format(amount)} so'm`;

export default function IndustryOrdersPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { confirmDelete } = useConfirm();
  const navigate = useNavigate();
  const location = useLocation();
  const can = usePermission();
  const role = useSciRole();

  const canCreate = can('economicContract:create');
  const canApprove = can('economicContract:approve');
  const canReject = can('economicContract:reject');
  const canUpdate = can('economicContract:update');
  const canDelete = can('economicContract:delete');
  const isIlmiy = role === 'ilmiy' || role === 'admin';

  const [statusFilter, setStatusFilter] = useState<ArticleStatus | undefined>();
  const [deptFilter, setDeptFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const filters = useMemo(
    () => ({
      status: statusFilter,
      department: isIlmiy ? deptFilter : undefined,
      dateFrom: dateRange?.[0],
      dateTo: dateRange?.[1],
    }),
    [statusFilter, deptFilter, isIlmiy, dateRange],
  );

  const { data, isFetching } = useContractsPaginate(page, pageSize, filters);
  const contracts = data?.docs ?? [];
  const { data: departments = [] } = useDepartments();
  const { data: teachers = [] } = useTeachers();

  const createContract = useCreateContract();
  const updateContract = useUpdateContract();
  const approveContract = useApproveContract();
  const rejectContract = useRejectContract();
  const deleteContract = useDeleteContract();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EconomicContract | null>(null);
  const [slotFiles, setSlotFiles] = useState<Partial<Record<string, File>>>({});
  const [form] = Form.useForm<FormValues>();

  const [approveTarget, setApproveTarget] = useState<EconomicContract | null>(null);
  const [rejectTarget, setRejectTarget] = useState<EconomicContract | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const openAdd = () => {
    setEditing(null);
    setSlotFiles({});
    form.resetFields();
    setFormOpen(true);
  };

  const openEdit = (c: EconomicContract) => {
    setEditing(c);
    setSlotFiles({});
    setFormOpen(true);
    form.setFieldsValue({
      teacher: c.teacherId ?? undefined,
      title: c.title,
      partnerOrganization: c.partnerOrganization,
      amount: c.amount,
      contractDate: c.contractDate ? dayjs(c.contractDate) : undefined,
    });
  };

  useEffect(() => {
    const resubmit = (location.state as { resubmit?: EconomicContract } | null)?.resubmit;
    if (resubmit) {
      openEdit(resubmit);
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setSlotFiles({});
    form.resetFields();
  };

  const handleSubmit = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    const payload = {
      teacher: values.teacher?.trim() || undefined,
      title: values.title,
      partnerOrganization: values.partnerOrganization,
      amount: values.amount,
      contractDate: values.contractDate.format('YYYY-MM-DD'),
      slotFiles: slotFiles as Partial<Record<ContractSlot, File>>,
    };
    try {
      if (editing) {
        await updateContract.mutateAsync({ id: editing.id, ...payload });
        message.success(
          editing.status === 'rejected'
            ? t('scientificDepartment.contracts.resubmitted')
            : t('scientificDepartment.contracts.updated'),
        );
      } else {
        if (CONTRACT_FILE_SLOTS.some((s) => !slotFiles[s.slot])) {
          message.error(t('scientificDepartment.contracts.filesRequired'));
          return;
        }
        await createContract.mutateAsync(payload);
        message.success(t('scientificDepartment.contracts.created'));
      }
      closeForm();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    try {
      await approveContract.mutateAsync(approveTarget.id);
      message.success(t('scientificDepartment.contracts.approved'));
      setApproveTarget(null);
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
      await rejectContract.mutateAsync({ id: rejectTarget.id, reason: rejectReason.trim() });
      message.success(t('scientificDepartment.contracts.rejected'));
      setRejectTarget(null);
      setRejectReason('');
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteContract.mutateAsync(id);
      message.success(t('scientificDepartment.contracts.deleted'));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await fetchContractsForExport(filters);
      if (!rows.length) {
        message.info(t('scientificDepartment.reports.exportEmpty'));
        return;
      }
      const data = rows.map((c, i) => ({
        '№': i + 1,
        ...(isIlmiy
          ? { [t('scientificDepartment.contracts.colDepartment')]: c.departmentName || '' }
          : {}),
        [t('scientificDepartment.contracts.colTeacher')]: c.teacherName || '',
        [t('scientificDepartment.contracts.colTitle')]: c.title || '',
        [t('scientificDepartment.contracts.colPartner')]: c.partnerOrganization || '',
        [t('scientificDepartment.contracts.colAmount')]: c.amount ?? '',
        [t('scientificDepartment.contracts.colDate')]: c.contractDate || '',
        [t('scientificDepartment.articles.colStatus')]: t(`scientificDepartment.status.${c.status}`),
      }));
      const title = t('scientificDepartment.contracts.title');
      exportToExcel(data, `${title}-${dayjs().format('YYYY-MM-DD')}`, title);
      message.success(t('scientificDepartment.reports.exportDone', { n: data.length }));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const columns: ColumnDef<EconomicContract, unknown>[] = [
    {
      id: 'idx',
      header: '№',
      size: 50,
      cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
    },
    ...(isIlmiy
      ? [
          {
            id: 'dept',
            header: t('scientificDepartment.contracts.colDepartment'),
            size: 170,
            cell: ({ row }) => row.original.departmentName || '—',
          } as ColumnDef<EconomicContract, unknown>,
        ]
      : []),
    {
      id: 'teacher',
      header: t('scientificDepartment.contracts.colTeacher'),
      size: 160,
      cell: ({ row }) => row.original.teacherName || '—',
    },
    {
      id: 'title',
      header: t('scientificDepartment.contracts.colTitle'),
      size: 200,
      cell: ({ row }) => <strong>{row.original.title}</strong>,
    },
    {
      id: 'partner',
      header: t('scientificDepartment.contracts.colPartner'),
      size: 190,
      cell: ({ row }) => row.original.partnerOrganization,
    },
    {
      id: 'amount',
      header: t('scientificDepartment.contracts.colAmount'),
      size: 140,
      cell: ({ row }) => (
        <span style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>
          {formatMoney(row.original.amount)}
        </span>
      ),
    },
    {
      id: 'contractDate',
      header: t('scientificDepartment.contracts.colDate'),
      size: 110,
      cell: ({ row }) => row.original.contractDate || '—',
    },
    {
      id: 'status',
      header: t('scientificDepartment.articles.colStatus'),
      size: 150,
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.status}
          reason={row.original.rejectionReason}
          rejectedBy={row.original.rejectedByName}
        />
      ),
    },
    {
      id: 'actions',
      header: t('scientificDepartment.actions'),
      size: 190,
      meta: { align: 'center' as const },
      cell: ({ row }) => {
        const record = row.original;
        const reviewable = isIlmiy && record.status === 'new';
        return (
          <Space size={4} onClick={(e) => e.stopPropagation()}>
            {reviewable && canApprove ? (
              <Tooltip title={t('scientificDepartment.approve')}>
                <Button
                  type="text"
                  size="small"
                  icon={
                    <CheckCircleOutlined style={{ fontSize: 18, color: 'var(--brand-primary)' }} />
                  }
                  onClick={() => setApproveTarget(record)}
                />
              </Tooltip>
            ) : null}
            {reviewable && canReject ? (
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
            {canUpdate && record.status === 'new' ? (
              <Tooltip title={t('scientificDepartment.edit')}>
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined style={{ fontSize: 18, color: 'var(--brand-info)' }} />}
                  onClick={() => openEdit(record)}
                />
              </Tooltip>
            ) : null}
            {canUpdate && record.status === 'rejected' ? (
              <Tooltip title={t('scientificDepartment.articles.resubmit')}>
                <Button
                  type="text"
                  size="small"
                  icon={<ReloadOutlined style={{ fontSize: 18, color: 'var(--brand-warning)' }} />}
                  onClick={() => openEdit(record)}
                />
              </Tooltip>
            ) : null}
            {canDelete && record.status !== 'approved' ? (
              <Tooltip title={t('scientificDepartment.delete')}>
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined style={{ fontSize: 18, color: 'var(--brand-error)' }} />}
                  onClick={() =>
                    confirmDelete(() => handleDelete(record.id), {
                      title: 'scientificDepartment.contracts.deleteConfirm',
                      content: 'scientificDepartment.contracts.deleteDesc',
                    })
                  }
                />
              </Tooltip>
            ) : null}
            <Tooltip title={t('scientificDepartment.view')}>
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined style={{ fontSize: 18, color: 'var(--color-text-mute)' }} />}
                onClick={() => navigate(`/scientific-department/industry-orders/${record.id}`)}
              />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  const saving = createContract.isPending || updateContract.isPending;

  const deptSelect = {
    key: 'department',
    placeholder: 'scientificDepartment.contracts.allDepartments',
    value: deptFilter,
    options: departments.map((d) => ({ value: d.id, label: d.name })),
    onChange: (v?: string) => {
      setDeptFilter(v);
      setPage(1);
    },
  };
  const statusSelect = {
    key: 'status',
    placeholder: 'scientificDepartment.allStatuses',
    value: statusFilter,
    options: (['new', 'approved', 'rejected'] as ArticleStatus[]).map((s) => ({
      value: s,
      label: t(`scientificDepartment.status.${s}`),
    })),
    onChange: (v?: string) => {
      setStatusFilter(v as ArticleStatus | undefined);
      setPage(1);
    },
  };

  return (
    <PageContainer title={t('scientificDepartment.contracts.title')}>
      <Filters
        hideSearch
        onSearch={() => undefined}
        selects={isIlmiy ? [deptSelect, statusSelect] : [statusSelect]}
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
              <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
                {t('scientificDepartment.add')}
              </Button>
            ) : null}
          </Flex>
        }
      />

      <TableGap>
        <DataTable<EconomicContract>
          data={contracts}
          columns={columns}
          loading={isFetching}
          page={page}
          pageSize={pageSize}
          total={data?.totalDocs ?? 0}
          pageSizeOptions={[12, 24, 36, 48]}
          onPageChange={(p, ps) => {
            setPage(p);
            setPageSize(ps);
          }}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
          onRowClick={(row) => navigate(`/scientific-department/industry-orders/${row.id}`)}
        />
      </TableGap>

      <Modal centered
        title={
          editing
            ? editing.status === 'rejected'
              ? t('scientificDepartment.contracts.resubmitTitle')
              : t('scientificDepartment.contracts.editTitle')
            : t('scientificDepartment.contracts.addTitle')
        }
        open={formOpen}
        onCancel={closeForm}
        onOk={handleSubmit}
        okText={
          editing
            ? t('scientificDepartment.contracts.saveAndSend')
            : t('scientificDepartment.save')
        }
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={saving}
        width={520}
      >
        <div
          style={{
            background: 'var(--brand-primary-soft)',
            border: '1px solid color-mix(in srgb, var(--brand-primary) 30%, #fff)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 12.5,
            color: 'var(--brand-primary)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          <SafetyCertificateOutlined style={{ fontSize: 16, marginTop: 2 }} />
          <span>{t('scientificDepartment.contracts.formHint')}</span>
        </div>
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item label={t('scientificDepartment.contracts.teacher')} name="teacher">
            <Select
              showSearch
              allowClear
              placeholder={t('scientificDepartment.contracts.teacherPlaceholder')}
              optionFilterProp="label"
              options={teachers.map((tr) => ({ value: tr.id, label: tr.name }))}
            />
          </Form.Item>
          <Form.Item
            label={t('scientificDepartment.contracts.name')}
            name="title"
            rules={[{ required: true, message: t('scientificDepartment.required') }]}
          >
            <Input placeholder={t('scientificDepartment.contracts.namePlaceholder')} />
          </Form.Item>
          <Form.Item
            label={t('scientificDepartment.contracts.partner')}
            name="partnerOrganization"
            rules={[{ required: true, message: t('scientificDepartment.required') }]}
          >
            <Input placeholder={t('scientificDepartment.contracts.partnerPlaceholder')} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item
              label={t('scientificDepartment.contracts.amount')}
              name="amount"
              rules={[{ required: true, message: t('scientificDepartment.required') }]}
            >
              <InputNumber<number>
                placeholder={t('scientificDepartment.contracts.amountPlaceholder')}
                min={0}
                style={{ width: '100%' }}
                formatter={moneyFormatter}
                parser={moneyParser}
              />
            </Form.Item>
            <Form.Item
              label={t('scientificDepartment.contracts.contractDate')}
              name="contractDate"
              rules={[{ required: true, message: t('scientificDepartment.required') }]}
            >
              <DatePicker placeholder={t('scientificDepartment.contracts.contractDatePlaceholder')} format="YYYY-MM-DD" style={{ width: '100%' }} />
            </Form.Item>
          </div>
        </Form>
        <FileUploadGrid
          slots={CONTRACT_FILE_SLOTS}
          value={slotFiles}
          onChange={setSlotFiles}
          existingFiles={editing?.files}
        />
      </Modal>

      <Modal centered
        title={t('scientificDepartment.contracts.approveTitle')}
        open={!!approveTarget}
        onCancel={() => setApproveTarget(null)}
        onOk={handleApprove}
        okText={t('scientificDepartment.confirm')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={approveContract.isPending}
      >
        {approveTarget ? (
          <>
            <div
              style={{
                background: 'var(--brand-primary-soft)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                marginBottom: 8,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{approveTarget.title}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-mute)', marginTop: 2 }}>
                {[approveTarget.departmentName, approveTarget.teacherName]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
            <div style={{ color: 'var(--color-text-soft)', fontSize: 12.5 }}>
              {t('scientificDepartment.contracts.approveBody')}
            </div>
            <DecisionWarning />
          </>
        ) : null}
      </Modal>

      <Modal centered
        title={t('scientificDepartment.contracts.rejectTitle')}
        open={!!rejectTarget}
        onCancel={() => {
          setRejectTarget(null);
          setRejectReason('');
        }}
        onOk={handleReject}
        okText={t('scientificDepartment.send')}
        cancelText={t('scientificDepartment.cancel')}
        okButtonProps={{ danger: true }}
        confirmLoading={rejectContract.isPending}
      >
        {rejectTarget ? (
          <div
            style={{
              background: 'var(--color-bg-elevate)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 13 }}>{rejectTarget.title}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-mute)', marginTop: 2 }}>
              {[rejectTarget.departmentName, rejectTarget.teacherName].filter(Boolean).join(' · ')}
            </div>
          </div>
        ) : null}
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
    </PageContainer>
  );
}
