import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { App, Alert, Button, Checkbox, Empty, Input, Modal, Spin, Tag } from '@/shared/ui';
import { SearchOutlined } from '@ant-design/icons';
import { getApiErrorMessage } from '@/shared/api';
import { ASSIGNEE_PAGE } from '../../api/task-management-api';
import { useGrantActions, useGrantCandidates, useGrants } from '../../api/queries';
import { colors } from '../../lib/theme';
import type { AssignerRow, TaskUser } from '../../model/types';

const Bar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin: 12px 0 8px;
  font-size: 12px;
  color: ${colors.textSecondary};
`;

const List = styled.div`
  max-height: 340px;
  overflow-y: auto;
  border: 1px solid ${colors.border};
  border-radius: 8px;
`;

const Row = styled.div<{ $checked: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  cursor: pointer;
  border-bottom: 1px solid ${colors.border};
  background: ${({ $checked }) => ($checked ? colors.primaryLight : 'transparent')};
  &:last-child {
    border-bottom: none;
  }
  &:hover {
    background: ${({ $checked }) => ($checked ? colors.primaryLight : colors.bgGray)};
  }
`;

const RowName = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: ${colors.textPrimary};
  line-height: 1.35;
`;
const RowMeta = styled.div`
  font-size: 12px;
  color: ${colors.textSecondary};
`;

const Centered = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
`;

interface Props {
  open: boolean;
  target: AssignerRow | null;
  onClose: () => void;
}

export default function AssigneeGrantModal({ open, target, onClose }: Props) {
  const { message } = App.useApp();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const assignerId = target?.id ?? null;
  const { grants, loading: grantsLoading } = useGrants(open ? assignerId : null);
  const { candidates, total, loading: candidatesLoading } = useGrantCandidates(debounced, open);
  const { saveGrants } = useGrantActions();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setDebounced('');
    setSelected(new Set());
  }, [open, assignerId]);

  useEffect(() => {
    if (!open || grantsLoading) return;
    setSelected(new Set(grants.map((u) => u.id)));
  }, [open, grantsLoading, grants]);

  const toggle = (user: TaskUser) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(user.id)) next.delete(user.id);
      else next.add(user.id);
      return next;
    });

  const selectAllVisible = () =>
    setSelected((prev) => new Set([...prev, ...candidates.map((u) => u.id)]));
  const clearAll = () => setSelected(new Set());

  const hasMore = total > candidates.length;
  const isFiltering = debounced.trim().length > 0;

  const rows = useMemo(() => candidates, [candidates]);

  const handleSave = async () => {
    if (!assignerId) return;
    try {
      await saveGrants.mutateAsync({ assignerId, assigneeIds: [...selected] });
      message.success(
        selected.size
          ? `${target?.name}: ${selected.size} ta ijrochi biriktirildi`
          : `${target?.name}: biriktirishlar olib tashlandi (umumiy qoidaga qaytdi)`,
      );
      onClose();
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Saqlashda xatolik'));
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Ijrochilarni biriktirish</div>
          <div style={{ fontSize: 13, fontWeight: 400, color: colors.textSecondary, marginTop: 2 }}>
            {target?.name}
            {target?.position ? ` · ${target.position}` : ''}
          </div>
        </div>
      }
      width={620}
      okText="Saqlash"
      cancelText="Bekor qilish"
      onOk={handleSave}
      confirmLoading={saveGrants.isPending}
      okButtonProps={{ style: { background: colors.primary, borderColor: colors.primary, borderRadius: 8 } }}
      cancelButtonProps={{ style: { borderRadius: 8 } }}
      destroyOnHidden
    >
      {selected.size === 0 && (
        <Alert
          type="warning"
          showIcon
          message="Ro'yxat bo'sh"
          description="Saqlansa, bu foydalanuvchi umumiy (rol) qoidasi bo'yicha ishlaydi — aniq cheklov bo'lmaydi."
          style={{ marginBottom: 4, borderRadius: 8 }}
        />
      )}

      <Input
        prefix={<SearchOutlined style={{ color: colors.textSecondary }} />}
        placeholder="Ism yoki familiya bo'yicha qidirish..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        allowClear
        style={{ borderRadius: 8, marginTop: 12 }}
      />

      <Bar>
        <span>
          {isFiltering ? `Qidiruv natijasi: ${total} ta` : `Jami: ${total} ta`}
          {hasMore && ` · ${candidates.length} tasi ko'rsatilyapti`}
          {' · '}
          <strong style={{ color: colors.primary }}>{selected.size} ta tanlandi</strong>
        </span>
        <span style={{ display: 'flex', gap: 12 }}>
          <Button
            type="link"
            size="small"
            style={{ padding: 0, height: 'auto' }}
            disabled={!candidates.length}
            onClick={selectAllVisible}
          >
            {isFiltering || hasMore ? "Ko'rinayotganlarni belgilash" : 'Barchasini belgilash'}
          </Button>
          <Button
            type="link"
            size="small"
            danger
            style={{ padding: 0, height: 'auto' }}
            disabled={!selected.size}
            onClick={clearAll}
          >
            Tanlovni bekor qilish
          </Button>
        </span>
      </Bar>

      {hasMore && (
        <div style={{ fontSize: 12, color: colors.warning, marginBottom: 8 }}>
          Ro&apos;yxat {ASSIGNEE_PAGE} tagacha ko&apos;rsatiladi — qolganini topish uchun qidiruvdan
          foydalaning. Belgilanganlar qidiruv o&apos;zgarsa ham saqlanib qoladi.
        </div>
      )}

      <List>
        {grantsLoading || (candidatesLoading && !candidates.length) ? (
          <Centered>
            <Spin />
          </Centered>
        ) : rows.length === 0 ? (
          <Centered>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Xodim topilmadi" />
          </Centered>
        ) : (
          rows.map((u) => {
            const checked = selected.has(u.id);
            return (
              <Row key={u.id} $checked={checked} onClick={() => toggle(u)}>
                <Checkbox checked={checked} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <RowName>
                    {u.name}
                    {u.id === assignerId && (
                      <Tag color="blue" style={{ marginLeft: 6, fontSize: 11 }}>
                        o&apos;zi
                      </Tag>
                    )}
                  </RowName>
                  <RowMeta>
                    {[u.position, u.department, u.roleTitle].filter(Boolean).join(' · ') || '—'}
                  </RowMeta>
                </div>
              </Row>
            );
          })
        )}
      </List>
    </Modal>
  );
}
