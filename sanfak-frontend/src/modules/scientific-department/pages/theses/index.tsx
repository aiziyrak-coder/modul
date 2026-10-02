import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  App,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Tooltip,
  Upload,
} from 'antd';
import Modal from '../../components/scroll-modal';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  EyeOutlined,
  FileExcelOutlined,
  FileSearchOutlined,
  LinkOutlined,
  PlusOutlined,
  ReloadOutlined,
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
  fetchThesesForExport,
  useApproveThesis,
  useCreateThesis,
  useRejectThesis,
  useReviewThesis,
  useThesesPaginate,
  useUpdateThesis,
  type ThesisPayload,
} from '../../api/thesis-api';
import { exportToExcel } from '../../lib/excel';
import StatusBadge from '../../components/status-badge';
import TableGap from '../../components/table-gap';
import ThesisTypeTag from '../../components/thesis-type-tag';
import DecisionWarning from '../../components/decision-warning';
import {
  THESIS_TYPES,
  type ArticleStatus,
  type Thesis,
  type ThesisType,
} from '../../model/types';
import { useAcademicYears } from '../../api/reference-api';
import { useThesisCategories } from '../../api/thesis-category-api';

interface FormValues {
  type: ThesisType;
  conferenceName: string;
  title: string;
  academicYear: string;
  publishedDate: dayjs.Dayjs;
  pages: string;
  authorCount: number;
  url?: string;
  pdf?: UploadFile[];
}

const normFile = (e: UploadFile[] | { fileList: UploadFile[] }): UploadFile[] =>
  Array.isArray(e) ? e : e?.fileList;

