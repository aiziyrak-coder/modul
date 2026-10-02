import { useCallback, useMemo, useState } from 'react';
import {
  Table, Button, Input, Form, Modal, Select, Switch, Tooltip, Popconfirm, Tag, App as AntApp,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import type { CouncilNumber, CouncilNumberInput } from '../model/types';
import {
  useCouncilNumbers,
  useCreateCouncilNumber,
  useUpdateCouncilNumber,
  useDeleteCouncilNumber,
  useSpecialties,
} from '../api/science-council-api';
import { apiMessage } from '../lib/api-error';
import { ExportButton } from '../components/export-button';
import { downloadExcel, datedFileName, type ExcelRow } from '../lib/excel';
import { Card, ToolBar } from '../components/settings-styles';
import { TablePagination } from '../components/table-pagination';

interface FormValues {
  number: string;
  specialties?: string[];
}

export default function CouncilNumbersPage() {
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm<FormValues>();

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<CouncilNumber | null>(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<CouncilNumber | null>(null);

  const { data: rows = [], isLoading } = useCouncilNumbers({
    all: true,
    search: search || undefined,
  });
  const { data: specialties = [] } = useSpecialties({
    free: true,
    exceptNumber: editing?.id,
  });

  const createMut = useCreateCouncilNumber();
  const updateMut = useUpdateCouncilNumber();
  const deleteMut = useDeleteCouncilNumber();

  const openCreate = useCallback(() => {
    form.resetFields();
    setEditing(null);
    setCreating(true);
  }, [form]);

  const openEdit = useCallback(
    (row: CouncilNumber) => {
      setCreating(false);
      setEditing(row);
      form.setFieldsValue({
        number: row.number,
        specialties: row.specialties.map((s) => s.id),
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
    const body: CouncilNumberInput = {
      number: values.number.trim(),
      specialties: values.specialties ?? [],
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
    async (row: CouncilNumber, active: boolean) => {
      try {
        await updateMut.mutateAsync({ id: row.id, body: { active } });
      } catch (err) {
        message.error(apiMessage(err, t('scienceCouncil.settings.saveFailed')));
      }
    },
    [updateMut, message, t],
  );

  const handleDelete = useCallback(
    async (row: CouncilNumber) => {
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
      [t('scienceCouncil.settings.councilNumber')]: r.number,
      [t('scienceCouncil.settings.attachedCodes')]:
        r.specialties.map((sp) => sp.code).join(', ') || '—',
      [t('scienceCouncil.form.specialtyTitle')]:
        r.specialties.map((sp) => sp.title).join('; ') || '—',
      [t('scienceCouncil.settings.status')]: r.active
        ? t('scienceCouncil.settings.active')
        : t('scienceCouncil.settings.inactive'),
    }));
    downloadExcel(excelRows, datedFileName('Ilmiy_kengash_raqamlari'),
      t('scienceCouncil.nav.councilNumbers'), [5, 22, 34, 60, 12]);
  };

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const pageRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize],
  );

  const columns: ColumnsType<CouncilNumber> = [
    {
      title: '№',
      width: 56,
      align: 'center',
      render: (_v, _r, i) => <span style={{ color: 'var(--color-text-quaternary, #9ca3af)' }}>{i + 1}</span>,
    },
    {
      title: t('scienceCouncil.settings.councilNumber'),
      dataIndex: 'number',
      render: (v: string) => <strong style={{ fontWeight: 600 }}>{v}</strong>,
    },
    {
      title: t('scienceCouncil.settings.attachedCodes'),
      key: 'specialties',
      width: 220,
      align: 'center',
      render: (_v, r) =>
        r.specialties.length === 0 ? (
          <span style={{ color: 'var(--color-text-quaternary, #d0d5dd)' }}>—</span>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Tag color="processing" style={{ margin: 0, fontWeight: 600 }}>
              {r.specialties.length} ta
            </Tag>
            <Tooltip title={t('scienceCouncil.settings.viewCodes')}>
              <Button
                size="small"
                type="text"
                icon={<EyeOutlined />}
                onClick={() => setViewing(r)}
              />
            </Tooltip>
          </span>
        ),
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
            title={t('scienceCouncil.settings.deleteNumber')}
            description={t('scienceCouncil.settings.deleteNumberDesc')}
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
    <PageContainer title={t('scienceCouncil.nav.councilNumbers')}>
      <ToolBar>
        <Input
          placeholder={t('scienceCouncil.settings.searchNumber')}
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
          <Table<CouncilNumber>
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
            ? t('scienceCouncil.settings.editNumber')
            : t('scienceCouncil.settings.newNumber')
        }
        open={creating || !!editing}
        onCancel={close}
        onOk={handleSave}
        okText={t('scienceCouncil.save')}
        cancelText={t('scienceCouncil.cancel')}
        confirmLoading={createMut.isPending || updateMut.isPending}
        width={600}
        forceRender
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            label={t('scienceCouncil.settings.councilNumber')}
            name="number"
            rules={[{ required: true, message: t('scienceCouncil.form.required') }]}
          >
            <Input placeholder={t('scienceCouncil.settings.councilNumberPh')} />
          </Form.Item>
          <Form.Item
            label={t('scienceCouncil.settings.attachedCodes')}
            name="specialties"
            tooltip={t('scienceCouncil.settings.attachedCodesHint')}
          >
            <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder={t('scienceCouncil.settings.attachedCodesPh')}
              notFoundContent={t('scienceCouncil.settings.noFreeCodes')}
              options={specialties.map((s) => ({
                value: s.id,
                label: `${s.code} — ${s.title}`,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={viewing?.number}
        open={!!viewing}
        onCancel={() => setViewing(null)}
        footer={null}
        width={560}
      >
        <div style={{ fontSize: 12, color: 'var(--color-text-tertiary, #667085)', marginBottom: 12 }}>
          {t('scienceCouncil.settings.attachedCodes')} &middot; {viewing?.specialties.length ?? 0} ta
        </div>
        <ol style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 10 }}>
          {(viewing?.specialties ?? []).map((sp) => (
            <li key={sp.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Tag color="processing" style={{ margin: 0, fontWeight: 600 }}>
                  {sp.code}
                </Tag>
                <strong style={{ fontWeight: 600 }}>{sp.title}</strong>
                {!sp.active && (
                  <Tag color="default" style={{ margin: 0 }}>
                    {t('scienceCouncil.settings.inactive')}
                  </Tag>
                )}
              </div>
              {sp.branch && (
                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary, #667085)', marginTop: 2 }}>
                  {sp.branch}
                </div>
              )}
            </li>
          ))}
        </ol>
      </Modal>
    </PageContainer>
  );
}
