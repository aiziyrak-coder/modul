import { useState } from 'react';
import styled from 'styled-components';
import { Table, Tag, Button, Select, Form, Input, Switch, Tooltip, Modal, Popconfirm, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { ExportButton } from '../components/export-button';
import { downloadExcel, datedFileName, type ExcelRow } from '../lib/excel';
import {
  useAllWorks,
  useWorkDocumentTypes,
  useCreateWorkDocumentType,
  useUpdateWorkDocumentType,
  useDeleteWorkDocumentType,
} from '../api/science-council-api';
import { apiMessage } from '../lib/api-error';
import type { WorkDocumentType } from '../model/types';

const ToolBar = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
`;

const StatsBar = styled.div`
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-secondary, #e5e7eb);
  border-radius: var(--radius-lg, 12px);
  padding: 14px 20px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
`;

const StatItem = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const StatCount = styled.div<{ $color?: string }>`
  font-size: 20px;
  font-weight: 800;
  color: ${({ $color }) => $color ?? 'var(--color-text, #111827)'};
  line-height: 1;
`;

const StatLabel = styled.div`
  font-size: 11.5px;
  color: var(--color-text-tertiary, #6b7280);
`;

const Dot = styled.span<{ $color: string }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  flex-shrink: 0;
`;

const Divider = styled.div`
  width: 1px;
  height: 36px;
  background: var(--border-secondary, #e5e7eb);
`;

const ScrollWrap = styled.div`
  overflow-x: auto;
`;

const Card = styled.div`
  background: var(--bg-surface, #fff);
  border-radius: var(--radius-lg, 14px);
  border: 1px solid var(--border-secondary, #e5e7eb);
  overflow: hidden;
`;

interface DocRow {
  id: string;
  key: string;
  index: number;
  labelUz: string;
  labelRu: string;
  format: string;
  required: boolean;
}

const FORMAT_OPTIONS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'word', label: 'WORD (.docx)' },
  { value: 'word, pdf', label: 'WORD + PDF' },
  { value: 'excel', label: 'Excel' },
];

