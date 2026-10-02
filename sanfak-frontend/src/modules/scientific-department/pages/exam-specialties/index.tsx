import { useState } from 'react';
import { App, Button, DatePicker, Form, Input, Switch, Tag, Tooltip } from 'antd';
import Modal from '../../components/scroll-modal';
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { type ColumnDef } from '@tanstack/react-table';
import { PageContainer, DataTable, Filters, Flex } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import {
  useCreateSpecialty,
  useDeleteSpecialty,
  useSpecialtiesPaginate,
  useUpdateSpecialty,
} from '../../api/exam-specialty-api';
import TableGap from '../../components/table-gap';
import { useConfirm } from '../../lib/use-confirm';
import {
  EXAM_SPECIALTY_STATUSES,
  type ExamSpecialty,
  type ExamSpecialtyStatus,
} from '../../model/types';

interface FormValues {
  code: string;
  name?: string;
  statusOpen: boolean;
  period: [dayjs.Dayjs, dayjs.Dayjs];
}

export default function ExamSpecialtiesPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { confirmDelete } = useConfirm();
  const [statusFilter, setStatusFilter] = useState<ExamSpecialtyStatus | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExamSpecialty | null>(null);
  const [form] = Form.useForm<FormValues>();

  const { data, isFetching } = useSpecialtiesPaginate(page, pageSize, {
    status: statusFilter,
  });
  const specialties = data?.docs ?? [];
  const createSpecialty = useCreateSpecialty();
  const updateSpecialty = useUpdateSpecialty();
  const deleteSpecialty = useDeleteSpecialty();

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ statusOpen: true });
    setModalOpen(true);
  };

  const openEdit = (s: ExamSpecialty) => {
    setEditing(s);
    form.setFieldsValue({
      code: s.code,
      name: s.name,
      statusOpen: s.status === 'open',
      period:
        s.regStart && s.regEnd
          ? [dayjs(s.regStart), dayjs(s.regEnd)]
          : (undefined as unknown as [dayjs.Dayjs, dayjs.Dayjs]),
    });
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
    const payload = {
      code: values.code,
      name: values.name ?? '',
      status: (values.statusOpen ? 'open' : 'closed') as ExamSpecialtyStatus,
      regStart: values.period[0].format('YYYY-MM-DD'),
      regEnd: values.period[1].format('YYYY-MM-DD'),
    };
    try {
      if (editing) {
        await updateSpecialty.mutateAsync({ id: editing.id, ...payload });
        message.success(t('scientificDepartment.specialties.updated'));
      } else {
        await createSpecialty.mutateAsync(payload);
        message.success(t('scientificDepartment.specialties.created'));
      }
      closeModal();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const toggleStatus = async (s: ExamSpecialty, open: boolean) => {
    try {
      await updateSpecialty.mutateAsync({ id: s.id, status: open ? 'open' : 'closed' });
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSpecialty.mutateAsync(id);
      message.success(t('scientificDepartment.specialties.deleted'));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const columns: ColumnDef<ExamSpecialty, unknown>[] = [
    {
      id: 'idx',
      header: '№',
      size: 60,
      cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
    },
    {
      id: 'code',
      header: t('scientificDepartment.specialties.code'),
      size: 160,
      cell: ({ row }) => <strong>{row.original.code}</strong>,
    },
    {
      id: 'name',
      header: t('scientificDepartment.specialties.name'),
      cell: ({ row }) => row.original.name || '—',
    },
    {
      id: 'period',
      header: t('scientificDepartment.specialties.period'),
      size: 220,
      cell: ({ row }) =>
        row.original.regStart && row.original.regEnd
          ? `${row.original.regStart} — ${row.original.regEnd}`
          : '—',
    },
    {
      id: 'status',
      header: t('scientificDepartment.specialties.status'),
      size: 130,
      meta: { align: 'center' as const },
      cell: ({ row }) => {
        const eff = row.original.effectiveStatus;
        if (eff === 'expired' || eff === 'upcoming') {
          return (
            <Tooltip
              title={t('scientificDepartment.specialties.editPeriodHint')}
            >
              <Tag color={eff === 'expired' ? 'error' : 'warning'} style={{ margin: 0 }}>
                {t(`scientificDepartment.specialties.${eff}`)}
              </Tag>
            </Tooltip>
          );
        }
        return (
          <Switch
            checked={row.original.status === 'open'}
            onChange={(v) => toggleStatus(row.original, v)}
            checkedChildren={t('scientificDepartment.specialties.open')}
            unCheckedChildren={t('scientificDepartment.specialties.closed')}
          />
        );
      },
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
                  title: 'scientificDepartment.specialties.deleteConfirm',
                  content: 'scientificDepartment.specialties.deleteDesc',
                })
              }
            />
          </Tooltip>
        </Flex>
      ),
    },
  ];

  return (
    <PageContainer title={t('scientificDepartment.specialties.title')}>
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
        <span>{t('scientificDepartment.specialties.hint')}</span>
      </div>

      <Filters
        hideSearch
        onSearch={() => undefined}
        selects={[
          {
            key: 'status',
            placeholder: 'scientificDepartment.specialties.allStatuses',
            value: statusFilter,
            options: EXAM_SPECIALTY_STATUSES.map((s) => ({
              value: s,
              label: t(`scientificDepartment.specialties.${s}`),
            })),
            onChange: (v) => {
              setStatusFilter(v as ExamSpecialtyStatus | undefined);
              setPage(1);
            },
          },
        ]}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd} style={{ height: 40 }}>
            {t('scientificDepartment.specialties.add')}
          </Button>
        }
      />

      <TableGap>
        <DataTable<ExamSpecialty>
          data={specialties}
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
            ? t('scientificDepartment.specialties.editTitle')
            : t('scientificDepartment.specialties.addTitle')
        }
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        okText={editing ? t('scientificDepartment.update') : t('scientificDepartment.save')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={createSpecialty.isPending || updateSpecialty.isPending}
        width={520}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label={t('scientificDepartment.specialties.code')}
            name="code"
            rules={[{ required: true, message: t('scientificDepartment.required') }]}
          >
            <Input placeholder={t('scientificDepartment.specialties.codePlaceholder')} />
          </Form.Item>
          <Form.Item
            label={t('scientificDepartment.specialties.statusField')}
            name="statusOpen"
            valuePropName="checked"
          >
            <Switch
              checkedChildren={t('scientificDepartment.specialties.open')}
              unCheckedChildren={t('scientificDepartment.specialties.closed')}
            />
          </Form.Item>
          <Form.Item label={t('scientificDepartment.specialties.name')} name="name">
            <Input placeholder={t('scientificDepartment.specialties.namePlaceholder')} />
          </Form.Item>
          <Form.Item
            label={t('scientificDepartment.specialties.period')}
            name="period"
            rules={[{ required: true, message: t('scientificDepartment.required') }]}
          >
            <DatePicker.RangePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}