export default function ThesesPage() {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const { data: academicYears = [] } = useAcademicYears();
  const navigate = useNavigate();
  const location = useLocation();
  const can = usePermission();

  const canAdd = can('thesis:create');
  const canModerate = can('thesis:approve');
  const canReject = can('thesis:reject');

  const [statusFilter, setStatusFilter] = useState<ArticleStatus | undefined>();
  const [typeFilter, setTypeFilter] = useState<ThesisType | undefined>();
  const [yearFilter, setYearFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const filters = useMemo(
    () => ({
      status: statusFilter,
      type: typeFilter,
      academicYear: yearFilter,
      dateFrom: dateRange?.[0],
      dateTo: dateRange?.[1],
    }),
    [statusFilter, typeFilter, yearFilter, dateRange],
  );

  const { data, isFetching } = useThesesPaginate(page, pageSize, filters);
  const theses = data?.docs ?? [];

  const [approveTarget, setApproveTarget] = useState<Thesis | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Thesis | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Thesis | null>(null);
  const [form] = Form.useForm<FormValues>();
  const formType = Form.useWatch('type', form);
  const { data: categories = [] } = useThesisCategories(formType);

  const createThesis = useCreateThesis();
  const updateThesis = useUpdateThesis();
  const reviewThesis = useReviewThesis();
  const approveThesis = useApproveThesis();
  const rejectThesis = useRejectThesis();

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setFormOpen(true);
  };

  const openEdit = (th: Thesis) => {
    setEditing(th);
    setFormOpen(true);
    form.setFieldsValue({
      type: th.type,
      conferenceName: th.conferenceName,
      title: th.title,
      academicYear: th.academicYear ?? undefined,
      publishedDate: th.publishedDate ? dayjs(th.publishedDate) : undefined,
      pages: th.pages ?? undefined,
      authorCount: th.authorCount ?? undefined,
      url: th.url ?? undefined,
      pdf: th.fileUrl
        ? [{ uid: 'existing', name: t('scientificDepartment.articles.existingPdf'), status: 'done' as const }]
        : undefined,
    });
  };

  useEffect(() => {
    const resubmit = (location.state as { resubmit?: Thesis } | null)?.resubmit;
    if (resubmit) {
      openEdit(resubmit);
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const handleSubmit = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    const rawFile = values.pdf?.[0]?.originFileObj as File | undefined;
    const payload: ThesisPayload = {
      type: values.type,
      conferenceName: values.conferenceName,
      title: values.title,
      academicYear: values.academicYear,
      publishedDate: values.publishedDate.format('YYYY-MM-DD'),
      pages: values.pages,
      authorCount: values.authorCount,
      url: values.url,
      file: rawFile ?? null,
    };
    try {
      if (editing) {
        await updateThesis.mutateAsync({ id: editing.id, ...payload });
        message.success(
          editing.status === 'rejected'
            ? t('scientificDepartment.theses.resubmitted')
            : t('scientificDepartment.theses.updated'),
        );
      } else {
        if (!rawFile) {
          message.error(t('scientificDepartment.theses.pdfRequired'));
          return;
        }
        await createThesis.mutateAsync(payload);
        message.success(t('scientificDepartment.theses.created'));
      }
      closeForm();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleReview = async (th: Thesis) => {
    try {
      await reviewThesis.mutateAsync(th.id);
      message.success(t('scientificDepartment.theses.reviewTaken'));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    try {
      await approveThesis.mutateAsync(approveTarget.id);
      message.success(t('scientificDepartment.theses.approved'));
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
      await rejectThesis.mutateAsync({ id: rejectTarget.id, reason: rejectReason.trim() });
      message.success(t('scientificDepartment.theses.rejected'));
      setRejectTarget(null);
      setRejectReason('');
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await fetchThesesForExport(filters);
      if (!rows.length) {
        message.info(t('scientificDepartment.reports.exportEmpty'));
        return;
      }
      const data = rows.map((th, i) => ({
        '№': i + 1,
        [t('scientificDepartment.theses.colAuthorTitle')]: th.authorName || '',
        [t('scientificDepartment.theses.thesisTitle')]: th.title || '',
        [t('scientificDepartment.theses.colConference')]: th.conferenceName || '',
        [t('scientificDepartment.theses.colType')]: t(`scientificDepartment.thesisType.${th.type}`),
        [t('scientificDepartment.articles.colAcademicYear')]: th.academicYear || '',
        [t('scientificDepartment.theses.publishDate')]: th.publishedDate || th.publishYear || '',
        [t('scientificDepartment.articles.colAuthors')]: th.authorCount ?? '',
        [t('scientificDepartment.articles.colDate')]: th.date || '',
        [t('scientificDepartment.articles.colStatus')]: t(`scientificDepartment.status.${th.status}`),
      }));
      const title = t('scientificDepartment.theses.title');
      exportToExcel(data, `${title}-${dayjs().format('YYYY-MM-DD')}`, title);
      message.success(t('scientificDepartment.reports.exportDone', { n: data.length }));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const columns: ColumnDef<Thesis, unknown>[] = [
    {
      id: 'idx',
      header: '№',
      size: 50,
      cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
    },
    {
      id: 'authorTitle',
      header: t('scientificDepartment.theses.colAuthorTitle'),
      size: 260,
      cell: ({ row }) => (
        <div style={{ lineHeight: 1.4 }}>
          <div style={{ color: 'var(--color-text)', fontWeight: 600, fontSize: 13 }}>
            {row.original.authorName || '—'}
          </div>
          <div style={{ color: 'var(--color-text-mute)', fontSize: 12, marginTop: 2 }}>
            {row.original.title}
          </div>
        </div>
      ),
    },
    {
      id: 'conferenceName',
      header: t('scientificDepartment.theses.colConference'),
      size: 180,
      accessorKey: 'conferenceName',
    },
    {
      id: 'type',
      header: t('scientificDepartment.theses.colType'),
      size: 110,
      cell: ({ row }) => <ThesisTypeTag type={row.original.type} />,
    },
    {
      id: 'academicYear',
      header: t('scientificDepartment.articles.colAcademicYear'),
      size: 110,
      accessorKey: 'academicYear',
    },
    {
      id: 'publishedDate',
      header: t('scientificDepartment.theses.publishDate'),
      size: 120,
      meta: { align: 'center' as const },
      cell: ({ row }) => row.original.publishedDate || row.original.publishYear || '—',
    },
    {
      id: 'authorCount',
      header: t('scientificDepartment.articles.colAuthors'),
      size: 80,
      meta: { align: 'center' as const },
      accessorKey: 'authorCount',
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
      size: 210,
      meta: { align: 'center' as const },
      cell: ({ row }) => {
        const record = row.original;
        return (
        <Space size={4} onClick={(e) => e.stopPropagation()}>
          {canModerate && record.status === 'new' ? (
            <Tooltip title={t('scientificDepartment.theses.takeToReview')}>
              <Button
                type="text"
                size="small"
                icon={<FileSearchOutlined style={{ fontSize: 18, color: '#a16207' }} />}
                onClick={() =>
                  modal.confirm({
                    centered: true,
                    title: t('scientificDepartment.theses.reviewConfirm'),
                    content: record.title,
                    okText: t('scientificDepartment.theses.takeToReview'),
                    cancelText: t('scientificDepartment.cancel'),
                    onOk: () => handleReview(record),
                  })
                }
              />
            </Tooltip>
          ) : null}
          {(canModerate || canReject) && ['new', 'pending'].includes(record.status) ? (
            <>
              {canModerate ? (
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
              {canReject ? (
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
            </>
          ) : null}
          {canAdd && record.status === 'new' ? (
            <Tooltip title={t('scientificDepartment.edit')}>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined style={{ fontSize: 18, color: 'var(--brand-info)' }} />}
                onClick={() => openEdit(record)}
              />
            </Tooltip>
          ) : null}
          {canAdd && record.status === 'rejected' ? (
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
              onClick={() => navigate(`/scientific-department/theses/${record.id}`)}
            />
          </Tooltip>
        </Space>
        );
      },
    },
  ];

  return (
    <PageContainer title={t('scientificDepartment.theses.title')}>
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
            key: 'type',
            placeholder: 'scientificDepartment.allTypes',
            value: typeFilter,
            options: THESIS_TYPES.map((v) => ({
              value: v,
              label: t(`scientificDepartment.thesisType.${v}`),
            })),
            onChange: (v) => {
              setTypeFilter(v as ThesisType | undefined);
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
            {canAdd ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
                {t('scientificDepartment.add')}
              </Button>
            ) : null}
          </Flex>
        }
      />

      <TableGap>
        <DataTable<Thesis>
          data={theses}
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
          onRowClick={(row) => navigate(`/scientific-department/theses/${row.id}`)}
        />
      </TableGap>

      <Modal centered
        title={t('scientificDepartment.theses.approveTitle')}
        open={!!approveTarget}
        onCancel={() => setApproveTarget(null)}
        onOk={handleApprove}
        okText={t('scientificDepartment.confirm')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={approveThesis.isPending}
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
              <div style={{ color: 'var(--color-text-mute)', fontSize: 12 }}>
                {t('scientificDepartment.theses.title')}:
              </div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>{approveTarget.title}</div>
            </div>
            <DecisionWarning />
          </>
        ) : null}
      </Modal>

      <Modal centered
        title={t('scientificDepartment.theses.rejectTitle')}
        open={!!rejectTarget}
        onCancel={() => {
          setRejectTarget(null);
          setRejectReason('');
        }}
        onOk={handleReject}
        okText={t('scientificDepartment.send')}
        cancelText={t('scientificDepartment.cancel')}
        okButtonProps={{ danger: true }}
        confirmLoading={rejectThesis.isPending}
      >
        {rejectTarget ? (
          <>
            <div
              style={{
                background: 'var(--color-bg-elevate)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                marginBottom: 16,
              }}
            >
              <div style={{ color: 'var(--color-text-mute)', fontSize: 12 }}>
                {t('scientificDepartment.theses.title')}:
              </div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>{rejectTarget.title}</div>
            </div>
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
              ? t('scientificDepartment.theses.resubmitTitle')
              : t('scientificDepartment.theses.editTitle')
            : t('scientificDepartment.theses.addTitle')
        }
        open={formOpen}
        onCancel={closeForm}
        onOk={handleSubmit}
        okText={editing ? t('scientificDepartment.update') : t('scientificDepartment.save')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={createThesis.isPending || updateThesis.isPending}
        width={560}
      >
        <Form form={form} layout="vertical">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item
              label={t('scientificDepartment.theses.colType')}
              name="type"
              rules={[{ required: true, message: t('scientificDepartment.required') }]}
            >
              <Select
                placeholder={t('scientificDepartment.theses.typePlaceholder')}
                options={THESIS_TYPES.map((v) => ({
                  value: v,
                  label: t(`scientificDepartment.thesisType.${v}`),
                }))}
              />
            </Form.Item>
            <Form.Item
              label={t('scientificDepartment.articles.colAuthors')}
              name="authorCount"
              rules={[{ required: true, message: t('scientificDepartment.required') }]}
            >
              <InputNumber placeholder={t('scientificDepartment.theses.authorCountPlaceholder')} min={1} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Form.Item
            label={t('scientificDepartment.theses.colConference')}
            name="conferenceName"
            rules={[{ required: true, message: t('scientificDepartment.required') }]}
          >
            <Input placeholder={t('scientificDepartment.theses.conferencePlaceholder')} />
          </Form.Item>

          {formType ? (
            <Form.Item
              label={t('scientificDepartment.theses.thesisTitle')}
              name="title"
              rules={[{ required: true, message: t('scientificDepartment.required') }]}
              extra={t('scientificDepartment.theses.categoryHint')}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={t('scientificDepartment.theses.categoryPlaceholder')}
                notFoundContent={t('scientificDepartment.theses.categoryEmpty')}
                options={categories.map((c) => ({ value: c.name, label: c.name }))}
              />
            </Form.Item>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item
              label={t('scientificDepartment.articles.colAcademicYear')}
              name="academicYear"
              rules={[{ required: true, message: t('scientificDepartment.required') }]}
            >
              <Select
                placeholder={t('scientificDepartment.theses.academicYearPlaceholder')}
                options={academicYears.map((y) => ({ value: y.value, label: y.label }))}
              />
            </Form.Item>
            <Form.Item
              label={t('scientificDepartment.theses.publishDate')}
              name="publishedDate"
              rules={[{ required: true, message: t('scientificDepartment.required') }]}
            >
              <DatePicker
                style={{ width: '100%' }}
                format="YYYY-MM-DD"
                placeholder={t('scientificDepartment.theses.publishDatePlaceholder')}
              />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item
              label={t('scientificDepartment.articles.pages')}
              name="pages"
              rules={[{ required: true, message: t('scientificDepartment.required') }]}
            >
              <Input placeholder="12-18" />
            </Form.Item>
            <Form.Item
              label={t('scientificDepartment.theses.urlOptional')}
              name="url"
              rules={[{ type: 'url', message: t('scientificDepartment.invalidUrl') }]}
            >
              <Input prefix={<LinkOutlined />} placeholder="https://..." />
            </Form.Item>
          </div>

          <Form.Item
            label={t('scientificDepartment.theses.pdf')}
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
