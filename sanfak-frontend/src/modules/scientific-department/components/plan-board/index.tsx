import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Form, Input, Select, Space, Tooltip, Upload } from 'antd';
import Modal from '../scroll-modal';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FileExcelOutlined,
  PlusOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { type ColumnDef } from '@tanstack/react-table';
import type { UploadFile } from 'antd';
import dayjs from 'dayjs';
import { PageContainer, DataTable, Filters, Flex, RangePicker } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import { usePermission } from '@/app/session';
import { useAcademicYears, type PlanApi, type PlanPayload } from '../../api/plan-api';
import { departmentsOfFaculty, useDepartments, useFaculties } from '../../api/reference-api';
import { exportToExcel } from '../../lib/excel';
import StatusBadge from '../status-badge';
import TableGap from '../table-gap';
import DecisionWarning from '../decision-warning';
import { useStageActionable } from '../../model/stage-gate';
import type { ArticleStatus, Plan } from '../../model/types';

interface FormValues {
  academicYear: string;
  pdf?: UploadFile[];
}

const normFile = (e: UploadFile[] | { fileList: UploadFile[] }): UploadFile[] =>
  Array.isArray(e) ? e : e?.fileList;

export default function PlanBoard({
  api,
  prefix,
  permSection,
  detailBase,
}: {
  api: PlanApi;
  prefix: 'workPlans' | 'annualReports';
  permSection: 'departmentWorkPlan' | 'annualReport';
  detailBase: string;
}) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const can = usePermission();

  const canUpload = can(`${permSection}:create`);
  const showDeptFilter = !canUpload;
  const { canApprove: canApproveStage, canReject: canRejectStage } =
    useStageActionable(permSection);

  const [statusFilter, setStatusFilter] = useState<ArticleStatus | undefined>();
  const [yearFilter, setYearFilter] = useState<string | undefined>();
  const [deptFilter, setDeptFilter] = useState<string | undefined>();
  const [facultyFilter, setFacultyFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const filters = useMemo(
    () => ({
      status: statusFilter,
      academicYear: yearFilter,
      faculty: showDeptFilter ? facultyFilter : undefined,
      department: showDeptFilter ? deptFilter : undefined,
      dateFrom: dateRange?.[0],
      dateTo: dateRange?.[1],
    }),
    [statusFilter, yearFilter, facultyFilter, deptFilter, showDeptFilter, dateRange],
  );

  const { data, isFetching } = api.usePaginate(page, pageSize, filters);
  const plans = data?.docs ?? [];
  const { data: academicYears = [] } = useAcademicYears();
  const { data: departments = [] } = useDepartments();
  const { data: faculties = [] } = useFaculties();

  const [approveTarget, setApproveTarget] = useState<Plan | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Plan | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form] = Form.useForm<FormValues>();

  const createPlan = api.useCreate();
  const updatePlan = api.useUpdate();
  const approvePlan = api.useApprove();
  const rejectPlan = api.useReject();

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setFormOpen(true);
  };

  const openEdit = (p: Plan) => {
    setEditing(p);
    setFormOpen(true);
    form.setFieldsValue({
      academicYear: p.academicYearId ?? undefined,
      pdf: p.fileUrl
        ? [{ uid: 'existing', name: t('scientificDepartment.articles.existingPdf'), status: 'done' as const }]
        : undefined,
    });
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const handleSubmit = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    const rawFile = values.pdf?.[0]?.originFileObj as File | undefined;
    const payload: PlanPayload = { academicYear: values.academicYear, file: rawFile ?? null };
    try {
      if (editing) {
        await updatePlan.mutateAsync({ id: editing.id, ...payload });
        message.success(
          editing.status === 'rejected'
            ? t('scientificDepartment.plans.resubmitted')
            : t('scientificDepartment.plans.updated'),
        );
      } else {
        if (!rawFile) {
          message.error(t('scientificDepartment.plans.pdfRequired'));
          return;
        }
        await createPlan.mutateAsync(payload);
        message.success(t('scientificDepartment.plans.uploaded'));
      }
      closeForm();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    try {
      await approvePlan.mutateAsync(approveTarget.id);
      message.success(t('scientificDepartment.plans.approved'));
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
      await rejectPlan.mutateAsync({ id: rejectTarget.id, reason: rejectReason.trim() });
      message.success(t('scientificDepartment.plans.rejected'));
      setRejectTarget(null);
      setRejectReason('');
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await api.fetchAll(filters);
      if (!rows.length) {
        message.info(t('scientificDepartment.reports.exportEmpty'));
        return;
      }
      const data = rows.map((p, i) => ({
        '№': i + 1,
        [t('scientificDepartment.plans.colDeptFaculty')]: [p.departmentName, p.facultyName]
          .filter(Boolean)
          .join(' / '),
        [t('scientificDepartment.articles.colAcademicYear')]: p.academicYearTitle || '',
        [t('scientificDepartment.articles.colDate')]: p.date || '',
        [t('scientificDepartment.articles.colStatus')]: t(
          `scientificDepartment.status.${p.status}`,
        ),
      }));
      const title = t(`scientificDepartment.${prefix}.title`);
      exportToExcel(data, `${title}-${dayjs().format('YYYY-MM-DD')}`, title);
      message.success(t('scientificDepartment.reports.exportDone', { n: data.length }));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const columns: ColumnDef<Plan, unknown>[] = [
    {
      id: 'idx',
      header: '№',
      size: 50,
      cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
    },
    {
      id: 'dept',
      header: t('scientificDepartment.plans.colDeptFaculty'),
      size: 260,
      cell: ({ row }) => (
        <div style={{ lineHeight: 1.4 }}>
          <div style={{ color: 'var(--color-text)', fontWeight: 600, fontSize: 13 }}>
            {row.original.departmentName || '—'}
          </div>
          <div style={{ color: 'var(--color-text-mute)', fontSize: 12, marginTop: 2 }}>
            {row.original.facultyName || '—'}
          </div>
        </div>
      ),
    },
    {
      id: 'academicYearTitle',
      header: t('scientificDepartment.articles.colAcademicYear'),
      size: 120,
      accessorKey: 'academicYearTitle',
    },
    {
      id: 'date',
      header: t('scientificDepartment.articles.colDate'),
      size: 110,
      accessorKey: 'date',
    },
    {
      id: 'status',
      header: t('scientificDepartment.articles.colStatus'),
      size: 160,
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
      size: 200,
      meta: { align: 'center' as const },
      cell: ({ row }) => {
        const record = row.original;
        return (
        <Space size={4} onClick={(e) => e.stopPropagation()}>
          {canApproveStage(record.status) ? (
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
          {canRejectStage(record.status) ? (
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
          {canUpload && record.status === 'new' ? (
            <Tooltip title={t('scientificDepartment.edit')}>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined style={{ fontSize: 18, color: 'var(--brand-info)' }} />}
                onClick={() => openEdit(record)}
              />
            </Tooltip>
          ) : null}
          {canUpload && record.status === 'rejected' ? (
            <Button
              type="primary"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => openEdit(record)}
              style={{ borderRadius: 'var(--radius-md)' }}
            >
              {t('scientificDepartment.articles.resubmit')}
            </Button>
          ) : null}
          {record.fileUrl ? (
            <Tooltip title={t('scientificDepartment.downloadFile')}>
              <Button
                type="text"
                size="small"
                icon={<DownloadOutlined style={{ fontSize: 18, color: 'var(--brand-primary)' }} />}
                onClick={() =>
                  window.open(record.fileUrl as string, '_blank', 'noopener,noreferrer')
                }
              />
            </Tooltip>
          ) : null}
          <Tooltip title={t('scientificDepartment.view')}>
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined style={{ fontSize: 18, color: 'var(--color-text-mute)' }} />}
              onClick={() => navigate(`${detailBase}/${record.id}`)}
            />
          </Tooltip>
        </Space>
        );
      },
    },
  ];

  return (
    <PageContainer title={t(`scientificDepartment.${prefix}.title`)}>
      <Filters
        hideSearch
        onSearch={() => undefined}
        selects={[
          {
            key: 'status',
            placeholder: 'scientificDepartment.allStatuses',
            value: statusFilter,
            options: (['new', 'pending', 'approved', 'rejected'] as ArticleStatus[]).map(
              (s) => ({ value: s, label: t(`scientificDepartment.status.${s}`) }),
            ),
            onChange: (v) => {
              setStatusFilter(v as ArticleStatus | undefined);
              setPage(1);
            },
          },
          {
            key: 'academicYear',
            placeholder: 'scientificDepartment.allAcademicYears',
            value: yearFilter,
            options: academicYears.map((y) => ({ value: y.id, label: y.title })),
            onChange: (v) => {
              setYearFilter(v as string | undefined);
              setPage(1);
            },
          },
          ...(showDeptFilter
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
            {canUpload ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
                {t(`scientificDepartment.${prefix}.upload`)}
              </Button>
            ) : null}
          </Flex>
        }
      />

      <TableGap>
        <DataTable<Plan>
          data={plans}
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
          onRowClick={(row) => navigate(`${detailBase}/${row.id}`)}
        />
      </TableGap>

      <Modal centered
        title={t('scientificDepartment.plans.approveTitle')}
        open={!!approveTarget}
        onCancel={() => setApproveTarget(null)}
        onOk={handleApprove}
        okText={t('scientificDepartment.confirm')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={approvePlan.isPending}
      >
        {approveTarget ? (
          <>
            <div
              style={{
                background: 'var(--color-bg-elevate)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                marginBottom: 8,
              }}
            >
              <div style={{ fontWeight: 600 }}>
                {approveTarget.departmentName} · {approveTarget.academicYearTitle}
              </div>
            </div>
            <DecisionWarning />
          </>
        ) : null}
      </Modal>

      <Modal centered
        title={t('scientificDepartment.plans.rejectTitle')}
        open={!!rejectTarget}
        onCancel={() => {
          setRejectTarget(null);
          setRejectReason('');
        }}
        onOk={handleReject}
        okText={t('scientificDepartment.send')}
        cancelText={t('scientificDepartment.cancel')}
        okButtonProps={{ danger: true }}
        confirmLoading={rejectPlan.isPending}
      >
        {rejectTarget ? (
          <>
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
          </>
        ) : null}
      </Modal>

      <Modal centered
        title={
          editing
            ? editing.status === 'rejected'
              ? t('scientificDepartment.plans.resubmitTitle')
              : t('scientificDepartment.plans.editTitle')
            : t(`scientificDepartment.${prefix}.upload`)
        }
        open={formOpen}
        onCancel={closeForm}
        onOk={handleSubmit}
        okText={editing ? t('scientificDepartment.update') : t('scientificDepartment.save')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={createPlan.isPending || updatePlan.isPending}
        width={480}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label={t('scientificDepartment.articles.colAcademicYear')}
            name="academicYear"
            rules={[{ required: true, message: t('scientificDepartment.required') }]}
          >
            <Select
              placeholder={t('scientificDepartment.articles.colAcademicYear')}
              options={academicYears.map((y) => ({ value: y.id, label: y.title }))}
            />
          </Form.Item>
          <Form.Item
            label={t('scientificDepartment.plans.file')}
            name="pdf"
            valuePropName="fileList"
            getValueFromEvent={normFile}
            rules={
              editing ? [] : [{ required: true, message: t('scientificDepartment.required') }]
            }
          >
            <Upload beforeUpload={() => false} maxCount={1} accept=".pdf">
              <Button icon={<UploadOutlined />}>
                {t('scientificDepartment.articles.choosePdf')}
              </Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}
