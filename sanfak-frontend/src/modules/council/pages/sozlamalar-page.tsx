import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  LockOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { App, Button, Card, Divider, Flex, InputNumber, Result, Switch, Tag, Typography } from 'antd';
import type { ColumnDef } from '@tanstack/react-table';
import { PageContainer, DataTable, Tab } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { PageHeader } from '../components/page-header';
import { DocItemModal } from '../components/doc-item-modal';
import { RankTypeModal } from '../components/rank-type-modal';
import type { DocItem, DocSetting } from '../model/types';
import { useCouncilRole } from '../model/role';
import { useDocSetting, useDocSettingUpdate } from '../api/council-api';

const { Text } = Typography;

type Category = 'rank' | 'position';

const CATEGORY_OPTIONS = [
  { value: 'rank' as Category, label: 'Ilmiy unvon hujjatlari' },
  { value: 'position' as Category, label: 'Lavozim hujjatlari' },
];

const renumber = (items: DocItem[]): DocItem[] =>
  items.map((item, i) => ({ ...item, order: i + 1 }));

const sortByOrder = (items: DocItem[]): DocItem[] =>
  [...items].sort((a, b) => a.order - b.order);

interface EditState {
  open: boolean;
  category: Category;
  item: DocItem | null;
}

export default function SozlamalarPage() {
  const { message, modal } = App.useApp();
  const role = useCouncilRole();
  const isKotib = role === 'ilmiy_kengash_kotibi';

  const { data, isLoading } = useDocSetting();
  const update = useDocSettingUpdate();

  const [tab, setTab] = useState<Category>('rank');
  const [rank, setRank] = useState<DocItem[]>([]);
  const [position, setPosition] = useState<DocItem[]>([]);
  const [passingPercent, setPassingPercent] = useState<number>(60);
  const [rankTypes, setRankTypes] = useState<string[]>([]);
  const [rankTypeModal, setRankTypeModal] = useState<{ open: boolean; name: string | null }>({
    open: false,
    name: null,
  });
  const [editState, setEditState] = useState<EditState>({ open: false, category: 'rank', item: null });

  useEffect(() => {
    if (data) {
      setRank(renumber(sortByOrder(data.categories.rank)));
      setPosition(renumber(sortByOrder(data.categories.position)));
      setPassingPercent(data.passingPercent);
      setRankTypes([...data.rankTypes]);
    }
  }, [data]);

  const currentItems = tab === 'rank' ? rank : position;
  const setCurrentItems = tab === 'rank' ? setRank : setPosition;

  const dirty = useMemo(() => {
    if (!data) return false;
    const same = (a: DocItem[], b: DocItem[]) =>
      a.length === b.length &&
      a.every((x, i) => {
        const y = b[i];
        return !!y && x.name === y.name && x.required === y.required && x.order === y.order;
      });
    const base = {
      rank: renumber(sortByOrder(data.categories.rank)),
      position: renumber(sortByOrder(data.categories.position)),
    };
    const sameRankTypes =
      rankTypes.length === data.rankTypes.length &&
      rankTypes.every((name, i) => name === data.rankTypes[i]);
    return (
      !same(rank, base.rank) ||
      !same(position, base.position) ||
      passingPercent !== data.passingPercent ||
      !sameRankTypes
    );
  }, [data, rank, position, passingPercent, rankTypes]);

  const openAdd = () => setEditState({ open: true, category: tab, item: null });
  const openEdit = (item: DocItem) => setEditState({ open: true, category: tab, item });
  const closeEdit = () => setEditState((s) => ({ ...s, open: false }));

  const handleModalSubmit = ({ name, required }: { name: string; required: boolean }) => {
    setCurrentItems((prev) => {
      if (editState.item) {
        return prev.map((it) => (it === editState.item ? { ...it, name, required } : it));
      }
      return renumber([...prev, { name, required, order: prev.length + 1 }]);
    });
    closeEdit();
  };

  const handleDelete = (item: DocItem) => {
    modal.confirm({
      title: "Hujjatni o'chirish",
      content: `"${item.name}" ro'yxatdan o'chirilsinmi?`,
      okText: "O'chirish",
      okType: 'danger',
      cancelText: 'Bekor qilish',
      centered: true,
      onOk: () => setCurrentItems((prev) => renumber(prev.filter((it) => it !== item))),
    });
  };

  const move = (index: number, dir: -1 | 1) => {
    setCurrentItems((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const a = prev[index];
      const b = prev[target];
      if (!a || !b) return prev;
      const next = [...prev];
      next[index] = b;
      next[target] = a;
      return renumber(next);
    });
  };

  const toggleRequired = (item: DocItem, required: boolean) => {
    setCurrentItems((prev) => prev.map((it) => (it === item ? { ...it, required } : it)));
  };

  const handleRankTypeSubmit = (name: string) => {
    setRankTypes((prev) =>
      rankTypeModal.name ? prev.map((t) => (t === rankTypeModal.name ? name : t)) : [...prev, name],
    );
    setRankTypeModal({ open: false, name: null });
  };

  const handleRankTypeDelete = (name: string) => {
    if (rankTypes.length <= 1) {
      message.warning("Kamida bitta unvon turi qolishi shart — oxirgisini o'chirib bo'lmaydi");
      return;
    }
    modal.confirm({
      title: "Unvon turini o'chirish",
      content: `"${name}" ro'yxatdan o'chirilsinmi?`,
      okText: "O'chirish",
      okType: 'danger',
      cancelText: 'Bekor qilish',
      centered: true,
      onOk: () => setRankTypes((prev) => prev.filter((t) => t !== name)),
    });
  };

  const handleSave = async () => {
    const payload: DocSetting = {
      categories: {
        rank: renumber(rank),
        position: renumber(position),
      },
      passingPercent,
      rankTypes,
      positionTypes: data?.positionTypes ?? [],
    };
    try {
      await update.mutateAsync(payload);
      message.success('Sozlamalar saqlandi');
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const columns: ColumnDef<DocItem>[] = [
    { header: '#', id: '_order', size: 56, cell: ({ row }) => row.original.order },
    {
      header: 'Hujjat nomi',
      id: 'name',
      cell: ({ row }) => (
        <div style={{ fontWeight: 500, color: 'var(--color-text)' }}>{row.original.name}</div>
      ),
    },
    {
      header: 'Majburiy',
      id: 'required',
      size: 140,
      cell: ({ row }) => (
        <Switch
          size="small"
          checked={row.original.required}
          onChange={(checked) => toggleRequired(row.original, checked)}
        />
      ),
    },
    {
      header: 'Amallar',
      id: '_a',
      size: 200,
      meta: { align: 'right' as const },
      cell: ({ row }) => (
        <Flex gap={4} justify="flex-end">
          <Button
            type="text"
            size="small"
            icon={<ArrowUpOutlined />}
            disabled={row.index === 0}
            onClick={() => move(row.index, -1)}
            title="Yuqoriga"
          />
          <Button
            type="text"
            size="small"
            icon={<ArrowDownOutlined />}
            disabled={row.index === currentItems.length - 1}
            onClick={() => move(row.index, 1)}
            title="Pastga"
          />
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(row.original)}
            title="Tahrirlash"
          />
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(row.original)}
            title="O'chirish"
          />
        </Flex>
      ),
    },
  ];

  const rankTypeColumns: ColumnDef<string>[] = [
    { header: '#', id: '_i', size: 56, cell: ({ row }) => row.index + 1 },
    {
      header: 'Unvon turi',
      id: 'name',
      cell: ({ row }) => (
        <div style={{ fontWeight: 500, color: 'var(--color-text)' }}>{row.original}</div>
      ),
    },
    {
      header: 'Amallar',
      id: '_a',
      size: 120,
      meta: { align: 'right' as const },
      cell: ({ row }) => (
        <Flex gap={4} justify="flex-end">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => setRankTypeModal({ open: true, name: row.original })}
            title="Tahrirlash"
          />
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleRankTypeDelete(row.original)}
            title="O'chirish"
          />
        </Flex>
      ),
    },
  ];

  if (!isKotib) {
    return (
      <PageContainer title="Sozlamalar">
        <Result
          icon={<LockOutlined style={{ color: 'var(--color-text-soft, #697586)' }} />}
          title="Ruxsat yo'q"
          subTitle="Ushbu sahifa faqat ilmiy kengash kotibi uchun."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Sozlamalar">
      <PageHeader
        title="Sozlamalar"
        extra={
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={update.isPending}
            disabled={!dirty}
            onClick={handleSave}
            style={{ height: 40 }}
          >
            Saqlash
          </Button>
        }
      />

      <Card
        style={{ marginBottom: 'var(--space-4, 16px)' }}
        styles={{ body: { padding: 'var(--space-5, 20px)' } }}
      >
        <Flex align="center" justify="space-between" wrap gap={12}>
          <Flex vertical gap={2}>
            <Text strong style={{ color: 'var(--color-text)' }}>
              Ovoz berish uchun o'tish foizi
            </Text>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Nomzod tasdiqlanishi uchun kerak bo'lgan minimal "rozi" ovozlar ulushi.
            </Text>
          </Flex>
          <InputNumber
            min={1}
            max={100}
            value={passingPercent}
            onChange={(v) => setPassingPercent(v ?? 0)}
            addonAfter="%"
            style={{ width: 140 }}
          />
        </Flex>
      </Card>

      <Card
        style={{ marginBottom: 'var(--space-4, 16px)' }}
        styles={{ body: { padding: 'var(--space-5, 20px)' } }}
      >
        <Flex align="center" justify="space-between" wrap gap={12} style={{ marginBottom: 'var(--space-3, 12px)' }}>
          <Flex vertical gap={2}>
            <Text strong style={{ color: 'var(--color-text)' }}>
              Unvon turlari
            </Text>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Ushbu ro'yxat unvon arizasi va so'rovnoma yaratishdagi "Unvon" variantlarini boshqaradi.
            </Text>
          </Flex>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setRankTypeModal({ open: true, name: null })}
            style={{ height: 40 }}
          >
            Unvon turi qo'shish
          </Button>
        </Flex>

        <DataTable<string>
          data={rankTypes}
          columns={rankTypeColumns}
          loading={isLoading}
          page={1}
          pageSize={rankTypes.length || 1}
          onPageChange={() => undefined}
        />
      </Card>

      <Card styles={{ body: { padding: 'var(--space-5, 20px)' } }}>
        <Flex align="center" justify="space-between" wrap gap={12} style={{ marginBottom: 'var(--space-4, 16px)' }}>
          <Tab options={CATEGORY_OPTIONS} value={tab} onChange={(v) => setTab(v as Category)} />
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd} style={{ height: 40 }}>
            Hujjat qo'shish
          </Button>
        </Flex>

        <Flex gap={8} align="center" style={{ marginBottom: 'var(--space-3, 12px)' }}>
          <Tag color="green" style={{ borderRadius: 6, margin: 0 }}>
            {currentItems.filter((i) => i.required).length} majburiy
          </Tag>
          <Tag style={{ borderRadius: 6, margin: 0 }}>
            {currentItems.length} jami
          </Tag>
        </Flex>

        <Divider style={{ margin: '0 0 var(--space-3, 12px)' }} />

        <DataTable<DocItem>
          data={currentItems}
          columns={columns}
          loading={isLoading}
          page={1}
          pageSize={currentItems.length || 1}
          onPageChange={() => undefined}
        />
      </Card>

      <DocItemModal
        open={editState.open}
        initial={editState.item}
        existingNames={(editState.category === 'rank' ? rank : position).map((i) => i.name)}
        onSubmit={handleModalSubmit}
        onClose={closeEdit}
      />
      <RankTypeModal
        open={rankTypeModal.open}
        initial={rankTypeModal.name}
        existing={rankTypes}
        onSubmit={handleRankTypeSubmit}
        onClose={() => setRankTypeModal({ open: false, name: null })}
      />
    </PageContainer>
  );
}