export default function DocumentsPage() {
  const { t, lang } = useTranslation();
  const { data: works = [] } = useAllWorks();
  const { data: categories = [], isLoading } = useWorkDocumentTypes({ all: true });
  const createMut = useCreateWorkDocumentType();
  const updateMut = useUpdateWorkDocumentType();
  const deleteMut = useDeleteWorkDocumentType();

  const [workId, setWorkId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<WorkDocumentType | null>(null);
  const [editForm] = Form.useForm();

  const displayWork = workId ? works.find((w) => w.id === workId) : null;

  const total = categories.length;
  const required = categories.filter((d) => d.required).length;
  const optional = categories.filter((d) => !d.required).length;

  const uploaded = displayWork
    ? Object.entries(displayWork.documents).filter(([k, v]) => v.uploaded && categories.some((c) => c.key === k)).length
    : 0;

  const dataSource: DocRow[] = categories.map((cat, i) => ({
    id: cat.id,
    key: cat.key,
    index: i + 1,
    labelUz: cat.labelUz,
    labelRu: cat.labelRu ?? cat.labelUz,
    format: cat.format,
    required: cat.required,
  }));

  const exportRows = () => {
    const rows: ExcelRow[] = dataSource.map((d) => ({
      '№': d.index,
      [t('scienceCouncil.doc.docName')]: lang === 'ru' ? d.labelRu : d.labelUz,
      Format: d.format || '—',
      [t('scienceCouncil.detail.mandatory')]: d.required
        ? t('scienceCouncil.detail.mandatory')
        : t('scienceCouncil.detail.optional'),
    }));
    downloadExcel(rows, datedFileName('Ilmiy_ish_hujjatlari'),
      t('scienceCouncil.nav.workDocuments'), [6, 55, 16, 16]);
  };

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    editForm.resetFields();
    editForm.setFieldsValue({ required: false, format: 'pdf' });
  };

  const openEdit = (row: DocRow) => {
    const cat = categories.find((c) => c.id === row.id);
    if (!cat) return;
    setCreating(false);
    setEditing(cat);
    editForm.setFieldsValue({
      labelUz: cat.labelUz,
      format: cat.format,
      required: cat.required,
    });
  };

  const closeModal = () => {
    setCreating(false);
    setEditing(null);
    editForm.resetFields();
  };

  const handleSave = async () => {
    let values: { labelUz: string; format: string; required?: boolean };
    try {
      values = await editForm.validateFields();
    } catch {
      return;
    }
    const body = {
      labelUz: values.labelUz.trim(),
      labelRu: values.labelUz.trim(),
      format: values.format,
      required: !!values.required,
    };
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, body });
        message.success(t('scienceCouncil.doc.updated'));
      } else {
        const key =
          (values.labelUz || 'doc')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .slice(0, 16) + '_' + Date.now().toString(36).slice(-4);
        await createMut.mutateAsync({ key, order: categories.length + 1, ...body });
        message.success(t('scienceCouncil.doc.added'));
      }
      closeModal();
    } catch (err) {
      message.error(apiMessage(err, t('scienceCouncil.settings.saveFailed')));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMut.mutateAsync(id);
      message.success(t('scienceCouncil.doc.deleted'));
    } catch (err) {
      message.error(apiMessage(err, t('scienceCouncil.settings.deleteFailed')));
    }
  };

  const columns: ColumnsType<DocRow> = [
    {
      title: '№',
      dataIndex: 'index',
      width: 50,
      render: (v: number) => <span style={{ color: '#9ca3af' }}>{v}</span>,
    },
    {
      title: t('scienceCouncil.doc.docName'),
      key: 'name',
      render: (_v, r) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text, #111827)' }}>
            {lang === 'ru' ? r.labelRu : r.labelUz}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.format.toUpperCase()}</div>
        </div>
      ),
    },
    {
      title: t('scienceCouncil.detail.mandatory'),
      dataIndex: 'required',
      width: 130,
      render: (req: boolean) => (
        <Tag color={req ? 'red' : 'default'} style={{ fontSize: 11 }}>
          {req ? t('scienceCouncil.detail.mandatory') : t('scienceCouncil.detail.optional')}
        </Tag>
      ),
    },
    {
      title: t('scienceCouncil.actions'),
      key: 'actions',
      width: 100,
      render: (_v, r) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Tooltip title={t('scienceCouncil.work.edit')}>
            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Popconfirm
            title={t('scienceCouncil.doc.deleteConfirm')}
            description={t('scienceCouncil.doc.deleteDesc')}
            okText={t('scienceCouncil.doc.deleteOk')}
            cancelText={t('scienceCouncil.cancel')}
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(r.id)}
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
    <PageContainer title={t('scienceCouncil.nav.documents')}>
     <ScrollWrap>
      <ToolBar>
        <Select
          placeholder={
            lang === 'ru'
              ? 'Выберите или найдите работу...'
              : 'Ilmiy ishni tanlang yoki qidiring...'
          }
          style={{ width: 420 }}
          onChange={(v: string) => setWorkId(v)}
          showSearch
          allowClear
          onClear={() => setWorkId(null)}
          filterOption={(input, option) =>
            (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
          }
          optionFilterProp="label"
          options={works.map((w) => ({
            value: w.id,
            label: w.title,
          }))}
        />
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 12, alignItems: 'center' }}>
          <ExportButton
            onExport={exportRows}
            disabled={dataSource.length === 0}
            disabledReason={t('scienceCouncil.export.empty')}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreate}
            style={{ background: '#16a34a', borderColor: '#16a34a', borderRadius: 10, fontWeight: 600 }}
          >
            {t('scienceCouncil.doc.addCategory')}
          </Button>
        </span>
      </ToolBar>

      <StatsBar>
        <StatItem>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FileTextOutlined style={{ color: '#2563eb', fontSize: 18 }} />
          </div>
          <div>
            <StatCount>{total}</StatCount>
            <StatLabel>{t('scienceCouncil.doc.totalTypes')}</StatLabel>
          </div>
        </StatItem>

        <Divider />

        <StatItem>
          <Dot $color="#dc2626" />
          <div>
            <StatCount $color="#dc2626">{required}</StatCount>
            <StatLabel>{t('scienceCouncil.doc.requiredDocs')}</StatLabel>
          </div>
        </StatItem>

        <StatItem>
          <Dot $color="#9ca3af" />
          <div>
            <StatCount $color="#6b7280">{optional}</StatCount>
            <StatLabel>{t('scienceCouncil.doc.optionalDocs')}</StatLabel>
          </div>
        </StatItem>

        {displayWork && (
          <>
            <Divider />
            <StatItem>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: '#f0fdf4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 18 }} />
              </div>
              <div>
                <StatCount $color="#16a34a">
                  {uploaded}/{total}
                </StatCount>
                <StatLabel>{t('scienceCouncil.doc.uploaded')}</StatLabel>
              </div>
            </StatItem>
          </>
        )}
      </StatsBar>

      <Card>
        <Table<DocRow>
          dataSource={dataSource}
          columns={columns}
          rowKey="id"
          size="small"
          loading={isLoading}
          pagination={false}
          scroll={{ x: 600 }}
        />
      </Card>

     </ScrollWrap>

      <Modal
        title={
          creating ? t('scienceCouncil.doc.newCategory') : t('scienceCouncil.doc.editCategory')
        }
        open={creating || !!editing}
        onCancel={closeModal}
        onOk={handleSave}
        okText={t('scienceCouncil.save')}
        cancelText={t('scienceCouncil.cancel')}
        okButtonProps={{ style: { background: '#16a34a', borderColor: '#16a34a' } }}
        confirmLoading={createMut.isPending || updateMut.isPending}
        width={520}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            label={t('scienceCouncil.doc.docName')}
            name="labelUz"
            rules={[{ required: true, message: t('scienceCouncil.form.required') }]}
          >
            <Input placeholder={t('scienceCouncil.doc.docNamePlaceholder')} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item
              label={t('scienceCouncil.doc.format')}
              name="format"
              rules={[{ required: true, message: t('scienceCouncil.form.required') }]}
            >
              <Select
                options={[
                  ...FORMAT_OPTIONS,
                  { value: 'any', label: t('scienceCouncil.doc.anyFormat') },
                ]}
              />
            </Form.Item>
            <Form.Item
              label={t('scienceCouncil.doc.isRequired')}
              name="required"
              valuePropName="checked"
            >
              <Switch
                checkedChildren={t('scienceCouncil.detail.mandatory')}
                unCheckedChildren={t('scienceCouncil.detail.optional')}
              />
            </Form.Item>
          </div>
          <div
            style={{
              padding: '10px 12px',
              background: 'var(--bg-muted, #f9fafb)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--color-text-tertiary, #6b7280)',
            }}
          >
            {t('scienceCouncil.doc.hint')}
          </div>
        </Form>
      </Modal>
    </PageContainer>
  );
}
