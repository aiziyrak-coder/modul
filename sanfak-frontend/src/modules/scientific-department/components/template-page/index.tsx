import { useState } from 'react';
import { App, Button, Form, Input, Space, Tooltip, Upload } from 'antd';
import Modal from '../scroll-modal';
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { type ColumnDef } from '@tanstack/react-table';
import { PageContainer, DataTable, Flex } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import FileTypeIcon from '../file-type-icon';
import { getApiErrorMessage } from '@/shared/api';
import {
  useCreateTemplate,
  useDeleteTemplate,
  useTemplatesPaginate,
  useUpdateTemplate,
} from '../../api/template-api';
import TableGap from '../table-gap';
import { useConfirm } from '../../lib/use-confirm';
import type { ScientificTemplate, TemplateCategory } from '../../model/types';

interface FormValues {
  name: string;
  description?: string;
  file?: UploadFile[];
}

const normFile = (e: UploadFile[] | { fileList: UploadFile[] }): UploadFile[] =>
  Array.isArray(e) ? e : e?.fileList;

export default function TemplatePage({
  category,
  titleKey,
  hintKey,
}: {
  category: TemplateCategory;
  titleKey: string;
  hintKey: string;
}) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { confirmDelete } = useConfirm();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ScientificTemplate | null>(null);
  const [form] = Form.useForm<FormValues>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, isFetching } = useTemplatesPaginate(page, pageSize, category);
  const templates = data?.docs ?? [];
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setFormOpen(true);
  };

  const openEdit = (tpl: ScientificTemplate) => {
    setEditing(tpl);
    setFormOpen(true);
    form.setFieldsValue({
      name: tpl.name,
      description: tpl.description,
      file: tpl.fileName
        ? [{ uid: 'existing', name: tpl.fileName, status: 'done' as const }]
        : undefined,
    });
  };

  const handleSubmit = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    const rawFile = values.file?.[0]?.originFileObj as File | undefined;
    if (!editing && !rawFile) {
      message.error(t('scientificDepartment.templates.fileRequired'));
      return;
    }
    try {
      if (editing) {
        await updateTemplate.mutateAsync({
          id: editing.id,
          name: values.name,
          description: values.description ?? '',
          category,
          file: rawFile ?? null,
        });
        message.success(t('scientificDepartment.templates.updated'));
      } else {
        await createTemplate.mutateAsync({
          name: values.name,
          description: values.description ?? '',
          category,
          file: rawFile,
        });
        message.success(t('scientificDepartment.templates.created'));
      }
      setFormOpen(false);
      setEditing(null);
      form.resetFields();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleDelete = async (tpl: ScientificTemplate) => {
    try {
      await deleteTemplate.mutateAsync(tpl.id);
      message.success(t('scientificDepartment.templates.deleted'));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const columns: ColumnDef<ScientificTemplate, unknown>[] = [
    {
      id: 'idx',
      header: '№',
      size: 60,
      cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
    },
    {
      id: 'name',
      header: t('scientificDepartment.templates.name'),
      cell: ({ row }) => (
        <div style={{ lineHeight: 1.4 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{row.original.name}</div>
          {row.original.description ? (
            <div style={{ fontSize: 12, color: 'var(--color-text-mute)', marginTop: 2 }}>
              {row.original.description}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: 'file',
      header: t('scientificDepartment.templates.file'),
      size: 280,
      cell: ({ row }) => (
        <Flex align="center" gap={8}>
          <FileTypeIcon name={row.original.fileName} size={18} />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 12.5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.original.fileName || '—'}
            </div>
            {row.original.fileSize ? (
              <div style={{ fontSize: 11.5, color: 'var(--color-text-mute)' }}>
                {row.original.fileSize}
              </div>
            ) : null}
          </div>
        </Flex>
      ),
    },
    {
      id: 'updatedDate',
      header: t('scientificDepartment.templates.updatedCol'),
      size: 140,
      accessorKey: 'updatedDate',
    },
    {
      id: 'actions',
      header: t('scientificDepartment.actions'),
      size: 150,
      meta: { align: 'center' as const },
      cell: ({ row }) => (
        <Space size={4}>
          <Tooltip title={t('scientificDepartment.templates.download')}>
            <Button
              type="text"
              size="small"
              icon={
                <DownloadOutlined style={{ fontSize: 17, color: 'var(--brand-primary)' }} />
              }
              onClick={() =>
                window.open(row.original.fileUrl, '_blank', 'noopener,noreferrer')
              }
            />
          </Tooltip>
          <Tooltip title={t('scientificDepartment.edit')}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined style={{ fontSize: 17, color: 'var(--brand-info)' }} />}
              onClick={() => openEdit(row.original)}
            />
          </Tooltip>
          <Tooltip title={t('scientificDepartment.delete')}>
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined style={{ fontSize: 17, color: 'var(--brand-error)' }} />}
              onClick={() =>
                confirmDelete(() => handleDelete(row.original), {
                  title: 'scientificDepartment.templates.deleteConfirm',
                  content: 'scientificDepartment.journals.deleteDesc',
                })
              }
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer title={t(titleKey)}>
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
        {t(hintKey)}
      </div>

      <Flex align="center" gap={12} style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 12.5, color: 'var(--color-text-mute)' }}>
          {t('scientificDepartment.templates.total', { n: data?.totalDocs ?? 0 })}
        </span>
        <div style={{ flex: 1 }} />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openAdd}
          style={{ height: 40 }}
        >
          {t('scientificDepartment.templates.add')}
        </Button>
      </Flex>

      <TableGap>
        <DataTable<ScientificTemplate>
          data={templates}
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

      <Modal centered
        title={
          editing
            ? t('scientificDepartment.templates.editTitle')
            : t('scientificDepartment.templates.addTitle')
        }
        open={formOpen}
        onCancel={() => {
          setFormOpen(false);
          setEditing(null);
          form.resetFields();
        }}
        onOk={handleSubmit}
        okText={editing ? t('scientificDepartment.update') : t('scientificDepartment.save')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={createTemplate.isPending || updateTemplate.isPending}
        width={560}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label={t('scientificDepartment.templates.name')}
            name="name"
            rules={[{ required: true, message: t('scientificDepartment.required') }]}
          >
            <Input placeholder={t('scientificDepartment.templates.namePlaceholder')} />
          </Form.Item>
          <Form.Item label={t('scientificDepartment.templates.description')} name="description">
            <Input.TextArea rows={2} placeholder={t('scientificDepartment.templates.descriptionPlaceholder')} />
          </Form.Item>
          <Form.Item
            label={t('scientificDepartment.templates.file')}
            name="file"
            valuePropName="fileList"
            getValueFromEvent={normFile}
            extra={t('scientificDepartment.templates.fileHint')}
            rules={
              editing ? [] : [{ required: true, message: t('scientificDepartment.required') }]
            }
          >
            <Upload beforeUpload={() => false} maxCount={1} accept=".docx,.doc,.pdf">
              <Button icon={<UploadOutlined />}>
                {t('scientificDepartment.chooseFile')}
              </Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}
