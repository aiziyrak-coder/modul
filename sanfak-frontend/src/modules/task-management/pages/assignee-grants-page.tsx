import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { App, Button, Empty, Input, Select, Table, Tag, Tooltip } from '@/shared/ui';
import type { TableProps } from '@/shared/ui';
import { CloseOutlined, SearchOutlined, TeamOutlined, UsergroupAddOutlined } from '@ant-design/icons';
import { getApiErrorMessage } from '@/shared/api';
import { useServerTable } from '../lib/use-server-table';
import { useDebouncedSearch } from '../lib/use-debounced';
import { fetchAssigners } from '../api/task-management-api';
import { useGrantRoles } from '../api/queries';
import { colors } from '../lib/theme';
import AssigneeGrantModal from '../components/assignee-grant-modal';
import type { AssignerRow } from '../model/types';

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
`;

const Hint = styled.div`
  background: ${colors.primaryLight};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  color: ${colors.textPrimary};
  margin-bottom: 14px;
  line-height: 1.5;
`;

const ClearBtn = styled.button`
  padding: 3px 10px;
  border-radius: 6px;
  border: 1px solid #f59e0b;
  background: #fff;
  color: #92400e;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  height: 40px;
  &:hover {
    background: #fef3c7;
  }
`;

const UserName = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: ${colors.textPrimary};
  line-height: 1.35;
`;
const UserMeta = styled.div`
  font-size: 12px;
  color: ${colors.textSecondary};
`;

export default function AssigneeGrantsPage() {
  const { message } = App.useApp();
  const roles = useGrantRoles();

  const { rows, total, page, limit, loading, error, setPage, setLimit, resetFilters, reload } =
    useServerTable<AssignerRow>(fetchAssigners, { initialLimit: 10 });

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedSearch(search);
  const [roleFilter, setRoleFilter] = useState('');
  const [target, setTarget] = useState<AssignerRow | null>(null);

  useEffect(() => {
    const p: Record<string, string> = {};
    if (debouncedSearch) p.search = debouncedSearch;
    if (roleFilter) p.role = roleFilter;
    resetFilters(p);
  }, [debouncedSearch, roleFilter, resetFilters]);

  const hasActiveFilter = !!search || !!roleFilter;
  const clearFilters = () => {
    setSearch('');
    setRoleFilter('');
  };

  const closeModal = () => {
    setTarget(null);
    void reload().catch((e) => message.error(getApiErrorMessage(e, 'Yangilashda xatolik')));
  };

  const columns: TableProps<AssignerRow>['columns'] = [
    {
      title: 'Foydalanuvchi',
      key: 'user',
      width: '38%',
      render: (_, r) => (
        <div>
          <UserName>{r.name}</UserName>
          <UserMeta>{[r.position, r.department].filter(Boolean).join(' · ') || '—'}</UserMeta>
        </div>
      ),
    },
    {
      title: 'Rol',
      dataIndex: 'roleTitle',
      key: 'roleTitle',
      width: '22%',
      render: (t: string) => (t ? <Tag>{t}</Tag> : <span style={{ color: colors.textSecondary }}>—</span>),
    },
    {
      title: 'Ijrochilari',
      dataIndex: 'grantCount',
      key: 'grantCount',
      width: '22%',
      render: (n: number) =>
        n > 0 ? (
          <Tag color="green" style={{ fontWeight: 600 }}>
            <TeamOutlined /> {n} ta
          </Tag>
        ) : (
          <Tooltip title="Aniq biriktirish yo'q — bu foydalanuvchi rol doirasi (scopeLevel) bo'yicha ishlaydi">
            <Tag style={{ color: colors.textSecondary }}>umumiy qoida</Tag>
          </Tooltip>
        ),
    },
    {
      title: 'Amallar',
      key: 'actions',
      width: '18%',
      render: (_, r) => (
        <Button
          size="small"
          icon={<UsergroupAddOutlined />}
          onClick={() => setTarget(r)}
          style={{ borderRadius: 6 }}
        >
          Biriktirish
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Hint>
        Bu yerda har bir foydalanuvchi <strong>kimlarga</strong> topshiriq bera olishini
        belgilaysiz. Ro&apos;yxat bo&apos;sh bo&apos;lsa (<em>umumiy qoida</em>), u eski tartibda —
        roli doirasi bo&apos;yicha ishlaydi. Biriktirish olib tashlansa,{' '}
        <strong>ochiq topshiriqlar saqlanib qoladi</strong>. Super admin va administrator har doim
        cheklovsiz.
      </Hint>

      <Toolbar>
        <Input
          prefix={<SearchOutlined style={{ color: colors.textSecondary }} />}
          placeholder="Ism yoki familiya..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ width: 260, borderRadius: 8 }}
        />
        <Select
          placeholder="Rol"
          value={roleFilter || undefined}
          onChange={(v) => setRoleFilter(v ?? '')}
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ width: 220, height: 40 }}
          options={roles.map((r) => ({ value: r.id, label: r.description || r.title }))}
        />
        {hasActiveFilter && (
          <ClearBtn onClick={clearFilters}>
            <CloseOutlined /> Tozalash
          </ClearBtn>
        )}
      </Toolbar>

      <Table<AssignerRow>
        columns={columns}
        dataSource={rows}
        rowKey="id"
        loading={loading}
        onChange={(pag) => {
          setPage(pag.current ?? 1);
          setLimit(pag.pageSize ?? limit);
        }}
        pagination={{
          current: page,
          pageSize: limit,
          total,
          showSizeChanger: true,
          showTotal: (t) => `Jami: ${t} ta foydalanuvchi`,
        }}
        style={{ background: '#fff', borderRadius: 12, border: `1px solid ${colors.border}` }}
        locale={{
          emptyText: loading ? (
            <Empty description="Yuklanmoqda..." />
          ) : error ? (
            <Empty description={error} />
          ) : (
            <Empty description="Foydalanuvchi topilmadi" />
          ),
        }}
      />

      <AssigneeGrantModal open={!!target} target={target} onClose={closeModal} />
    </div>
  );
}
