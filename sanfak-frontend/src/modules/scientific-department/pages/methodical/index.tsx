import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App, Button, Form, Input, Select, Space, Tag, Tooltip } from 'antd';
import Modal from '../../components/scroll-modal';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  EyeOutlined,
  FileExcelOutlined,
  GlobalOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { type ColumnDef } from '@tanstack/react-table';
import { PageContainer, DataTable, Filters, Flex, RangePicker } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import { usePermission } from '@/app/session';
import {
  fetchMethodicalForExport,
  useApproveMethodical,
  useCreateMethodical,
  useMethodicalsPaginate,
  useRejectMethodical,
  useSignMethodical,
  useUpdateMethodical,
} from '../../api/methodical-api';
import { exportToExcel } from '../../lib/excel';
import {
  departmentsOfFaculty,
  useDepartments,
  useAcademicYears,
  useFaculties,
} from '../../api/reference-api';
import { useActiveMethodicalSpecialties } from '../../api/methodical-specialty-api';
import StatusBadge from '../../components/status-badge';
import TableGap from '../../components/table-gap';
import DecisionWarning from '../../components/decision-warning';
import FileUploadGrid from '../../components/file-upload-grid';
import TemplatesButton from '../../components/templates-button';
import EriSignModal, { type EriSignValues } from '../../components/eri-sign-modal';
import {
  canEditMethodical,
  canResubmitMethodical,
  getMethodicalRoleStatus,
  methodicalActionStage,
  useSciRole,
} from '../../model/role-status';
import {
  METHODICAL_FILE_SLOTS,
  type ArticleStatus,
  type Methodical,
  type MethodicalSlot,
} from '../../model/types';

interface FormValues {
  title: string;
  specialty: string;
  academicYear: string;
}

