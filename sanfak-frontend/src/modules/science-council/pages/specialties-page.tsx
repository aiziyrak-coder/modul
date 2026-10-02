import { useCallback, useMemo, useState } from 'react';
import {
  Table, Button, Input, Form, Modal, Switch, Tooltip, Popconfirm, Tag, App as AntApp,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import type { CouncilSpecialty, SpecialtyInput } from '../model/types';
import {
  useSpecialties,
  useCreateSpecialty,
  useUpdateSpecialty,
  useDeleteSpecialty,
} from '../api/science-council-api';
import { apiMessage } from '../lib/api-error';
import { ExportButton } from '../components/export-button';
import { downloadExcel, datedFileName, type ExcelRow } from '../lib/excel';
import { Card, ToolBar } from '../components/settings-styles';
import { TablePagination } from '../components/table-pagination';

interface FormValues {
  title: string;
  code: string;
  branch: string;
  active: boolean;
}

export default function SpecialtiesPage() {
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm<FormValues>();

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<CouncilSpecialty | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: rows = [], isLoading } = useSpecialties({ all: true, search: search || undefined });
  const createMut = useCreateSpecialty();
  const updateMut = useUpdateSpecialty();
  const deleteMut = useDeleteSpecialty();

  const openCreate = useCallback(() => {
    form.resetFields();
    form.setFieldsValue({ active: true });
    setEditing(null);
    setCreating(true);
  }, [form]);

  const openEdit = useCallback(
    (row: CouncilSpecialty) => {
      setCreating(false);
      setEditing(row);
      form.setFieldsValue({
        title: row.title,
        code: row.code,
        branch: row.branch ?? '',
        active: row.active,
      });
    },
    [form],
  );

  const close = useCallback(() => {
    setEditing(null);
    setCreating(false);
    form.resetFields();
  }, [form]);

  const handleSave = useCallback(async () => {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const body: SpecialtyInput = {
      title: values.title.trim(),
      code: values.code.trim(),
      branch: values.branch.trim(),
      active: values.active,
    };
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, body });
        message.success(t('scienceCouncil.settings.saved'));
      } else {
        await createMut.mutateAsync(body);
        message.success(t('scienceCouncil.settings.added'));
      }
      close();
    } catch (err) {
      message.error(apiMessage(err, t('scienceCouncil.settings.saveFailed')));
    }
  }, [form, editing, updateMut, createMut, message, t, close]);

  const toggleActive = useCallback(
    async (row: CouncilSpecialty, active: boolean) => {
      try {
        await updateMut.mutateAsync({ id: row.id, body: { active } });
      } catch (err) {
        message.error(apiMessage(err, t('scienceCouncil.settings.saveFailed')));
      }
    },
    [updateMut, message, t],
  );

  const handleDelete = useCallback(
    async (row: CouncilSpecialty) => {
      try {
        await deleteMut.mutateAsync(row.id);
        message.success(t('scienceCouncil.settings.deleted'));
      } catch (err) {
        message.error(apiMessage(err, t('scienceCouncil.settings.deleteFailed')));
      }
    },
    [deleteMut, message, t],
  );

  const exportRows = () => {
    const excelRows: ExcelRow[] = rows.map((r, i) => ({
      '#': i + 1,
      [t('scienceCouncil.settings.specialtyTitle')]: r.title,
      [t('scienceCouncil.settings.specialtyCode')]: r.code,
      [t('scienceCouncil.settings.branch')]: r.branch ?? '—',
      [t('scienceCouncil.settings.status')]: r.active
        ? t('scienceCouncil.settings.active')
        : t('scienceCouncil.settings.inactive'),
    }));
    downloadExcel(excelRows, datedFileName('Ixtisosliklar'), t('scienceCouncil.nav.specialties'),
      [5, 55, 16, 30, 12]);
  };

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const pageRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize],
  );

  const columns: ColumnsType<CouncilSpecialty> = [
    {
      title: '№',
      width: 56,
      align: 'center',
      render: (_v, _r, i) => <span style={{ color: 'var(--color-text-quaternary, #9ca3af)' }}>{i + 1}</span>,
    },
    {
      title: t('scienceCouncil.settings.specialtyCode'),
      dataIndex: 'code',
      width: 170,
      render: (v: string) => <Tag color="processing" style={{ fontWeight: 600 }}>{v}</Tag>,
    },
    {
      title: t('scienceCouncil.settings.specialtyTitle'),
      dataIndex: 'title',
      render: (v: string) => <strong style={{ fontWeight: 600 }}>{v}</strong>,
    },
    {
      title: t('scienceCouncil.settings.branch'),
      dataIndex: 'branch',
      width: 240,
      render: (v: string | null) =>
        v || <span style={{ color: 'var(--color-text-quaternary, #d0d5dd)' }}>—</span>,
    },
    {
      title: t('scienceCouncil.settings.status'),
      key: 'active',
      width: 150,
      align: 'center',
      render: (_v, r) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Switch
            size="small"
            checked={r.active}
            loading={updateMut.isPending}
            onChange={(v) => toggleActive(r, v)}
          />
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary, #475467)' }}>
            {r.active ? t('scienceCouncil.settings.active') : t('scienceCouncil.settings.inactive')}
          </span>
        </span>
      ),
    },
    {
      title: t('scienceCouncil.actions'),
      key: 'actions',
      width: 110,
      align: 'center',
      render: (_v, r) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
          <Tooltip title={t('scienceCouncil.work.edit')}>
            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Popconfirm
            title={t('scienceCouncil.settings.deleteSpecialty')}
            description={t('scienceCouncil.settings.deleteSpecialtyDesc')}
            okText={t('scienceCouncil.doc.deleteOk')}
            cancelText={t('scienceCouncil.cancel')}
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(r)}
          >
            <Tooltip title={t('scienceCouncil.delete')}>
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <PageContainer title={t('scienceCouncil.nav.specialties')}>
      <ToolBar>
        <Input
          placeholder={t('scienceCouncil.settings.searchSpecialty')}
          prefix={<SearchOutlined />}
          style={{ width: 320 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
        />
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 12 }}>
          <ExportButton
            onExport={exportRows}
            disabled={rows.length === 0}
            disabledReason={t('scienceCouncil.export.empty')}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            {t('scienceCouncil.settings.add')}
          </Button>
        </span>
      </ToolBar>

      <Card>
        <>
          <Table<CouncilSpecialty>
            rowKey="id"
            columns={columns}
            dataSource={pageRows}
            loading={isLoading}
            size="small"
            pagination={false}
            scroll={{ x: 800 }}
          />
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={rows.length}
            onChange={(p, ps) => { setPage(p); setPageSize(ps); }}
            onPageSizeChange={(ps) => { setPageSize(ps); setPage(1); }}
          />
        </>
      </Card>

      <Modal
        title={
          editing
            ? t('scienceCouncil.settings.editSpecialty')
            : t('scienceCouncil.settings.newSpecialty')
        }
        open={creating || !!editing}
        onCancel={close}
        onOk={handleSave}
        okText={t('scienceCouncil.save')}
        cancelText={t('scienceCouncil.cancel')}
        confirmLoading={createMut.isPending || updateMut.isPending}
        width={560}
        forceRender
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            label={t('scienceCouncil.settings.specialtyCode')}
            name="code"
            rules={[{ required: true, message: t('scienceCouncil.form.required') }]}
          >
            <Input placeholder={t('scienceCouncil.settings.specialtyCodePh')} />
          </Form.Item>
          <Form.Item
            label={t('scienceCouncil.settings.specialtyTitle')}
            name="title"
            rules={[{ required: true, message: t('scienceCouncil.form.required') }]}
          >
            <Input placeholder={t('scienceCouncil.settings.specialtyTitlePh')} />
          </Form.Item>
          <Form.Item
            label={t('scienceCouncil.settings.branch')}
            name="branch"
            rules={[{ required: true, message: t('scienceCouncil.form.required') }]}
          >
            <Input placeholder={t('scienceCouncil.settings.branchPh')} />
          </Form.Item>
          <Form.Item
            label={t('scienceCouncil.settings.status')}
            name="active"
            valuePropName="checked"
            initialValue
          >
            <Switch
              checkedChildren={t('scienceCouncil.settings.active')}
              unCheckedChildren={t('scienceCouncil.settings.inactive')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}
