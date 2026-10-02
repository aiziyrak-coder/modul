import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { App, Button, Card, Empty, Input, Modal, Space, Table, Tag } from '@/shared/ui';
import type { TableProps } from '@/shared/ui';
import { DeleteOutlined, EditOutlined, ExclamationCircleFilled, PlusOutlined, SearchOutlined, TagsOutlined } from '@ant-design/icons';
import { Can, usePermission } from '@/app/session';
import { getApiErrorMessage } from '@/shared/api';
import { useServerTable } from '../lib/use-server-table';
import { useDebouncedSearch } from '../lib/use-debounced';
import { fetchCategoriesPage } from '../api/task-management-api';
import { useCategoriesData, useCategoryActions } from '../api/queries';
import { colors } from '../lib/theme';
import type { Category } from '../model/types';

const PageCard = styled(Card)`
  border-radius: 12px;
  border: 1px solid ${colors.border};
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  .ant-card-body {
    padding: 20px;
  }
`;
const Title = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: ${colors.textPrimary};
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
`;
const Sub = styled.div`
  font-size: 13px;
  color: ${colors.textSecondary};
  margin-bottom: 18px;
`;

export default function CategoriesPage() {
  const { message } = App.useApp();
  const can = usePermission();
  const { categories } = useCategoriesData();
  const { addCategory, editCategory, removeCategory } = useCategoryActions();
  const { rows, total, page, limit, loading, error: loadError, setPage, setLimit, resetFilters, reload } =
    useServerTable<Category>(fetchCategoriesPage, { initialLimit: 10 });

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedSearch(search);
  useEffect(() => {
    resetFilters(debouncedSearch ? { search: debouncedSearch } : {});
  }, [debouncedSearch, resetFilters]);

  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [editName, setEditName] = useState('');

  const canCreate = can('taskCategory:create');

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setError('Kategoriya nomini kiriting');
      return;
    }
    if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setError('Bunday kategoriya allaqachon mavjud');
      return;
    }
    try {
      await addCategory.mutateAsync(trimmed);
      message.success(`"${trimmed}" kategoriyasi qo'shildi`);
      setNewName('');
      setError('');
      void reload();
    } catch (e) {
      message.error(getApiErrorMessage(e, "Qo'shishda xatolik"));
    }
  };

  const handleUpdate = async () => {
    if (!editTarget) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      message.error('Kategoriya nomini kiriting');
      return;
    }
    if (trimmed !== editTarget.name && categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      message.error('Bunday kategoriya allaqachon mavjud');
      return;
    }
    try {
      await editCategory.mutateAsync({ id: editTarget._id, name: trimmed });
      message.success('Kategoriya yangilandi');
      setEditTarget(null);
      void reload();
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Yangilashda xatolik'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeCategory.mutateAsync(deleteTarget._id);
      setDeleteTarget(null);
      void reload();
      message.success("Kategoriya o'chirildi");
    } catch (e) {
      message.error(getApiErrorMessage(e, "Bu kategoriya topshiriqlarda ishlatilmoqda yoki o'chirishda xatolik"));
    }
  };

  const columns: TableProps<Category>['columns'] = [
    {
      title: '#',
      key: 'index',
      width: 60,
      render: (_, __, i) => <span style={{ color: colors.textSecondary }}>{(page - 1) * limit + i + 1}</span>,
    },
    {
      title: 'Kategoriya nomi',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Tag color="blue" style={{ borderRadius: 6, margin: 0 }}>
          {name}
        </Tag>
      ),
    },
    {
      title: 'Amal',
      key: 'action',
      width: 110,
      align: 'center',
      render: (_, rec) => (
        <Space size={2}>
          <Can perform="taskCategory:update">
            <Button
              icon={<EditOutlined />}
              type="text"
              style={{ color: colors.primary }}
              onClick={() => {
                setEditTarget(rec);
                setEditName(rec.name);
              }}
            />
          </Can>
          <Can perform="taskCategory:delete">
            <Button icon={<DeleteOutlined />} type="text" danger onClick={() => setDeleteTarget(rec)} />
          </Can>
        </Space>
      ),
    },
  ];

  const emptyText = loading ? (
    <Empty description="Yuklanmoqda..." image={Empty.PRESENTED_IMAGE_SIMPLE} />
  ) : loadError ? (
    <Empty description={loadError} image={Empty.PRESENTED_IMAGE_SIMPLE} />
  ) : debouncedSearch ? (
    <Empty description="Qidiruvga mos kategoriya topilmadi" image={Empty.PRESENTED_IMAGE_SIMPLE} />
  ) : (
    <Empty description="Kategoriya yo'q" image={Empty.PRESENTED_IMAGE_SIMPLE} />
  );

  return (
    <div>
      <PageCard>
        <Title>
          <TagsOutlined style={{ color: colors.primary }} /> Kategoriyalar
        </Title>
        <Sub>Topshiriq yaratishda tanlanadigan kategoriyalarni boshqaring.</Sub>

        <div style={{ display: 'flex', gap: 10, marginBottom: error ? 4 : 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {canCreate && (
            <>
              <Input
                placeholder="Yangi kategoriya nomi..."
                value={newName}
                status={error ? 'error' : ''}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (error) setError('');
                }}
                onPressEnter={handleAdd}
                style={{ width: 300, borderRadius: 8, height: 40 }}
              />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                loading={addCategory.isPending}
                onClick={handleAdd}
                style={{ background: colors.primary, borderColor: colors.primary, borderRadius: 8, height: 40 }}
              >
                Qo&apos;shish
              </Button>
            </>
          )}
          <Input
            prefix={<SearchOutlined style={{ color: colors.textSecondary }} />}
            placeholder="Qidirish..."
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220, borderRadius: 8, height: 40, marginLeft: 'auto' }}
          />
        </div>
        {error && <div style={{ color: '#ff4d4f', fontSize: 12, marginBottom: 14 }}>{error}</div>}

        <Table<Category>
          columns={columns}
          dataSource={rows}
          rowKey="_id"
          loading={loading}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p);
              setLimit(ps);
            },
            showTotal: (t) => `Jami: ${t} ta kategoriya`,
          }}
          size="small"
          locale={{ emptyText }}
          style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${colors.border}` }}
        />
      </PageCard>

      <Modal
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onOk={handleDelete}
        okText="Ha, o'chirish"
        cancelText="Bekor qilish"
        confirmLoading={removeCategory.isPending}
        okButtonProps={{ danger: true, style: { borderRadius: 8 } }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
        width={420}
        centered
        closable={false}
        styles={{ body: { padding: '24px 24px 8px' } }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <ExclamationCircleFilled style={{ fontSize: 24, color: '#F04438', marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#101828', marginBottom: 6 }}>Kategoriyani o&apos;chirish</div>
            <div style={{ fontSize: 14, color: '#667085', lineHeight: 1.6 }}>
              <strong style={{ color: '#101828' }}>&quot;{deleteTarget?.name}&quot;</strong> kategoriyasi o&apos;chiriladi. Mavjud topshiriqlar o&apos;zgarmaydi.
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!editTarget}
        onCancel={() => setEditTarget(null)}
        onOk={handleUpdate}
        okText="Saqlash"
        cancelText="Bekor qilish"
        confirmLoading={editCategory.isPending}
        okButtonProps={{ style: { background: colors.primary, borderColor: colors.primary, borderRadius: 8 } }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
        width={420}
        centered
        title={
          <span>
            <EditOutlined style={{ marginRight: 8, color: colors.primary }} />
            Kategoriyani tahrirlash
          </span>
        }
      >
        <Input value={editName} onChange={(e) => setEditName(e.target.value)} onPressEnter={handleUpdate} placeholder="Kategoriya nomi" style={{ borderRadius: 8, height: 40, marginTop: 8 }} />
      </Modal>
    </div>
  );
}
