import { useState } from 'react';
import { App, Button, Form, Input, Select, Tooltip } from 'antd';
import Modal from '../../components/scroll-modal';
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { type ColumnDef } from '@tanstack/react-table';
import { PageContainer, DataTable, Filters, Flex } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import {
  useCreateJournal,
  useDeleteJournal,
  useJournalsPaginate,
  useUpdateJournal,
} from '../../api/journal-api';
import TypeTag from '../../components/type-tag';
import TableGap from '../../components/table-gap';
import { useConfirm } from '../../lib/use-confirm';
import { JOURNAL_TYPES, type Journal, type JournalType } from '../../model/types';

export default function JournalsPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { confirmDelete } = useConfirm();
  const [typeFilter, setTypeFilter] = useState<JournalType | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Journal | null>(null);
  const [form] = Form.useForm<{ name: string; type: JournalType }>();

  const { data, isFetching } = useJournalsPaginate(page, pageSize, typeFilter);
  const journals = data?.docs ?? [];
  const createJournal = useCreateJournal();
  const updateJournal = useUpdateJournal();
  const deleteJournal = useDeleteJournal();

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (j: Journal) => {
    setEditing(j);
    form.setFieldsValue({ name: j.name, type: j.type });
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
        await updateJournal.mutateAsync({ id: editing.id, ...values });
        message.success(t('scientificDepartment.journals.updated'));
      } else {
        await createJournal.mutateAsync(values);
        message.success(t('scientificDepartment.journals.created'));
      }
      closeModal();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteJournal.mutateAsync(id);
      message.success(t('scientificDepartment.journals.deleted'));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const columns: ColumnDef<Journal, unknown>[] = [
    {
      id: 'idx',
      header: '№',
      size: 60,
      cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
    },
    {
      id: 'name',
      header: t('scientificDepartment.journals.name'),
      cell: ({ row }) => <strong>{row.original.name}</strong>,
    },
    {
      id: 'type',
      header: t('scientificDepartment.journals.type'),
      size: 180,
      cell: ({ row }) => <TypeTag type={row.original.type} />,
    },
    {
      id: 'addedDate',
      header: t('scientificDepartment.journals.addedDate'),
      size: 160,
      accessorKey: 'addedDate',
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
                  title: 'scientificDepartment.journals.deleteConfirm',
                  content: 'scientificDepartment.journals.deleteDesc',
                })
              }
            />
          </Tooltip>
        </Flex>
      ),
    },
  ];

  return (
    <PageContainer title={t('scientificDepartment.journals.title')}>
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
        <SafetyCertificateOutlined style={{ fontSize: 18 }} />
        <span>{t('scientificDepartment.journals.hint')}</span>
      </div>

      <Filters
        hideSearch
        onSearch={() => undefined}
        selects={[
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
        ]}
        extra={
          <Flex align="center" gap={12}>
            <span style={{ color: 'var(--color-text-mute)', fontSize: 13 }}>
              {t('scientificDepartment.journals.total', { n: data?.totalDocs ?? 0 })}
            </span>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openAdd}
              style={{ height: 40 }}
            >
              {t('scientificDepartment.journals.add')}
            </Button>
          </Flex>
        }
      />

      <TableGap>
        <DataTable<Journal>
          data={journals}
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
            ? t('scientificDepartment.journals.editTitle')
            : t('scientificDepartment.journals.addTitle')
        }
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        okText={
          editing ? t('scientificDepartment.update') : t('scientificDepartment.save')
        }
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={createJournal.isPending || updateJournal.isPending}
        width={520}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label={t('scientificDepartment.journals.name')}
            name="name"
            rules={[{ required: true, message: t('scientificDepartment.required') }]}
          >
            <Input placeholder={t('scientificDepartment.journals.namePlaceholder')} />
          </Form.Item>
          <Form.Item
            label={t('scientificDepartment.journals.type')}
            name="type"
            rules={[{ required: true, message: t('scientificDepartment.required') }]}
          >
            <Select
              placeholder={t('scientificDepartment.journals.typePlaceholder')}
              options={JOURNAL_TYPES.map((v) => ({
                value: v,
                label: t(`scientificDepartment.type.${v}`),
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}