export default function MethodicalPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const can = usePermission();
  const role = useSciRole();
  const isReviewer = role !== 'teacher';
  const { data: departments = [] } = useDepartments();
  const { data: academicYears = [] } = useAcademicYears();
  const { data: specialties = [] } = useActiveMethodicalSpecialties(can('methodicalSpecialty:read'));
  const { data: faculties = [] } = useFaculties();

  const canCreate = can('methodicalRecommendation:create');
  const canApprove = can('methodicalRecommendation:approve');
  const canSign = can('methodicalRecommendation:sign');
  const canReject = can('methodicalRecommendation:reject');

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
      faculty: isReviewer ? facultyFilter : undefined,
      department: isReviewer ? deptFilter : undefined,
      dateFrom: dateRange?.[0],
      dateTo: dateRange?.[1],
    }),
    [statusFilter, yearFilter, facultyFilter, deptFilter, isReviewer, dateRange],
  );

  const { data, isFetching } = useMethodicalsPaginate(page, pageSize, filters);
  const methodicals = data?.docs ?? [];

  const createMethodical = useCreateMethodical();
  const updateMethodical = useUpdateMethodical();
  const approveMethodical = useApproveMethodical();
  const signMethodical = useSignMethodical();
  const rejectMethodical = useRejectMethodical();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Methodical | null>(null);
  const [slotFiles, setSlotFiles] = useState<Partial<Record<string, File>>>({});
  const [form] = Form.useForm<FormValues>();

  const [approveTarget, setApproveTarget] = useState<Methodical | null>(null);
  const [signTarget, setSignTarget] = useState<Methodical | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Methodical | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const openAdd = () => {
    setEditing(null);
    setSlotFiles({});
    form.resetFields();
    setFormOpen(true);
  };

  const openEdit = (m: Methodical) => {
    setEditing(m);
    setSlotFiles({});
    setFormOpen(true);
    form.setFieldsValue({
      title: m.title,
      specialty: m.specialtyId ?? undefined,
      academicYear: m.academicYear ?? undefined,
    });
  };

  useEffect(() => {
    const resubmit = (location.state as { resubmit?: Methodical } | null)?.resubmit;
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
    const missing = METHODICAL_FILE_SLOTS.filter(
      (c) => !slotFiles[c.slot] && !(editing && editing.files[c.slot as MethodicalSlot]),
    );
    if (missing.length) {
      message.error(
        `${t('scientificDepartment.methodical.filesRequired')}: ${missing
          .map((c) => t(`scientificDepartment.${c.labelKey}`))
          .join(', ')}`,
      );
      return;
    }
    const payload = {
      title: values.title,
      specialty: values.specialty,
      academicYear: values.academicYear,
      slotFiles: slotFiles as Partial<Record<MethodicalSlot, File>>,
    };
    try {
      if (editing) {
        await updateMethodical.mutateAsync({ id: editing.id, ...payload });
        message.success(
          editing.status === 'rejected'
            ? t('scientificDepartment.methodical.resubmitted')
            : t('scientificDepartment.methodical.updated'),
        );
      } else {
        await createMethodical.mutateAsync(payload);
        message.success(t('scientificDepartment.methodical.created'));
      }
      closeForm();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    try {
      await approveMethodical.mutateAsync(approveTarget.id);
      message.success(t('scientificDepartment.methodical.ilmiyApproved'));
      setApproveTarget(null);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleSign = async (values: EriSignValues) => {
    if (!signTarget) return;
    try {
      const res = await signMethodical.mutateAsync({
        id: signTarget.id,
        eriKey: values.eriKey,
        registrationNumber: values.registrationNumber,
        academicYear: values.academicYear,
      });
      const number = (res as { registrationNumber?: string })?.registrationNumber;
      message.success(
        methodicalActionStage(signTarget, role) === 'rektor' && number
          ? `${t('scientificDepartment.methodical.rektorSigned')} ${number}`
          : t('scientificDepartment.methodical.signed'),
      );
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
      await rejectMethodical.mutateAsync({
        id: rejectTarget.id,
        reason: rejectReason.trim(),
      });
      message.success(t('scientificDepartment.methodical.rejected'));
      setRejectTarget(null);
      setRejectReason('');
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await fetchMethodicalForExport(filters);
      if (!rows.length) {
        message.info(t('scientificDepartment.reports.exportEmpty'));
        return;
      }
      const data = rows.map((m, i) => {
        const st = getMethodicalRoleStatus(m, role);
        return {
          '№': i + 1,
          [t('scientificDepartment.methodical.colNumber')]: m.registrationNumber || '',
          [t('scientificDepartment.methodical.colAuthor')]: m.authorName || '',
          [t('scientificDepartment.methodical.topic')]: m.title || '',
          [t('scientificDepartment.methodical.specialty')]: m.specialtyLabel || m.direction || '',
          [t('scientificDepartment.plans.colDeptFaculty')]: [m.departmentName, m.facultyName]
            .filter(Boolean)
            .join(' / '),
          [t('scientificDepartment.articles.colAcademicYear')]: m.academicYear || '',
          [t('scientificDepartment.articles.colDate')]: m.date || '',
          [t('scientificDepartment.articles.colStatus')]: st
            ? t(`scientificDepartment.status.${st}`)
            : '',
        };
      });
      const title = t('scientificDepartment.methodical.title');
      exportToExcel(data, `${title}-${dayjs().format('YYYY-MM-DD')}`, title);
      message.success(t('scientificDepartment.reports.exportDone', { n: data.length }));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const columns: ColumnDef<Methodical, unknown>[] = [
    {
      id: 'idx',
      header: '№',
      size: 50,
      cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
    },
    {
      id: 'number',
      header: t('scientificDepartment.methodical.colNumber'),
      size: 110,
      cell: ({ row }) =>
        row.original.registrationNumber ? (
          <Tag color="success" style={{ fontWeight: 600, borderRadius: 6 }}>
            {row.original.registrationNumber}
          </Tag>
        ) : (
          <span style={{ color: 'var(--color-text-mute)' }}>—</span>
        ),
    },
    {
      id: 'authorTitle',
      header: t('scientificDepartment.methodical.colAuthorTitle'),
      size: 280,
      cell: ({ row }) => (
        <div style={{ lineHeight: 1.4 }}>
          <Flex align="center" gap={6} wrap>
            <span style={{ fontWeight: 600, fontSize: 13 }}>
              {row.original.authorName || '—'}
            </span>
            {row.original.source === 'public' ? (
              <Tag
                color="processing"
                icon={<GlobalOutlined />}
                style={{ margin: 0, borderRadius: 6, fontSize: 11.5 }}
              >
                {t('scientificDepartment.methodical.fromSite')}
              </Tag>
            ) : null}
          </Flex>
          <div style={{ fontSize: 12, color: 'var(--color-text-mute)', marginTop: 2 }}>
            {row.original.title}
          </div>
        </div>
      ),
    },
    ...(role !== 'teacher'
      ? [
          {
            id: 'dept',
            header: t('scientificDepartment.plans.colDeptFaculty'),
            size: 220,
            cell: ({ row }) => (
              <div style={{ lineHeight: 1.4 }}>
                <div style={{ fontSize: 12.5 }}>{row.original.departmentName || '—'}</div>
                <div style={{ fontSize: 11.5, color: 'var(--color-text-mute)' }}>
                  {row.original.facultyName || '—'}
                </div>
              </div>
            ),
          } as ColumnDef<Methodical, unknown>,
        ]
      : []),
    {
      id: 'academicYear',
      header: t('scientificDepartment.articles.colAcademicYear'),
      size: 110,
      accessorKey: 'academicYear',
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
      size: 150,
      cell: ({ row }) => {
        const st = getMethodicalRoleStatus(row.original, role);
        if (!st) return <span style={{ color: 'var(--color-text-mute)' }}>—</span>;
        return (
          <StatusBadge
            status={st}
            reason={row.original.rejectionReason}
            rejectedBy={row.original.rejectedByName}
          />
        );
      },
    },
    {
      id: 'actions',
      header: t('scientificDepartment.actions'),
      size: 190,
      meta: { align: 'center' as const },
      cell: ({ row }) => {
        const record = row.original;
        const stage = methodicalActionStage(record, role);
        const showApprove = stage === 'ilmiy' && canApprove;
        const showSign = (stage === 'kotib' || stage === 'rektor') && canSign;
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
            {canCreate && canEditMethodical(record, role) ? (
              <Tooltip title={t('scientificDepartment.edit')}>
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined style={{ fontSize: 18, color: 'var(--brand-info)' }} />}
                  onClick={() => openEdit(record)}
                />
              </Tooltip>
            ) : null}
            {canCreate && canResubmitMethodical(record, role) ? (
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
                onClick={() => navigate(`/scientific-department/methodical/${record.id}`)}
              />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  const signStage = signTarget ? methodicalActionStage(signTarget, role) : null;

  return (
    <PageContainer title={t('scientificDepartment.methodical.title')}>
      <Filters
        hideSearch
        onSearch={() => undefined}
        selects={[
          {
            key: 'status',
            placeholder: 'scientificDepartment.allStatuses',
            value: statusFilter,
            options: (['new', 'pending', 'approved', 'rejected'] as ArticleStatus[]).map(
              (s) => ({
                value: s,
                label: t(`scientificDepartment.status.${s}`),
              }),
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
            options: academicYears.map((y) => ({ value: y.value, label: y.label })),
            onChange: (v) => {
              setYearFilter(v as string | undefined);
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
                <TemplatesButton category="methodical" />
                <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
                  {t('scientificDepartment.add')}
                </Button>
              </>
            ) : null}
          </Flex>
        }
      />

      <TableGap>
        <DataTable<Methodical>
          data={methodicals}
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
          onRowClick={(row) => navigate(`/scientific-department/methodical/${row.id}`)}
        />
      </TableGap>

      <Modal centered
        title={
          editing
            ? editing.status === 'rejected'
              ? t('scientificDepartment.methodical.resubmitTitle')
              : t('scientificDepartment.methodical.editTitle')
            : t('scientificDepartment.methodical.addTitle')
        }
        open={formOpen}
        onCancel={closeForm}
        onOk={handleSubmit}
        okText={
          editing
            ? t('scientificDepartment.methodical.saveAndSend')
            : t('scientificDepartment.save')
        }
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={createMethodical.isPending || updateMethodical.isPending}
        width={720}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            label={t('scientificDepartment.methodical.topic')}
            name="title"
            rules={[{ required: true, message: t('scientificDepartment.required') }]}
          >
            <Input placeholder={t('scientificDepartment.methodical.topicPlaceholder')} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item
              label={t('scientificDepartment.methodical.specialty')}
              name="specialty"
              rules={[{ required: true, message: t('scientificDepartment.required') }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={t('scientificDepartment.methodical.specialtyPlaceholder')}
                options={specialties.map((sp) => ({ value: sp.id, label: sp.label }))}
              />
            </Form.Item>
            <Form.Item
              label={t('scientificDepartment.articles.colAcademicYear')}
              name="academicYear"
              rules={[{ required: true, message: t('scientificDepartment.required') }]}
            >
              <Select placeholder={t('scientificDepartment.methodical.academicYearPlaceholder')} options={academicYears.map((y) => ({ value: y.value, label: y.label }))} />
            </Form.Item>
          </div>
        </Form>
        <FileUploadGrid
          slots={METHODICAL_FILE_SLOTS}
          value={slotFiles}
          onChange={setSlotFiles}
          existingFiles={editing?.files}
        />
      </Modal>

      <Modal centered
        title={t('scientificDepartment.methodical.approveTitle')}
        open={!!approveTarget}
        onCancel={() => setApproveTarget(null)}
        onOk={handleApprove}
        okText={t('scientificDepartment.confirm')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={approveMethodical.isPending}
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
              {approveTarget.title}
            </div>
            <div style={{ color: 'var(--color-text-soft)', fontSize: 12.5 }}>
              {t('scientificDepartment.methodical.approveBody')}
            </div>
            <DecisionWarning />
          </>
        ) : null}
      </Modal>

      <EriSignModal
        open={!!signTarget}
        mode={signStage === 'rektor' ? 'rektor' : 'sign'}
        summary={signTarget?.title ?? ''}
        loading={signMethodical.isPending}
        defaultAcademicYear={signTarget?.academicYear}
        onCancel={() => setSignTarget(null)}
        onOk={handleSign}
      />

      <Modal centered
        title={t('scientificDepartment.methodical.rejectTitle')}
        open={!!rejectTarget}
        onCancel={() => {
          setRejectTarget(null);
          setRejectReason('');
        }}
        onOk={handleReject}
        okText={t('scientificDepartment.send')}
        cancelText={t('scientificDepartment.cancel')}
        okButtonProps={{ danger: true }}
        confirmLoading={rejectMethodical.isPending}
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
    </PageContainer>
  );
}
