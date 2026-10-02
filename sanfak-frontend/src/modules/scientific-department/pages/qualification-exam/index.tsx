import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  App,
  Button,
  Checkbox,
  DatePicker,
  Form,
  Input,
  Radio,
  Select,
  Space,
  Tag,
  Tooltip,
  Upload,
} from 'antd';
import Modal from '../../components/scroll-modal';
import type { UploadFile } from 'antd';
import {
  GlobalOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FileExcelOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { type ColumnDef } from '@tanstack/react-table';
import { PageContainer, DataTable, Filters, Flex, RangePicker, phoneToDisplay } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import { usePermission } from '@/app/session';
import { useSessionStore } from '@/app/session';
import {
  fetchApplicantsForExport,
  useApplicantsPaginate,
  useApproveApplicant,
  useCreateApplicant,
  useDeleteApplicant,
  useRejectApplicant,
  useResubmitApplicant,
  useSetExamDate,
  useSetResult,
  useUpdateApplicant,
} from '../../api/qualifying-applicant-api';
import { exportToExcel } from '../../lib/excel';
import { useAllSpecialties, useOpenSpecialties } from '../../api/exam-specialty-api';
import { useCourses } from '../../api/reference-api';
import { PhoneInput } from '../../components/phone-input';
import { isCompletePhone } from '../../components/phone-input/mask';
import ApplicantCard from '../../components/applicant-card';
import ApplicantStatusTag from '../../components/applicant-status-tag';
import DecisionWarning from '../../components/decision-warning';
import FileChip from '../../components/file-chip';
import TableGap from '../../components/table-gap';
import { useConfirm } from '../../lib/use-confirm';
import { useSciRole } from '../../model/role-status';
import { allSelected, selectedRows, toggleAll } from '../../model/row-selection';
import {
  APPLICANT_DOC_SLOTS,
  APPLICANT_STATUSES,
  type ApplicantDocSlot,
  type ApplicantStatus,
  type QualifyingApplicant,
} from '../../model/types';

type FormMode = 'add' | 'edit' | 'resubmit';

interface FormValuesBase {
  name: string;
  course?: number;
  specialization: string;
  university: string;
  phone: string;
}
type FormValues = FormValuesBase & Partial<Record<ApplicantDocSlot, UploadFile[]>>;

const normFile = (e: UploadFile[] | { fileList: UploadFile[] }): UploadFile[] =>
  Array.isArray(e) ? e : e?.fileList;

export default function QualificationExamPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const can = usePermission();
  const role = useSciRole();
  const user = useSessionStore((s) => s.user);
  const { confirmDelete } = useConfirm();

  const canCreate = can('qualifyingApplicant:create');
  const canApprove = can('qualifyingApplicant:approve');
  const canSetExamDate = can('qualifyingApplicant:changeStatus');
  const isKotib = role === 'kotib';
  const isTeacher = role === 'teacher';

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApplicantStatus | undefined>();
  const [specFilter, setSpecFilter] = useState<string | undefined>();
  const [courseFilter, setCourseFilter] = useState<number | undefined>();
  const [examDateFilter, setExamDateFilter] = useState<'assigned' | 'unassigned' | undefined>();
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const filters = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter,
      specialization: specFilter,
      course: courseFilter,
      examDate: examDateFilter,
      dateFrom: dateRange?.[0],
      dateTo: dateRange?.[1],
    }),
    [search, statusFilter, specFilter, courseFilter, examDateFilter, dateRange],
  );

  const { data, isFetching } = useApplicantsPaginate(page, pageSize, filters);
  const applicants = data?.docs ?? [];
  const { data: openSpecialties = [] } = useOpenSpecialties();
  const { data: allSpecialties = [] } = useAllSpecialties();
  const { data: courses = [] } = useCourses();

  const specName = (code: string) =>
    allSpecialties.find((s) => s.code === code)?.name || code;

  const createApplicant = useCreateApplicant();
  const updateApplicant = useUpdateApplicant();
  const resubmitApplicant = useResubmitApplicant();
  const approveApplicant = useApproveApplicant();
  const rejectApplicant = useRejectApplicant();
  const setExamDate = useSetExamDate();
  const setResult = useSetResult();
  const deleteApplicant = useDeleteApplicant();

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('add');
  const [editing, setEditing] = useState<QualifyingApplicant | null>(null);
  const [form] = Form.useForm<FormValues>();

  const openAdd = () => {
    setFormMode('add');
    setEditing(null);
    form.resetFields();
    setFormOpen(true);
  };

  const openEdit = (a: QualifyingApplicant, mode: FormMode) => {
    setFormMode(mode);
    setEditing(a);
    form.resetFields();
    form.setFieldsValue({
      name: a.name,
      course: a.course ?? undefined,
      specialization: a.specialization,
      university: a.university,
      phone: a.phone,
    });
    setFormOpen(true);
  };

  const buildSlotFiles = (values: FormValues) => {
    const slots: Partial<Record<ApplicantDocSlot, File>> = {};
    APPLICANT_DOC_SLOTS.forEach((slot) => {
      const raw = values[slot]?.[0]?.originFileObj as File | undefined;
      if (raw) slots[slot] = raw;
    });
    return slots;
  };

  const handleSubmitForm = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    const payload = {
      name: values.name,
      course: values.course ?? null,
      specialization: values.specialization,
      university: values.university,
      phone: values.phone,
      slotFiles: buildSlotFiles(values),
    };
    try {
      if (formMode === 'add') {
        await createApplicant.mutateAsync(payload);
        message.success(t('scientificDepartment.exam.created'));
      } else if (formMode === 'edit' && editing) {
        await updateApplicant.mutateAsync({ id: editing.id, ...payload });
        message.success(t('scientificDepartment.exam.updated'));
      } else if (formMode === 'resubmit' && editing) {
        await resubmitApplicant.mutateAsync({ id: editing.id, ...payload });
        message.success(t('scientificDepartment.exam.resubmitted'));
      }
      setFormOpen(false);
      setEditing(null);
      form.resetFields();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const [approveTarget, setApproveTarget] = useState<QualifyingApplicant | null>(null);
  const [rejectTarget, setRejectTarget] = useState<QualifyingApplicant | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const handleReject = async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      message.error(t('scientificDepartment.exam.reasonRequired'));
      return;
    }
    try {
      await rejectApplicant.mutateAsync({ id: rejectTarget.id, reason: rejectReason });
      message.success(t('scientificDepartment.exam.rejected'));
      setRejectTarget(null);
      setRejectReason('');
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    try {
      await approveApplicant.mutateAsync(approveTarget.id);
      message.success(t('scientificDepartment.exam.approved'));
      setApproveTarget(null);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const [examTargets, setExamTargets] = useState<QualifyingApplicant[]>([]);
  const [examValue, setExamValue] = useState<dayjs.Dayjs | null>(null);

  const closeExam = () => {
    setExamTargets([]);
    setExamValue(null);
  };

  const handleSetExamDate = async () => {
    if (!examTargets.length || !examValue) {
      message.error(t('scientificDepartment.exam.dateRequired'));
      return;
    }
    try {
      await setExamDate.mutateAsync({
        ids: examTargets.map((a) => a.id),
        examDate: examValue.format('YYYY-MM-DD'),
      });
      message.success(t('scientificDepartment.exam.examDateSet'));
      setSelectedIds([]);
      closeExam();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const [resultTarget, setResultTarget] = useState<QualifyingApplicant | null>(null);
  const [resultForm] = Form.useForm<{ result: 'passed' | 'failed'; certificate?: UploadFile[] }>();
  const resultValue = Form.useWatch('result', resultForm);

  const handleSetResult = async () => {
    if (!resultTarget) return;
    const values = await resultForm.validateFields();
    const cert = values.certificate?.[0]?.originFileObj as File | undefined;
    if (values.result === 'passed' && !cert) {
      message.error(t('scientificDepartment.exam.certRequired'));
      return;
    }
    try {
      await setResult.mutateAsync({
        id: resultTarget.id,
        result: values.result,
        certificate: cert ?? null,
      });
      message.success(t('scientificDepartment.exam.resultSet'));
      setResultTarget(null);
      resultForm.resetFields();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteApplicant.mutateAsync(id);
      message.success(t('scientificDepartment.exam.deleted'));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await fetchApplicantsForExport(filters);
      if (!rows.length) {
        message.info(t('scientificDepartment.reports.exportEmpty'));
        return;
      }
      const data = rows.map((a, i) => ({
        '№': i + 1,
        [t('scientificDepartment.exam.colName')]: a.name || '',
        [t('scientificDepartment.exam.colSpecialty')]: specName(a.specialization),
        [t('scientificDepartment.exam.colCourse')]: a.course ?? '',
        [t('scientificDepartment.exam.colUniversity')]: a.university || '',
        [t('scientificDepartment.exam.colCode')]: a.specialization || '',
        [t('scientificDepartment.exam.colPhone')]: a.phone || '',
        [t('scientificDepartment.exam.colExamDate')]: a.examDate || '',
        [t('scientificDepartment.exam.colDate')]: a.date || '',
        [t('scientificDepartment.exam.colStatus')]: t(`scientificDepartment.exam.status.${a.status}`),
      }));
      const title = t('scientificDepartment.exam.title');
      exportToExcel(data, `${title}-${dayjs().format('YYYY-MM-DD')}`, title);
      message.success(t('scientificDepartment.reports.exportDone', { n: data.length }));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const isOwner = (a: QualifyingApplicant) => !!user && a.addedById === user.id;
  const canReview = (a: QualifyingApplicant) =>
    canApprove && a.status === 'new' && !isOwner(a);
  const canResult = (a: QualifyingApplicant) =>
    isKotib && a.status === 'approved' && !!a.examDate;
  const manageApproved = role === 'ilmiy' || role === 'admin';
  const canEdit = (a: QualifyingApplicant) =>
    isOwner(a) && (a.status === 'new' || (a.status === 'approved' && manageApproved));
  const canResubmit = (a: QualifyingApplicant) =>
    role === 'teacher' && isOwner(a) && a.status === 'rejected';
  const canAssignDate = (a: QualifyingApplicant) =>
    canSetExamDate && a.status === 'approved' && !a.examDate;
  const canDelete = (a: QualifyingApplicant) =>
    isOwner(a) &&
    (a.status === 'new' ||
      (a.status === 'rejected' && role === 'teacher') ||
      (a.status === 'approved' && manageApproved));

  const saving =
    createApplicant.isPending || updateApplicant.isPending || resubmitApplicant.isPending;

  const selectable = (a: QualifyingApplicant) => a.status === 'approved';
  const selectedApproved = selectedRows(applicants, selectedIds, selectable);
  const selectablePageIds = applicants.filter(selectable).map((a) => a.id);
  const allPageSelected = allSelected(selectedIds, selectablePageIds);

  const toggleId = (id: string, on: boolean) =>
    setSelectedIds((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)));

  const selectionColumn: ColumnDef<QualifyingApplicant, unknown> = {
    id: 'select',
    size: 44,
    header: () => (
      <Checkbox
        checked={allPageSelected}
        indeterminate={!allPageSelected && selectedApproved.length > 0}
        disabled={selectablePageIds.length === 0}
        onChange={(e) =>
          setSelectedIds((prev) => toggleAll(prev, selectablePageIds, e.target.checked))
        }
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={selectedIds.includes(row.original.id)}
        disabled={!selectable(row.original)}
        onChange={(e) => toggleId(row.original.id, e.target.checked)}
      />
    ),
  };

  const columns: ColumnDef<QualifyingApplicant, unknown>[] = [
    ...(canSetExamDate ? [selectionColumn] : []),
    {
      id: 'idx',
      header: '№',
      size: 54,
      cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
    },
    {
      id: 'name',
      header: t('scientificDepartment.exam.colName'),
      cell: ({ row }) => (
        <Flex align="center" gap={6} wrap>
          <strong>{row.original.name}</strong>
          {row.original.source === 'public' ? (
            <Tag
              color="processing"
              icon={<GlobalOutlined />}
              style={{ margin: 0, borderRadius: 6, fontSize: 11.5 }}
            >
              {t('scientificDepartment.exam.fromSite')}
            </Tag>
          ) : null}
        </Flex>
      ),
    },
    {
      id: 'specialty',
      header: t('scientificDepartment.exam.colSpecialty'),
      cell: ({ row }) => specName(row.original.specialization),
    },
    {
      id: 'course',
      header: t('scientificDepartment.exam.colCourse'),
      size: 80,
      cell: ({ row }) => row.original.course ?? '—',
    },
    {
      id: 'university',
      header: t('scientificDepartment.exam.colUniversity'),
      size: 120,
      cell: ({ row }) => row.original.university,
    },
    {
      id: 'code',
      header: t('scientificDepartment.exam.colCode'),
      size: 120,
      cell: ({ row }) => row.original.specialization,
    },
    {
      id: 'phone',
      header: t('scientificDepartment.exam.colPhone'),
      size: 140,
      cell: ({ row }) => phoneToDisplay(row.original.phone) || '—',
    },
    {
      id: 'examDate',
      header: t('scientificDepartment.exam.colExamDate'),
      size: 150,
      cell: ({ row }) =>
        row.original.examDate ? (
          <span style={{ color: 'var(--brand-primary)' }}>
            <CalendarOutlined /> {row.original.examDate}
          </span>
        ) : (
          <span style={{ color: 'var(--color-text-mute)' }}>
            {t('scientificDepartment.exam.notAssigned')}
          </span>
        ),
    },
    {
      id: 'date',
      header: t('scientificDepartment.exam.colDate'),
      size: 110,
      cell: ({ row }) => row.original.date || '—',
    },
    {
      id: 'status',
      header: t('scientificDepartment.exam.colStatus'),
      size: 150,
      cell: ({ row }) => (
        <ApplicantStatusTag status={row.original.status} reason={row.original.rejectionReason} />
      ),
    },
    {
      id: 'actions',
      header: t('scientificDepartment.actions'),
      size: 200,
      meta: { align: 'center' as const },
      cell: ({ row }) => {
        const a = row.original;
        return (
          <Space size={2}>
            {canReview(a) ? (
              <>
                <Tooltip title={t('scientificDepartment.approve')}>
                  <Button
                    type="text"
                    size="small"
                    icon={
                      <CheckCircleOutlined
                        style={{ fontSize: 17, color: 'var(--brand-primary)' }}
                      />
                    }
                    onClick={() => setApproveTarget(a)}
                  />
                </Tooltip>
                <Tooltip title={t('scientificDepartment.reject')}>
                  <Button
                    type="text"
                    size="small"
                    icon={
                      <CloseCircleOutlined
                        style={{ fontSize: 17, color: 'var(--brand-error)' }}
                      />
                    }
                    onClick={() => {
                      setRejectTarget(a);
                      setRejectReason('');
                    }}
                  />
                </Tooltip>
              </>
            ) : null}
            {canAssignDate(a) ? (
              <Tooltip title={t('scientificDepartment.exam.setExamDate')}>
                <Button
                  type="text"
                  size="small"
                  icon={<CalendarOutlined style={{ fontSize: 17, color: 'var(--brand-info)' }} />}
                  onClick={() => {
                    setExamTargets([a]);
                    setExamValue(null);
                  }}
                />
              </Tooltip>
            ) : null}
            {canResult(a) ? (
              <Tooltip title={t('scientificDepartment.exam.setResult')}>
                <Button
                  type="text"
                  size="small"
                  icon={
                    <SafetyCertificateOutlined
                      style={{ fontSize: 17, color: 'var(--brand-primary)' }}
                    />
                  }
                  onClick={() => {
                    setResultTarget(a);
                    resultForm.resetFields();
                  }}
                />
              </Tooltip>
            ) : null}
            {canEdit(a) ? (
              <Tooltip title={t('scientificDepartment.edit')}>
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined style={{ fontSize: 17, color: 'var(--brand-info)' }} />}
                  onClick={() => openEdit(a, 'edit')}
                />
              </Tooltip>
            ) : null}
            {canResubmit(a) ? (
              <Tooltip title={t('scientificDepartment.exam.resubmit')}>
                <Button
                  type="text"
                  size="small"
                  icon={<ReloadOutlined style={{ fontSize: 17, color: 'var(--brand-warning)' }} />}
                  onClick={() => openEdit(a, 'resubmit')}
                />
              </Tooltip>
            ) : null}
            {canDelete(a) ? (
              <Tooltip title={t('scientificDepartment.delete')}>
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined style={{ fontSize: 17, color: 'var(--brand-error)' }} />}
                  onClick={() =>
                    confirmDelete(() => handleDelete(a.id), {
                      title: 'scientificDepartment.exam.deleteConfirm',
                      content: 'scientificDepartment.exam.deleteDesc',
                    })
                  }
                />
              </Tooltip>
            ) : null}
            <Tooltip title={t('scientificDepartment.view')}>
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined style={{ fontSize: 17, color: 'var(--color-text-mute)' }} />}
                onClick={() => navigate(`/scientific-department/qualification-exam/${a.id}`)}
              />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  const specialtyItem = (
    <Form.Item
      label={t('scientificDepartment.exam.colSpecialty')}
      name="specialization"
      rules={[{ required: true, message: t('scientificDepartment.required') }]}
    >
      <Select
        showSearch
        optionFilterProp="label"
        placeholder={t('scientificDepartment.exam.specialtyPlaceholder')}
        notFoundContent={t('scientificDepartment.exam.noOpenSpecialty')}
        options={openSpecialties.map((s) => ({
          value: s.code,
          label: s.name ? `${s.code} — ${s.name}` : s.code,
        }))}
      />
    </Form.Item>
  );

  const docItem = (slot: ApplicantDocSlot, required: boolean, index: number) => {
    const existingUrl = formMode === 'add' ? undefined : editing?.documents?.[slot];

    return (
      <div className="sci-doc-row" key={slot}>
        <span className="sci-doc-label">
          <span className="sci-doc-idx">{index + 1}.</span>
          {t(`scientificDepartment.exam.doc.${slot}`)}
          {required ? <span className="sci-doc-req"> *</span> : null}
        </span>
        <Form.Item
          name={slot}
          valuePropName="fileList"
          getValueFromEvent={normFile}
          style={{ marginBottom: 0 }}
          className="sci-doc-field"
          extra={existingUrl ? <FileChip url={existingUrl} /> : undefined}
          rules={
            required
              ? [
                  {
                    validator: (_, v) =>
                      v && v.length
                        ? Promise.resolve()
                        : Promise.reject(new Error(t('scientificDepartment.required'))),
                  },
                ]
              : undefined
          }
        >
          <Upload beforeUpload={() => false} maxCount={1} accept=".pdf">
            <Button icon={<UploadOutlined />} size="small" type="link">
              {existingUrl
                ? t('scientificDepartment.exam.replaceFile')
                : t('scientificDepartment.chooseFile')}
            </Button>
          </Upload>
        </Form.Item>
      </div>
    );
  };

  return (
    <PageContainer title={t('scientificDepartment.exam.title')}>
      <div className="sci-exam-filters">
      <style>{`
        .sci-exam-filters > div > div:empty { flex: 0 0 0; }
        .sci-exam-filters .ant-input-affix-wrapper { max-width: none !important; flex: 2 1 200px; }
        .sci-exam-filters .ant-select { flex: 1 1 160px; }
        .sci-exam-filters .sci-toolbar-actions { flex: 1 1 100%; justify-content: flex-end; }
        .sci-exam-filters .sci-toolbar-actions > div:first-of-type { margin-right: auto; }
      `}</style>
      <Filters
        searchPlaceholder="scientificDepartment.exam.searchPlaceholder"
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        selects={[
          {
            key: 'status',
            placeholder: 'scientificDepartment.exam.allStatuses',
            value: statusFilter,
            options: APPLICANT_STATUSES.map((s) => ({
              value: s,
              label: t(`scientificDepartment.exam.status.${s}`),
            })),
            onChange: (v) => {
              setStatusFilter(v as ApplicantStatus | undefined);
              setPage(1);
            },
          },
          {
            key: 'specialization',
            placeholder: 'scientificDepartment.exam.allSpecialties',
            value: specFilter,
            options: allSpecialties.map((s) => ({
              value: s.code,
              label: s.name ? `${s.code} — ${s.name}` : s.code,
            })),
            onChange: (v) => {
              setSpecFilter(v as string | undefined);
              setPage(1);
            },
          },
          ...(isTeacher
            ? []
            : [
                {
                  key: 'course',
                  placeholder: 'scientificDepartment.exam.allCourses',
                  value: courseFilter ? String(courseFilter) : undefined,
                  options: courses.map((c) => ({
                    value: String(c.value),
                    label: c.label,
                  })),
                  onChange: (v: string | undefined) => {
                    setCourseFilter(v ? Number(v) : undefined);
                    setPage(1);
                  },
                },
              ]),
          {
            key: 'examDate',
            placeholder: 'scientificDepartment.exam.allExamDates',
            value: examDateFilter,
            options: [
              { value: 'assigned', label: t('scientificDepartment.exam.assigned') },
              { value: 'unassigned', label: t('scientificDepartment.exam.unassigned') },
            ],
            onChange: (v) => {
              setExamDateFilter(v as 'assigned' | 'unassigned' | undefined);
              setPage(1);
            },
          },
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
            {canSetExamDate ? (
              <Button
                icon={<CalendarOutlined />}
                disabled={selectedApproved.length === 0}
                onClick={() => {
                  setExamTargets(selectedApproved);
                  setExamValue(null);
                }}
              >
                {t('scientificDepartment.exam.setExamDate')}
                {selectedApproved.length > 0 ? ` (${selectedApproved.length})` : ''}
              </Button>
            ) : null}
            {canCreate && role !== 'ilmiy' ? (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => openAdd()}
              >
                {isTeacher
                  ? t('scientificDepartment.exam.submitApplication')
                  : t('scientificDepartment.exam.add')}
              </Button>
            ) : null}
          </Flex>
        }
      />
      </div>

      <TableGap>
        <DataTable<QualifyingApplicant>
          data={applicants}
          columns={columns}
          loading={isFetching}
          page={page}
          pageSize={pageSize}
          total={data?.totalDocs ?? 0}
          onPageChange={(p, ps) => {
            setPage(p);
            setPageSize(ps);
          }}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      </TableGap>

      <Modal
        centered
        title={
          formMode === 'add'
            ? isTeacher
              ? t('scientificDepartment.exam.submitApplication')
              : t('scientificDepartment.exam.addTitle')
            : formMode === 'resubmit'
              ? t('scientificDepartment.exam.resubmitTitle')
              : t('scientificDepartment.exam.editTitle')
        }
        open={formOpen}
        onCancel={() => {
          setFormOpen(false);
          setEditing(null);
          form.resetFields();
        }}
        onOk={handleSubmitForm}
        okText={
          formMode === 'resubmit'
            ? t('scientificDepartment.send')
            : t('scientificDepartment.save')
        }
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={saving}
        width={640}
      >
        {formMode === 'resubmit' && editing?.rejectionReason ? (
          <div
            style={{
              background: 'color-mix(in srgb, var(--brand-error) 8%, #fff)',
              border: '1px solid color-mix(in srgb, var(--brand-error) 25%, #fff)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              marginBottom: 16,
              fontSize: 12.5,
              color: 'var(--brand-error)',
            }}
          >
            {t('scientificDepartment.status.rejectedBy')}: {editing.rejectionReason}
          </div>
        ) : null}
        <Form form={form} layout="vertical">
          {!isTeacher && (
            <Form.Item
              label={t('scientificDepartment.exam.colName')}
              name="name"
              rules={[{ required: true, message: t('scientificDepartment.required') }]}
            >
              <Input placeholder={t('scientificDepartment.exam.namePlaceholder')} />
            </Form.Item>
          )}

          {isTeacher ? (
            specialtyItem
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '140px minmax(0, 1fr)',
                gap: 12,
                alignItems: 'start',
              }}
            >
              <Form.Item label={t('scientificDepartment.exam.colCourse')} name="course">
                <Select
                  placeholder={t('scientificDepartment.exam.coursePlaceholder')}
                  options={courses.map((c) => ({ value: c.value, label: c.label }))}
                />
              </Form.Item>
              {specialtyItem}
            </div>
          )}
          {!isTeacher && (
            <>
              <Form.Item
                label={t('scientificDepartment.exam.colUniversity')}
                name="university"
                rules={[{ required: true, message: t('scientificDepartment.required') }]}
              >
                <Input placeholder={t('scientificDepartment.exam.universityPlaceholder')} />
              </Form.Item>
              <Form.Item
                label={t('scientificDepartment.exam.colPhone')}
                name="phone"
                rules={[
                  { required: true, message: t('scientificDepartment.required') },
                  {
                    validator: (_, v) =>
                      !v || isCompletePhone(v)
                        ? Promise.resolve()
                        : Promise.reject(
                            new Error(t('scientificDepartment.exam.phoneFormat')),
                          ),
                  },
                ]}
              >
                <PhoneInput />
              </Form.Item>
            </>
          )}
          <Flex align="center" gap={8} style={{ margin: '4px 0 6px' }}>
            <span
              style={{
                width: 4,
                height: 14,
                borderRadius: 2,
                background: 'var(--brand-primary)',
                display: 'inline-block',
              }}
            />
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                color: 'var(--color-text-soft)',
              }}
            >
              {t('scientificDepartment.exam.documents')}
            </span>
          </Flex>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-mute)', marginBottom: 12 }}>
            {t('scientificDepartment.exam.docsHint')}
          </div>
          <div className="sci-doc-list">
            {APPLICANT_DOC_SLOTS.map((slot, i) => docItem(slot, formMode === 'add', i))}
          </div>
          <style>{`
            .sci-doc-list {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              column-gap: var(--space-5);
              border-top: 1px solid var(--color-border-soft);
            }
            .sci-doc-row {
              display: flex;
              flex-direction: column;
              min-width: 0;
              padding: 10px 0;
              border-bottom: 1px solid var(--color-border-soft);
            }
            .sci-doc-row:last-child { border-bottom: none; }
            .sci-doc-label {
              min-height: 36px;
              font-size: 13px;
              line-height: 1.4;
              color: var(--color-text);
            }
            .sci-doc-idx { color: var(--color-text-mute); margin-right: 6px; }
            .sci-doc-req { color: var(--brand-error); }
            .sci-doc-field .ant-btn { padding-inline: 0; }
            .sci-doc-field .ant-upload-list-item-name { font-size: 12px; }
            .sci-doc-field .ant-form-item-explain { font-size: 12px; }
            @media (max-width: 575px) {
              .sci-doc-list { grid-template-columns: minmax(0, 1fr); }
            }
          `}</style>
        </Form>
      </Modal>

      <Modal
        centered
        title={
          <Space size={8}>
            <CheckCircleOutlined style={{ color: 'var(--brand-primary)' }} />
            {t('scientificDepartment.exam.approveTitle')}
          </Space>
        }
        open={!!approveTarget}
        onCancel={() => setApproveTarget(null)}
        onOk={handleApprove}
        okText={t('scientificDepartment.approve')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={approveApplicant.isPending}
      >
        {approveTarget ? (
          <ApplicantCard
            tone="success"
            name={approveTarget.name}
            subtitle={`${specName(approveTarget.specialization)} · ${approveTarget.specialization}`}
          />
        ) : null}
        <div style={{ fontSize: 13, color: 'var(--color-text-soft)' }}>
          {t('scientificDepartment.exam.approveConfirm')}
        </div>
        <DecisionWarning />
      </Modal>

      <Modal
        centered
        title={
          <Space size={8}>
            <CloseCircleOutlined style={{ color: 'var(--brand-error)' }} />
            {t('scientificDepartment.exam.rejectTitle')}
          </Space>
        }
        open={!!rejectTarget}
        onCancel={() => setRejectTarget(null)}
        onOk={handleReject}
        okText={t('scientificDepartment.send')}
        cancelText={t('scientificDepartment.cancel')}
        okButtonProps={{ danger: true }}
        confirmLoading={rejectApplicant.isPending}
      >
        {rejectTarget ? <ApplicantCard name={rejectTarget.name} /> : null}
        <Input.TextArea
          rows={3}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder={t('scientificDepartment.rejectReasonPlaceholder')}
        />
        <DecisionWarning />
      </Modal>

      <Modal
        centered
        title={t('scientificDepartment.exam.setExamDate')}
        open={examTargets.length > 0}
        onCancel={closeExam}
        onOk={handleSetExamDate}
        okText={t('scientificDepartment.save')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={setExamDate.isPending}
      >
        {examTargets.length === 1 ? (
          <div style={{ marginBottom: 12, fontWeight: 500 }}>{examTargets[0]?.name}</div>
        ) : (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 500 }}>
              {t('scientificDepartment.exam.selectedApplicants')} ({examTargets.length})
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-mute)', marginTop: 4 }}>
              {examTargets.map((a) => a.name).join(', ')}
            </div>
          </div>
        )}
        <DatePicker
          style={{ width: '100%' }}
          value={examValue}
          onChange={setExamValue}
          format="DD.MM.YYYY"
          disabledDate={(d) => d && d < dayjs().startOf('day')}
          placeholder={t('scientificDepartment.exam.examDatePlaceholder')}
        />
      </Modal>

      <Modal
        centered
        title={t('scientificDepartment.exam.setResult')}
        open={!!resultTarget}
        onCancel={() => setResultTarget(null)}
        onOk={handleSetResult}
        okText={t('scientificDepartment.save')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={setResult.isPending}
      >
        <div style={{ marginBottom: 12, fontWeight: 500 }}>{resultTarget?.name}</div>
        <Form form={resultForm} layout="vertical">
          <Form.Item
            label={t('scientificDepartment.exam.result')}
            name="result"
            rules={[{ required: true, message: t('scientificDepartment.required') }]}
          >
            <Radio.Group>
              <Radio value="passed">{t('scientificDepartment.exam.status.passed')}</Radio>
              <Radio value="failed">{t('scientificDepartment.exam.status.failed')}</Radio>
            </Radio.Group>
          </Form.Item>
          {resultValue === 'passed' ? (
            <Form.Item
              label={t('scientificDepartment.exam.certificate')}
              name="certificate"
              valuePropName="fileList"
              getValueFromEvent={normFile}
              rules={[{ required: true, message: t('scientificDepartment.exam.certRequired') }]}
            >
              <Upload beforeUpload={() => false} maxCount={1} accept=".pdf">
                <Button icon={<UploadOutlined />}>{t('scientificDepartment.chooseFile')}</Button>
              </Upload>
            </Form.Item>
          ) : null}
        </Form>
      </Modal>
    </PageContainer>
  );
}
