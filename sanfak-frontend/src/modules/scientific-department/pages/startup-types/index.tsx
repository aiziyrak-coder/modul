import { useState } from 'react';
import { App, Button, Form, Input, Tooltip } from 'antd';
import Modal from '../../components/scroll-modal';
import { DeleteOutlined, EditOutlined, PlusOutlined, ToolOutlined } from '@ant-design/icons';
import { type ColumnDef } from '@tanstack/react-table';
import { PageContainer, DataTable, Filters, Flex } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import {
  useCreateStartupType,
  useDeleteStartupType,
  useStartupTypesPaginate,
  useUpdateStartupType,
} from '../../api/startup-type-api';
import TableGap from '../../components/table-gap';
import { useConfirm } from '../../lib/use-confirm';
import type { StartupType } from '../../model/types';

interface FormValues {
  name: string;
}

export default function StartupTypesPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { confirmDelete } = useConfirm();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StartupType | null>(null);
  const [form] = Form.useForm<FormValues>();

  const { data, isFetching } = useStartupTypesPaginate(page, pageSize, search);
  const rows = data?.docs ?? [];
  const createType = useCreateStartupType();
  const updateType = useUpdateStartupType();
  const deleteType = useDeleteStartupType();

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (s: StartupType) => {
    setEditing(s);
    form.setFieldsValue({ name: s.name });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const handleSave = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    try {
      if (editing) {
        await updateType.mutateAsync({ id: editing.id, ...values });
        message.success(t('scientificDepartment.startupTypes.updated'));
      } else {
        await createType.mutateAsync(values);
        message.success(t('scientificDepartment.startupTypes.created'));
      }
      closeModal();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteType.mutateAsync(id);
      message.success(t('scientificDepartment.startupTypes.deleted'));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const columns: ColumnDef<StartupType, unknown>[] = [
    {
      id: 'idx',
      header: '№',
      size: 60,
      cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
    },
    {
      id: 'name',
      header: t('scientificDepartment.startupTypes.name'),
      cell: ({ row }) => <strong>{row.original.name}</strong>,
    },
    {
      id: 'actions',
      header: t('scientificDepartment.actions'),
      size: 110,
      meta: { align: 'center' as const },
      cell: ({ row }) => (
        <Flex align="center" justify="center" gap={8}>
          <Tooltip title={t('scientificDepartment.edit')}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined style={{ fontSize: 18, color: 'var(--brand-info)' }} />}
              onClick={() => openEdit(row.original)}
            />
          </Tooltip>
          <Tooltip title={t('scientificDepartment.delete')}>
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined style={{ fontSize: 18, color: 'var(--brand-error)' }} />}
              onClick={() =>
                confirmDelete(() => handleDelete(row.original.id), {
                  title: 'scientificDepartment.startupTypes.deleteConfirm',
                  content: 'scientificDepartment.startupTypes.deleteDesc',
                })
              }
            />
          </Tooltip>
        </Flex>
      ),
    },
  ];

  return (
    <PageContainer title={t('scientificDepartment.startupTypes.title')}>
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
        <ToolOutlined style={{ fontSize: 18 }} />
        <span>{t('scientificDepartment.startupTypes.hint')}</span>
      </div>

      <Filters
        searchPlaceholder="scientificDepartment.startupTypes.searchPlaceholder"
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd} style={{ height: 40 }}>
            {t('scientificDepartment.startupTypes.add')}
          </Button>
        }
      />

      <TableGap>
        <DataTable<StartupType>
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
        />
      </TableGap>

      <Modal
        centered
        title={
          editing
            ? t('scientificDepartment.startupTypes.editTitle')
            : t('scientificDepartment.startupTypes.addTitle')
        }
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        okText={editing ? t('scientificDepartment.update') : t('scientificDepartment.save')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={createType.isPending || updateType.isPending}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            label={t('scientificDepartment.startupTypes.name')}
            name="name"
            rules={[{ required: true, message: t('scientificDepartment.required') }]}
          >
            <Input placeholder={t('scientificDepartment.startupTypes.namePlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}
