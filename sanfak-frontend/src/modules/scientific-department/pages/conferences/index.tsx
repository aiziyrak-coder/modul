import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Form, Input, Select, Space, Tag, Tooltip } from 'antd';
import Modal from '../../components/scroll-modal';
import {
  CheckCircleOutlined,
  EditOutlined,
  EyeOutlined,
  FileExcelOutlined,
  MinusCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import { type ColumnDef } from '@tanstack/react-table';
import { PageContainer, DataTable, Filters, Flex, RangePicker } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import { usePermission } from '@/app/session';
import {
  fetchConferencesForExport,
  useAcceptConference,
  useConferencesPaginate,
  useCreateConference,
  useUpdateConference,
  type ConferencePayload,
} from '../../api/conference-api';
import { exportToExcel } from '../../lib/excel';
import { useDepartments } from '../../api/reference-api';
import FileUploadGrid from '../../components/file-upload-grid';
import TableGap from '../../components/table-gap';
import DeadlineCell from '../../components/deadline-cell';
import {
  CONFERENCE_TYPES,
  CONF_DOC_SLOTS,
  CONF_FILE_TYPE_OPTIONS,
  confAccept,
  type ConfRequiredDoc,
  type Conference,
  type ConferenceType,
  type FileSlotConfig,
} from '../../model/types';

interface FormValues {
  title: string;
  type: ConferenceType;
  kafedras: string[];
  deadline: dayjs.Dayjs;
  beforeDeadline?: dayjs.Dayjs;
  afterDeadline?: dayjs.Dayjs;
  requiredDocs?: ConfRequiredDoc[];
}

const TYPE_COLORS: Record<ConferenceType, string> = {
  national: 'green',
  international: 'blue',
};

export default function ConferencesPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const can = usePermission();

  const canManage = can('conference:create');
  const isKafedra = can('conference:update') && !canManage;

  const [typeFilter, setTypeFilter] = useState<ConferenceType | undefined>();
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const filters = useMemo(
    () => ({
      type: typeFilter,
      dateFrom: dateRange?.[0],
      dateTo: dateRange?.[1],
    }),
    [typeFilter, dateRange],
  );

  const { data, isFetching } = useConferencesPaginate(page, pageSize, filters);
  const conferences = data?.docs ?? [];

  const { data: departments = [] } = useDepartments();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Conference | null>(null);
  const [form] = Form.useForm<FormValues>();

  const [acceptTarget, setAcceptTarget] = useState<Conference | null>(null);

  const acceptSlots: FileSlotConfig[] = useMemo(() => {
    const docs = acceptTarget?.requiredDocs ?? [];
    if (!docs.length) return CONF_DOC_SLOTS;
    return docs.map((d, i) => ({
      slot: `doc${i}`,
      labelKey: '',
      label: d.label,
      accept: confAccept(d.fileType),
      format: confAccept(d.fileType).split(',')[0] ?? '.pdf',
      group: 'main' as const,
    }));
  }, [acceptTarget]);
  const [slotFiles, setSlotFiles] = useState<Record<string, File | undefined>>({});

  const createConference = useCreateConference();
  const updateConference = useUpdateConference();
  const acceptConference = useAcceptConference();

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setFormOpen(true);
  };

  const openEdit = (c: Conference) => {
    setEditing(c);
    setFormOpen(true);
    form.setFieldsValue({
      title: c.title,
      type: c.type,
      kafedras: c.kafedras.map((k) => k.departmentId).filter((id): id is string => !!id),
      deadline: c.deadline ? dayjs(c.deadline) : undefined,
      beforeDeadline: c.beforeDeadline ? dayjs(c.beforeDeadline) : undefined,
      afterDeadline: c.afterDeadline ? dayjs(c.afterDeadline) : undefined,
      requiredDocs: c.requiredDocs.length
        ? c.requiredDocs
        : c.requiredInfo.length
          ? c.requiredInfo.map((label) => ({ label, fileType: 'pdf' as const }))
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
    const payload: ConferencePayload = {
      title: values.title,
      type: values.type,
      deadline: values.deadline.format('YYYY-MM-DD'),
      beforeDeadline: values.beforeDeadline?.format('YYYY-MM-DD'),
      afterDeadline: values.afterDeadline?.format('YYYY-MM-DD'),
      requiredDocs: (values.requiredDocs ?? [])
        .map((d) => ({ label: (d.label ?? '').trim(), fileType: d.fileType }))
        .filter((d) => d.label),
      kafedras: values.kafedras,
    };
    try {
      if (editing) {
        await updateConference.mutateAsync({ id: editing.id, ...payload });
        message.success(t('scientificDepartment.conferences.updated'));
      } else {
        await createConference.mutateAsync(payload);
        message.success(t('scientificDepartment.conferences.created'));
      }
      closeForm();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const openAccept = (c: Conference) => {
    setAcceptTarget(c);
    setSlotFiles({});
  };

  const closeAccept = () => {
    setAcceptTarget(null);
    setSlotFiles({});
  };

  const handleAccept = async () => {
    if (!acceptTarget) return;
    const missing = acceptSlots.some((cfg) => !slotFiles[cfg.slot]);
    if (missing) {
      message.error(t('scientificDepartment.conferences.docsRequired'));
      return;
    }
    try {
      await acceptConference.mutateAsync({ id: acceptTarget.id, slotFiles });
      message.success(t('scientificDepartment.conferences.accepted'));
      closeAccept();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await fetchConferencesForExport(filters);
      if (!rows.length) {
        message.info(t('scientificDepartment.reports.exportEmpty'));
        return;
      }
      const data = rows.map((c, i) => ({
        '№': i + 1,
        [t('scientificDepartment.conferences.colTitle')]: c.title || '',
        [t('scientificDepartment.conferences.colType')]: t(
          `scientificDepartment.conferences.type.${c.type}`,
        ),
        [t('scientificDepartment.conferences.colDeadline')]: c.deadline || '',
        [t('scientificDepartment.conferences.colDate')]: c.date || '',
        [t('scientificDepartment.conferences.colStatus')]:
          c.status === 'active'
            ? t('scientificDepartment.conferences.statusActive')
            : t('scientificDepartment.conferences.statusClosed'),
      }));
      const title = t('scientificDepartment.conferences.title');
      exportToExcel(data, `${title}-${dayjs().format('YYYY-MM-DD')}`, title);
      message.success(t('scientificDepartment.reports.exportDone', { n: data.length }));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const columns: ColumnDef<Conference, unknown>[] = [
    {
      id: 'idx',
      header: '№',
      size: 50,
      cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
    },
    {
      id: 'title',
      header: t('scientificDepartment.conferences.colTitle'),
      cell: ({ row }) => (
        <strong
          style={{
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 320,
          }}
        >
          {row.original.title}
        </strong>
      ),
    },
    {
      id: 'type',
      header: t('scientificDepartment.conferences.colType'),
      size: 130,
      cell: ({ row }) => (
        <Tag color={TYPE_COLORS[row.original.type]}>
          {t(`scientificDepartment.conferences.type.${row.original.type}`)}
        </Tag>
      ),
    },
    {
      id: 'deadline',
      header: t('scientificDepartment.conferences.colDeadline'),
      size: 160,
      cell: ({ row }) => <DeadlineCell deadline={row.original.deadline} />,
    },
    {
      id: 'date',
      header: t('scientificDepartment.conferences.colDate'),
      size: 120,
      accessorKey: 'date',
    },
    {
      id: 'status',
      header: t('scientificDepartment.conferences.colStatus'),
      size: 120,
      cell: ({ row }) =>
        row.original.status === 'active' ? (
          <Tag color="success">{t('scientificDepartment.conferences.statusActive')}</Tag>
        ) : (
          <Tag>{t('scientificDepartment.conferences.statusClosed')}</Tag>
        ),
    },
    {
      id: 'actions',
      header: t('scientificDepartment.actions'),
      size: 190,
      meta: { align: 'center' as const },
      cell: ({ row }) => (
        <Space size={4} onClick={(e) => e.stopPropagation()}>
          {isKafedra && row.original.status === 'active' ? (
            row.original.acceptedByMe ? (
              <Tag icon={<CheckCircleOutlined />} color="success">
                {t('scientificDepartment.conferences.acceptedTag')}
              </Tag>
            ) : (
              <Button
                type="primary"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => openAccept(row.original)}
                style={{ borderRadius: 'var(--radius-md)' }}
              >
                {t('scientificDepartment.conferences.accept')}
              </Button>
            )
          ) : null}
          <Tooltip title={t('scientificDepartment.view')}>
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined style={{ fontSize: 18, color: 'var(--color-text-mute)' }} />}
              onClick={() => navigate(`/scientific-department/conferences/${row.original.id}`)}
            />
          </Tooltip>
          {canManage ? (
            <Tooltip title={t('scientificDepartment.edit')}>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined style={{ fontSize: 18, color: 'var(--brand-info)' }} />}
                onClick={() => openEdit(row.original)}
              />
            </Tooltip>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <PageContainer title={t('scientificDepartment.conferences.title')}>
      <Filters
        hideSearch
        onSearch={() => undefined}
        selects={[
          {
            key: 'type',
            placeholder: 'scientificDepartment.allTypes',
            value: typeFilter,
            options: CONFERENCE_TYPES.map((v) => ({
              value: v,
              label: t(`scientificDepartment.conferences.type.${v}`),
            })),
            onChange: (v) => {
              setTypeFilter(v as ConferenceType | undefined);
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
            {canManage ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
                {t('scientificDepartment.conferences.add')}
              </Button>
            ) : null}
          </Flex>
        }
      />

      <TableGap>
        <DataTable<Conference>
          data={conferences}
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
          onRowClick={(row) => navigate(`/scientific-department/conferences/${row.id}`)}
        />
      </TableGap>

      <Modal centered
        title={
          editing
            ? t('scientificDepartment.conferences.editTitle')
            : t('scientificDepartment.conferences.addTitle')
        }
        open={formOpen}
        onCancel={closeForm}
        onOk={handleSubmit}
        okText={editing ? t('scientificDepartment.update') : t('scientificDepartment.save')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={createConference.isPending || updateConference.isPending}
        width={560}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label={t('scientificDepartment.conferences.colTitle')}
            name="title"
            rules={[{ required: true, message: t('scientificDepartment.required') }]}
          >
            <Input placeholder={t('scientificDepartment.conferences.titlePlaceholder')} />
          </Form.Item>

          <Form.Item
            label={t('scientificDepartment.conferences.colType')}
            name="type"
            rules={[{ required: true, message: t('scientificDepartment.required') }]}
          >
            <Select
              placeholder={t('scientificDepartment.conferences.typePlaceholder')}
              options={CONFERENCE_TYPES.map((v) => ({
                value: v,
                label: t(`scientificDepartment.conferences.type.${v}`),
              }))}
            />
          </Form.Item>

          <Form.Item
            label={t('scientificDepartment.conferences.kafedras')}
            name="kafedras"
            rules={[{ required: true, message: t('scientificDepartment.required') }]}
          >
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              placeholder={t('scientificDepartment.conferences.kafedrasPlaceholder')}
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
            />
          </Form.Item>

          <Form.Item
            label={t('scientificDepartment.conferences.deadline')}
            name="deadline"
            rules={[{ required: true, message: t('scientificDepartment.required') }]}
          >
            <DatePicker placeholder={t('scientificDepartment.conferences.deadlinePlaceholder')} style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item
              label={t('scientificDepartment.conferences.beforeDeadline')}
              name="beforeDeadline"
            >
              <DatePicker placeholder={t('scientificDepartment.conferences.beforeDeadlinePlaceholder')} style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item
              label={t('scientificDepartment.conferences.afterDeadline')}
              name="afterDeadline"
            >
              <DatePicker placeholder={t('scientificDepartment.conferences.afterDeadlinePlaceholder')} style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            {t('scientificDepartment.conferences.requiredInfo')}
          </div>
          <Form.List name="requiredDocs">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...field }) => (
                  <Flex key={key} align="baseline" gap={8} style={{ marginBottom: 8 }}>
                    <Form.Item
                      {...field}
                      name={[name, 'label']}
                      style={{ flex: 1, marginBottom: 0 }}
                      rules={[{ required: true, message: t('scientificDepartment.required') }]}
                    >
                      <Input placeholder={t('scientificDepartment.conferences.infoItemPlaceholder')} />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[name, 'fileType']}
                      style={{ width: 140, marginBottom: 0 }}
                      rules={[{ required: true, message: t('scientificDepartment.required') }]}
                    >
                      <Select
                        placeholder={t('scientificDepartment.conferences.fileTypePlaceholder')}
                        options={CONF_FILE_TYPE_OPTIONS.map((o) => ({
                          value: o.value,
                          label: t(`scientificDepartment.${o.labelKey}`),
                        }))}
                      />
                    </Form.Item>
                    <MinusCircleOutlined
                      style={{ color: 'var(--brand-error)' }}
                      onClick={() => remove(name)}
                    />
                  </Flex>
                ))}
                <Button
                  type="dashed"
                  onClick={() => add({ fileType: 'pdf' })}
                  block
                  icon={<PlusOutlined />}
                >
                  {t('scientificDepartment.conferences.addInfo')}
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      <Modal centered
        title={t('scientificDepartment.conferences.acceptTitle')}
        open={!!acceptTarget}
        onCancel={closeAccept}
        onOk={handleAccept}
        okText={t('scientificDepartment.conferences.acceptAndSend')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={acceptConference.isPending}
        width={560}
      >
        {acceptTarget ? (
          <>
            <div
              style={{
                background: 'var(--brand-primary-soft)',
                border: '1px solid color-mix(in srgb, var(--brand-primary) 30%, #fff)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                marginBottom: 16,
              }}
            >
              <div style={{ color: 'var(--color-text-mute)', fontSize: 12 }}>
                {t('scientificDepartment.conferences.colTitle')}:
              </div>
              <div style={{ fontWeight: 600, marginTop: 4, color: 'var(--brand-primary)' }}>
                {acceptTarget.title}
              </div>
            </div>
            <FileUploadGrid
              slots={acceptSlots}
              value={slotFiles}
              onChange={(next) => setSlotFiles(next as Record<string, File | undefined>)}
            />
          </>
        ) : null}
      </Modal>
    </PageContainer>
  );
}
