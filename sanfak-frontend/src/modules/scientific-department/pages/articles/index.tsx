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
  fetchArticlesForExport,
  useApproveArticle,
  useArticlesPaginate,
  useCreateArticle,
  useRejectArticle,
  useUpdateArticle,
  type ArticlePayload,
} from '../../api/article-api';
import { exportToExcel } from '../../lib/excel';
import { useJournals } from '../../api/journal-api';
import StatusBadge from '../../components/status-badge';
import TypeTag from '../../components/type-tag';
import DecisionWarning from '../../components/decision-warning';
import TableGap from '../../components/table-gap';
import {
  JOURNAL_TYPES,
  type Article,
  type ArticleStatus,
  type JournalType,
} from '../../model/types';
import { useAcademicYears, useFaculties } from '../../api/reference-api';

interface FormValues {
  type: JournalType;
  journal: string;
  title?: string;
  academicYear: string;
  publishedDate: dayjs.Dayjs;
  pages: string;
  authorCount: number;
  url: string;
  pdf?: UploadFile[];
}

const normFile = (e: UploadFile[] | { fileList: UploadFile[] }): UploadFile[] =>
  Array.isArray(e) ? e : e?.fileList;

export default function ArticlesPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { data: academicYears = [] } = useAcademicYears();
  const { data: faculties = [] } = useFaculties();
  const navigate = useNavigate();
  const location = useLocation();
  const can = usePermission();

  const canAdd = can('article:create');
  const canModerate = can('article:approve');
  const canReject = can('article:reject');

  const [statusFilter, setStatusFilter] = useState<ArticleStatus | undefined>();
  const [typeFilter, setTypeFilter] = useState<JournalType | undefined>();
  const [yearFilter, setYearFilter] = useState<string | undefined>();
  const [facultyFilter, setFacultyFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const filters = useMemo(
    () => ({
      status: statusFilter,
      type: typeFilter,
      academicYear: yearFilter,
      faculty: facultyFilter,
      dateFrom: dateRange?.[0],
      dateTo: dateRange?.[1],
    }),
    [statusFilter, typeFilter, yearFilter, facultyFilter, dateRange],
  );

  const { data, isFetching } = useArticlesPaginate(page, pageSize, filters);
  const articles = data?.docs ?? [];

  const [approveTarget, setApproveTarget] = useState<Article | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Article | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Article | null>(null);
  const [form] = Form.useForm<FormValues>();

  const formType = Form.useWatch('type', form);
  const { data: journals = [] } = useJournals(formType, formOpen);

  const createArticle = useCreateArticle();
  const updateArticle = useUpdateArticle();
  const approveArticle = useApproveArticle();
  const rejectArticle = useRejectArticle();

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setFormOpen(true);
  };

  const openEdit = (a: Article) => {
    setEditing(a);
    setFormOpen(true);
    form.setFieldsValue({
      type: a.type,
      journal: a.journalId ?? undefined,
      title: a.title ?? undefined,
      academicYear: a.academicYear ?? undefined,
      publishedDate: a.publishedDate ? dayjs(a.publishedDate) : undefined,
      pages: a.pages ?? undefined,
      authorCount: a.authorCount ?? undefined,
      url: a.url ?? undefined,
      pdf: a.fileUrl
        ? [{ uid: 'existing', name: t('scientificDepartment.articles.existingPdf'), status: 'done' as const }]
        : undefined,
    });
  };

  useEffect(() => {
    const resubmit = (location.state as { resubmit?: Article } | null)?.resubmit;
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
    const payload: ArticlePayload = {
      type: values.type,
      journal: values.journal,
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
        await updateArticle.mutateAsync({ id: editing.id, ...payload });
        message.success(
          editing.status === 'rejected'
            ? t('scientificDepartment.articles.resubmitted')
            : t('scientificDepartment.articles.updated'),
        );
      } else {
        if (!rawFile) {
          message.error(t('scientificDepartment.articles.pdfRequired'));
          return;
        }
        await createArticle.mutateAsync(payload);
        message.success(t('scientificDepartment.articles.created'));
      }
      closeForm();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    try {
      await approveArticle.mutateAsync(approveTarget.id);
      message.success(t('scientificDepartment.articles.approved'));
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
      await rejectArticle.mutateAsync({ id: rejectTarget.id, reason: rejectReason.trim() });
      message.success(t('scientificDepartment.articles.rejected'));
      setRejectTarget(null);
      setRejectReason('');
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await fetchArticlesForExport(filters);
      if (!rows.length) {
        message.info(t('scientificDepartment.reports.exportEmpty'));
        return;
      }
      const data = rows.map((a, i) => ({
        '№': i + 1,
        [t('scientificDepartment.articles.colAuthorTitle')]: a.authorName || '',
        [t('scientificDepartment.articles.articleTitle')]: a.title || '',
        [t('scientificDepartment.articles.colJournal')]: a.journalName || '',
        [t('scientificDepartment.articles.colType')]: t(`scientificDepartment.type.${a.type}`),
        [t('scientificDepartment.articles.colAcademicYear')]: a.academicYear || '',
        [t('scientificDepartment.articles.publishDate')]:
          a.publishedDate || a.publishYear || '',
        [t('scientificDepartment.articles.colAuthors')]: a.authorCount ?? '',
        [t('scientificDepartment.articles.colFaculty')]: a.facultyName || '',
        [t('scientificDepartment.articles.colDate')]: a.date || '',
        [t('scientificDepartment.articles.colStatus')]: t(`scientificDepartment.status.${a.status}`),
      }));
      const title = t('scientificDepartment.articles.title');
      exportToExcel(data, `${title}-${dayjs().format('YYYY-MM-DD')}`, title);
      message.success(t('scientificDepartment.reports.exportDone', { n: data.length }));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const columns: ColumnDef<Article, unknown>[] = [
    {
      id: 'idx',
      header: '№',
      size: 50,
      cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
    },
    {
      id: 'authorTitle',
      header: t('scientificDepartment.articles.colAuthorTitle'),
      size: 260,
      cell: ({ row }) => (
        <div style={{ lineHeight: 1.4 }}>
          <div style={{ color: 'var(--color-text)', fontWeight: 600, fontSize: 13 }}>
            {row.original.authorName || '—'}
          </div>
          <div style={{ color: 'var(--color-text-mute)', fontSize: 12, marginTop: 2 }}>
            {row.original.title || t('scientificDepartment.articles.noTitle')}
          </div>
        </div>
      ),
    },
    {
      id: 'journalName',
      header: t('scientificDepartment.articles.colJournal'),
      size: 170,
      accessorKey: 'journalName',
    },
    {
      id: 'type',
      header: t('scientificDepartment.articles.colType'),
      size: 130,
      cell: ({ row }) => <TypeTag type={row.original.type} />,
    },
    {
      id: 'academicYear',
      header: t('scientificDepartment.articles.colAcademicYear'),
      size: 110,
      accessorKey: 'academicYear',
    },
    {
      id: 'publishedDate',
      header: t('scientificDepartment.articles.publishDate'),
      size: 130,
      meta: { align: 'center' as const },
      accessorKey: 'publishedDate',
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
      id: 'facultyName',
      header: t('scientificDepartment.articles.colFaculty'),
      size: 130,
      accessorKey: 'facultyName',
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
      size: 190,
      meta: { align: 'center' as const },
      cell: ({ row }) => (
        <Space size={4} onClick={(e) => e.stopPropagation()}>
          {(canModerate || canReject) && row.original.status === 'new' ? (
            <>
              {canModerate ? (
                <Tooltip title={t('scientificDepartment.approve')}>
                  <Button
                    type="text"
                    size="small"
                    icon={
                      <CheckCircleOutlined
                        style={{ fontSize: 18, color: 'var(--brand-primary)' }}
                      />
                    }
                    onClick={() => setApproveTarget(row.original)}
                  />
                </Tooltip>
              ) : null}
              {canReject ? (
                <Tooltip title={t('scientificDepartment.reject')}>
                  <Button
                    type="text"
                    size="small"
                    icon={
                      <CloseCircleOutlined
                        style={{ fontSize: 18, color: 'var(--brand-error)' }}
                      />
                    }
                    onClick={() => setRejectTarget(row.original)}
                  />
                </Tooltip>
              ) : null}
            </>
          ) : null}
          {canAdd && row.original.status === 'new' ? (
            <Tooltip title={t('scientificDepartment.edit')}>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined style={{ fontSize: 18, color: 'var(--brand-info)' }} />}
                onClick={() => openEdit(row.original)}
              />
            </Tooltip>
          ) : null}
          {canAdd && row.original.status === 'rejected' ? (
            <Tooltip title={t('scientificDepartment.articles.resubmit')}>
              <Button
                type="text"
                size="small"
                icon={<ReloadOutlined style={{ fontSize: 18, color: 'var(--brand-warning)' }} />}
                onClick={() => openEdit(row.original)}
              />
            </Tooltip>
          ) : null}
          <Tooltip title={t('scientificDepartment.view')}>
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined style={{ fontSize: 18, color: 'var(--color-text-mute)' }} />}
              onClick={() => navigate(`/scientific-department/articles/${row.original.id}`)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const isNationalOak = formType === 'nationalOak';

  return (
    <PageContainer title={t('scientificDepartment.articles.title')}>
      <Filters
        hideSearch
        onSearch={() => undefined}
        selects={[
          {
            key: 'status',
            placeholder: 'scientificDepartment.allStatuses',
            value: statusFilter,
            options: (['new', 'approved', 'rejected', 'pending'] as ArticleStatus[]).map(
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
            options: JOURNAL_TYPES.map((v) => ({
              value: v,
              label: t(`scientificDepartment.type.${v}`),
            })),
            onChange: (v) => {
              setTypeFilter(v as JournalType | undefined);
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
          {
            key: 'faculty',
            placeholder: 'scientificDepartment.allFaculties',
            value: facultyFilter,
            options: faculties.map((f) => ({ value: f.id, label: f.name })),
            onChange: (v) => {
              setFacultyFilter(v as string | undefined);
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
        <DataTable<Article>
          data={articles}
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
          onRowClick={(row) => navigate(`/scientific-department/articles/${row.id}`)}
        />
      </TableGap>

      <Modal centered
        title={t('scientificDepartment.articles.approveTitle')}
        open={!!approveTarget}
        onCancel={() => setApproveTarget(null)}
        onOk={handleApprove}
        okText={t('scientificDepartment.confirm')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={approveArticle.isPending}
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
                {t('scientificDepartment.articles.title')}:
              </div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>
                {approveTarget.title || approveTarget.journalName}
              </div>
            </div>
            <div style={{ color: 'var(--color-text-soft)', fontSize: 13, padding: '8px 4px' }}>
              {t('scientificDepartment.articles.approveBody')}
            </div>
            <DecisionWarning />
          </>
        ) : null}
      </Modal>

      <Modal centered
        title={t('scientificDepartment.articles.rejectTitle')}
        open={!!rejectTarget}
        onCancel={() => {
          setRejectTarget(null);
          setRejectReason('');
        }}
        onOk={handleReject}
        okText={t('scientificDepartment.send')}
        cancelText={t('scientificDepartment.cancel')}
        okButtonProps={{ danger: true }}
        confirmLoading={rejectArticle.isPending}
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
                {t('scientificDepartment.articles.title')}:
              </div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>
                {rejectTarget.title || rejectTarget.journalName}
              </div>
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
              ? t('scientificDepartment.articles.resubmitTitle')
              : t('scientificDepartment.articles.editTitle')
            : t('scientificDepartment.articles.addTitle')
        }
        open={formOpen}
        onCancel={closeForm}
        onOk={handleSubmit}
        okText={
          editing ? t('scientificDepartment.update') : t('scientificDepartment.save')
        }
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={createArticle.isPending || updateArticle.isPending}
        width={560}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label={t('scientificDepartment.articles.type')}
            name="type"
            rules={[{ required: true, message: t('scientificDepartment.required') }]}
          >
            <Select
              placeholder={t('scientificDepartment.articles.typePlaceholder')}
              onChange={() => form.setFieldsValue({ journal: undefined })}
              options={JOURNAL_TYPES.map((v) => ({
                value: v,
                label: t(`scientificDepartment.type.${v}`),
              }))}
            />
          </Form.Item>

          {formType ? (
            <Form.Item
              label={t('scientificDepartment.articles.journal')}
              name="journal"
              rules={[{ required: true, message: t('scientificDepartment.required') }]}
              extra={t('scientificDepartment.articles.journalHint')}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={t('scientificDepartment.articles.journalPlaceholder')}
                notFoundContent={t('scientificDepartment.articles.journalEmpty')}
                options={journals.map((j) => ({ value: j.id, label: j.name }))}
              />
            </Form.Item>
          ) : null}

          {formType ? (
            <>
              {!isNationalOak ? (
                <Form.Item
                  label={t('scientificDepartment.articles.articleTitle')}
                  name="title"
                  rules={[{ required: true, message: t('scientificDepartment.required') }]}
                >
                  <Input placeholder={t('scientificDepartment.articles.articleTitle')} />
                </Form.Item>
              ) : null}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Form.Item
                  label={t('scientificDepartment.articles.colAcademicYear')}
                  name="academicYear"
                  rules={[{ required: true, message: t('scientificDepartment.required') }]}
                >
                  <Select
                    placeholder={t('scientificDepartment.articles.colAcademicYear')}
                    options={academicYears.map((y) => ({ value: y.value, label: y.label }))}
                  />
                </Form.Item>
                <Form.Item
                  label={t('scientificDepartment.articles.pages')}
                  name="pages"
                  rules={[{ required: true, message: t('scientificDepartment.required') }]}
                >
                  <Input placeholder="12-18" />
                </Form.Item>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Form.Item
                  label={t('scientificDepartment.articles.colAuthors')}
                  name="authorCount"
                  rules={[{ required: true, message: t('scientificDepartment.required') }]}
                >
                  <InputNumber placeholder={t('scientificDepartment.articles.authorCountPlaceholder')} min={1} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                  label={t('scientificDepartment.articles.publishDate')}
                  name="publishedDate"
                  rules={[{ required: true, message: t('scientificDepartment.required') }]}
                >
                  <DatePicker
                    style={{ width: '100%' }}
                    format="YYYY-MM-DD"
                    placeholder={t('scientificDepartment.articles.publishDatePlaceholder')}
                  />
                </Form.Item>
              </div>

              <Form.Item
                label={t('scientificDepartment.articles.url')}
                name="url"
                rules={[
                  { required: true, message: t('scientificDepartment.required') },
                  { type: 'url', message: t('scientificDepartment.invalidUrl') },
                ]}
              >
                <Input prefix={<LinkOutlined />} placeholder="https://..." />
              </Form.Item>

              <Form.Item
                label={t('scientificDepartment.articles.pdf')}
                name="pdf"
                valuePropName="fileList"
                getValueFromEvent={normFile}
                rules={
                  editing
                    ? []
                    : [{ required: true, message: t('scientificDepartment.required') }]
                }
              >
                <Upload beforeUpload={() => false} maxCount={1} accept=".pdf">
                  <Button icon={<UploadOutlined />}>
                    {t('scientificDepartment.articles.choosePdf')}
                  </Button>
                </Upload>
              </Form.Item>
            </>
          ) : null}
        </Form>
      </Modal>
    </PageContainer>
  );
}
