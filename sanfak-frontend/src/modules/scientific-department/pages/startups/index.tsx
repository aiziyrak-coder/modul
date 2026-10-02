import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Form, Input, Select, Tooltip } from 'antd';
import Modal from '../../components/scroll-modal';
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FileExcelOutlined,
  PlusOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { type ColumnDef } from '@tanstack/react-table';
import { PageContainer, DataTable, Filters, Flex } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import { usePermission } from '@/app/session';
import {
  fetchStartupsForExport,
  useCreateStartup,
  useDeleteStartup,
  useStartupsPaginate,
  useUpdateStartup,
} from '../../api/startup-api';
import { exportToExcel } from '../../lib/excel';
import { useActiveStartupTypes } from '../../api/startup-type-api';
import FileUploadGrid from '../../components/file-upload-grid';
import FileTypeIcon from '../../components/file-type-icon';
import TableGap from '../../components/table-gap';
import { useConfirm } from '../../lib/use-confirm';
import { STARTUP_FILE_SLOTS, type Startup, type StartupFileSlot } from '../../model/types';

interface FormValues {
  type: string;
  title: string;
}

export default function StartupsPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { confirmDelete } = useConfirm();
  const can = usePermission();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Startup | null>(null);
  const [files, setFiles] = useState<Partial<Record<string, File>>>({});
  const [exporting, setExporting] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const canCreate = can('startup:create');
  const canExport = can('startup:export');
  const { data, isFetching } = useStartupsPaginate(page, pageSize, {
    search,
    type: typeFilter,
  });
  const { data: types = [] } = useActiveStartupTypes(can('startupType:readAll'));
  const rows = data?.docs ?? [];

  const createStartup = useCreateStartup();
  const updateStartup = useUpdateStartup();
  const deleteStartup = useDeleteStartup();

  const openAdd = () => {
    setEditing(null);
    setFiles({});
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (s: Startup) => {
    setEditing(s);
    setFiles({});
    form.setFieldsValue({ type: s.typeId ?? undefined, title: s.title });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setFiles({});
    form.resetFields();
  };

  const handleSave = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;

    if (!editing) {
      const missing = STARTUP_FILE_SLOTS.filter((s) => !files[s.slot]);
      if (missing.length) {
        message.error(t('scientificDepartment.startups.filesRequired'));
        return;
      }
    }

    try {
      const payload = {
        type: values.type,
        title: values.title,
        files: files as Partial<Record<StartupFileSlot, File>>,
      };
      if (editing) {
        await updateStartup.mutateAsync({ id: editing.id, ...payload });
        message.success(t('scientificDepartment.startups.updated'));
      } else {
        await createStartup.mutateAsync(payload);
        message.success(t('scientificDepartment.startups.created'));
      }
      closeModal();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await fetchStartupsForExport({ search, type: typeFilter });
      if (!rows.length) {
        message.info(t('scientificDepartment.reports.exportEmpty'));
        return;
      }
      const data = rows.map((s, i) => ({
        '№': i + 1,
        [t('scientificDepartment.startups.colAuthor')]: s.authorName || '',
        [t('scientificDepartment.startups.colType')]: s.typeName || '',
        [t('scientificDepartment.startups.colTitle')]: s.title || '',
        [t('scientificDepartment.articles.colFaculty')]: s.facultyName || '',
        [t('scientificDepartment.articles.colDepartment')]: s.departmentName || '',
        [t('scientificDepartment.articles.colDate')]: s.date || '',
      }));
      const title = t('scientificDepartment.startups.title');
      exportToExcel(data, `${title}-${dayjs().format('YYYY-MM-DD')}`, title);
      message.success(t('scientificDepartment.reports.exportDone', { n: data.length }));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteStartup.mutateAsync(id);
      message.success(t('scientificDepartment.startups.deleted'));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const columns: ColumnDef<Startup, unknown>[] = [
    {
      id: 'idx',
      header: '№',
      size: 55,
      meta: { align: 'center' as const },
      cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
    },
    {
      id: 'authorName',
      header: t('scientificDepartment.startups.colAuthor'),
      size: 190,
      cell: ({ row }) => <strong>{row.original.authorName || '—'}</strong>,
    },
    {
      id: 'typeName',
      header: t('scientificDepartment.startups.colType'),
      size: 160,
      cell: ({ row }) => row.original.typeName || '—',
    },
    {
      id: 'title',
      header: t('scientificDepartment.startups.colTitle'),
      cell: ({ row }) => row.original.title,
    },
    {
      id: 'files',
      header: t('scientificDepartment.startups.colFiles'),
      size: 150,
      meta: { align: 'center' as const },
      cell: ({ row }) => (
        <Flex align="center" justify="center" gap={2} onClick={(e) => e.stopPropagation()}>
          {STARTUP_FILE_SLOTS.map((s) => {
            const url = row.original.files[s.slot as StartupFileSlot];
            if (!url) return null;
            return (
              <Tooltip key={s.slot} title={t(`scientificDepartment.${s.labelKey}`)}>
                <Button
                  type="text"
                  size="small"
                  aria-label={t(`scientificDepartment.${s.labelKey}`)}
                  icon={<FileTypeIcon name={url} size={17} />}
                  onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                />
              </Tooltip>
            );
          })}
        </Flex>
      ),
    },
    {
      id: 'facultyName',
      header: t('scientificDepartment.articles.colFaculty'),
      size: 150,
      cell: ({ row }) => row.original.facultyName || '—',
    },
    {
      id: 'date',
      header: t('scientificDepartment.articles.colDate'),
      size: 110,
      cell: ({ row }) => row.original.date || '—',
    },
  ];

  columns.push({
    id: 'actions',
    header: t('scientificDepartment.actions'),
    size: canCreate ? 140 : 90,
    meta: { align: 'center' as const },
    cell: ({ row }) => (
      <Flex align="center" justify="center" gap={8} onClick={(e) => e.stopPropagation()}>
        {canCreate ? (
          <>
            <Tooltip title={t('scientificDepartment.edit')}>
              <Button
                type="text"
                size="small"
                aria-label={t('scientificDepartment.edit')}
                icon={<EditOutlined style={{ fontSize: 18, color: 'var(--brand-info)' }} />}
                onClick={() => openEdit(row.original)}
              />
            </Tooltip>
            <Tooltip title={t('scientificDepartment.delete')}>
              <Button
                type="text"
                size="small"
                aria-label={t('scientificDepartment.delete')}
                icon={<DeleteOutlined style={{ fontSize: 18, color: 'var(--brand-error)' }} />}
                onClick={() =>
                  confirmDelete(() => handleDelete(row.original.id), {
                    title: 'scientificDepartment.startups.deleteConfirm',
                    content: 'scientificDepartment.startups.deleteDesc',
                  })
                }
              />
            </Tooltip>
          </>
        ) : null}
        <Tooltip title={t('scientificDepartment.view')}>
          <Button
            type="text"
            size="small"
            aria-label={t('scientificDepartment.view')}
            icon={<EyeOutlined style={{ fontSize: 18, color: 'var(--color-text-mute)' }} />}
            onClick={() => navigate(`/scientific-department/startups/${row.original.id}`)}
          />
        </Tooltip>
      </Flex>
    ),
  });

  return (
    <PageContainer title={t('scientificDepartment.startups.title')}>
      <div
        style={{
          background: 'var(--brand-primary-soft)',
          border: '1px solid color-mix(in srgb, var(--brand-primary) 30%, #fff)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          marginBottom: 16,
          fontSize: 13,
          color: 'var(--brand-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <RocketOutlined style={{ fontSize: 18 }} />
        <span>
          {canCreate
            ? t('scientificDepartment.startups.hintTeacher')
            : t('scientificDepartment.startups.hintViewer')}
        </span>
      </div>

      <Filters
        searchPlaceholder="scientificDepartment.startups.searchPlaceholder"
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        extra={
          <Flex align="center" gap={10} wrap>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              value={typeFilter}
              onChange={(v) => {
                setTypeFilter(v);
                setPage(1);
              }}
              placeholder={t('scientificDepartment.startups.allTypes')}
              options={types.map((x) => ({ value: x.id, label: x.name }))}
              style={{ minWidth: 220, height: 40 }}
            />
            {canExport ? (
              <Button
                icon={<FileExcelOutlined />}
                loading={exporting}
                onClick={handleExport}
                style={{
                  height: 40,
                  background: 'var(--brand-primary)',
                  borderColor: 'var(--brand-primary)',
                  color: '#fff',
                }}
              >
                {t('scientificDepartment.reports.exportExcel')}
              </Button>
            ) : null}
            {canCreate ? (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openAdd}
                style={{ height: 40 }}
              >
                {t('scientificDepartment.startups.add')}
              </Button>
            ) : null}
          </Flex>
        }
      />

      <TableGap>
        <DataTable<Startup>
          data={rows}
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
          onRowClick={(row) => navigate(`/scientific-department/startups/${row.id}`)}
        />
      </TableGap>

      <Modal
        centered
        width={720}
        title={
          editing
            ? t('scientificDepartment.startups.editTitle')
            : t('scientificDepartment.startups.addTitle')
        }
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        okText={editing ? t('scientificDepartment.update') : t('scientificDepartment.save')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={createStartup.isPending || updateStartup.isPending}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            label={t('scientificDepartment.startups.colType')}
            name="type"
            rules={[{ required: true, message: t('scientificDepartment.required') }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder={t('scientificDepartment.startups.typePlaceholder')}
              options={types.map((x) => ({ value: x.id, label: x.name }))}
            />
          </Form.Item>
          <Form.Item
            label={t('scientificDepartment.startups.colTitle')}
            name="title"
            rules={[{ required: true, message: t('scientificDepartment.required') }]}
          >
            <Input placeholder={t('scientificDepartment.startups.titlePlaceholder')} />
          </Form.Item>

          <FileUploadGrid
            slots={STARTUP_FILE_SLOTS}
            value={files}
            onChange={setFiles}
            existingFiles={editing?.files}
          />
        </Form>
      </Modal>
    </PageContainer>
  );
}
