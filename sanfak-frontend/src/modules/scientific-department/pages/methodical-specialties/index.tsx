import { useState } from 'react';
import { App, Button, Form, Input, Tooltip } from 'antd';
import Modal from '../../components/scroll-modal';
import { DeleteOutlined, EditOutlined, PlusOutlined, ToolOutlined } from '@ant-design/icons';
import { type ColumnDef } from '@tanstack/react-table';
import { PageContainer, DataTable, Filters, Flex } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import {
  useCreateMethodicalSpecialty,
  useDeleteMethodicalSpecialty,
  useMethodicalSpecialtiesPaginate,
  useUpdateMethodicalSpecialty,
} from '../../api/methodical-specialty-api';
import TableGap from '../../components/table-gap';
import { useConfirm } from '../../lib/use-confirm';
import type { MethodicalSpecialty } from '../../model/types';

interface FormValues {
  code: string;
  name: string;
}

export default function MethodicalSpecialtiesPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { confirmDelete } = useConfirm();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MethodicalSpecialty | null>(null);
  const [form] = Form.useForm<FormValues>();

  const { data, isFetching } = useMethodicalSpecialtiesPaginate(page, pageSize, search);
  const rows = data?.docs ?? [];
  const createSpecialty = useCreateMethodicalSpecialty();
  const updateSpecialty = useUpdateMethodicalSpecialty();
  const deleteSpecialty = useDeleteMethodicalSpecialty();

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (s: MethodicalSpecialty) => {
    setEditing(s);
    form.setFieldsValue({ code: s.code, name: s.name });
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
        await updateSpecialty.mutateAsync({ id: editing.id, ...values });
        message.success(t('scientificDepartment.methodicalSpecialties.updated'));
      } else {
        await createSpecialty.mutateAsync(values);
        message.success(t('scientificDepartment.methodicalSpecialties.created'));
      }
      closeModal();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSpecialty.mutateAsync(id);
      message.success(t('scientificDepartment.methodicalSpecialties.deleted'));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const columns: ColumnDef<MethodicalSpecialty, unknown>[] = [
    {
      id: 'idx',
      header: '№',
      size: 60,
      cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
    },
    {
      id: 'code',
      header: t('scientificDepartment.methodicalSpecialties.code'),
      size: 180,
      cell: ({ row }) => <strong>{row.original.code}</strong>,
    },
    {
      id: 'name',
      header: t('scientificDepartment.methodicalSpecialties.name'),
      cell: ({ row }) => row.original.name,
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
                  title: 'scientificDepartment.methodicalSpecialties.deleteConfirm',
                  content: 'scientificDepartment.methodicalSpecialties.deleteDesc',
                })
              }
            />
          </Tooltip>
        </Flex>
      ),
    },
  ];

  return (
    <PageContainer title={t('scientificDepartment.methodicalSpecialties.title')}>
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
        <span>{t('scientificDepartment.methodicalSpecialties.hint')}</span>
      </div>

      <Filters
        searchPlaceholder="scientificDepartment.methodicalSpecialties.searchPlaceholder"
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd} style={{ height: 40 }}>
            {t('scientificDepartment.methodicalSpecialties.add')}
          </Button>
        }
      />

      <TableGap>
        <DataTable<MethodicalSpecialty>
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
            ? t('scientificDepartment.methodicalSpecialties.editTitle')
            : t('scientificDepartment.methodicalSpecialties.addTitle')
        }
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        okText={editing ? t('scientificDepartment.update') : t('scientificDepartment.save')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={createSpecialty.isPending || updateSpecialty.isPending}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            label={t('scientificDepartment.methodicalSpecialties.code')}
            name="code"
            rules={[{ required: true, message: t('scientificDepartment.required') }]}
          >
            <Input placeholder={t('scientificDepartment.methodicalSpecialties.codePlaceholder')} />
          </Form.Item>
          <Form.Item
            label={t('scientificDepartment.methodicalSpecialties.name')}
            name="name"
            rules={[{ required: true, message: t('scientificDepartment.required') }]}
          >
            <Input placeholder={t('scientificDepartment.methodicalSpecialties.namePlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}
