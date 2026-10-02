import { useEffect, useState } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { App, Button, Flex, Switch, Tag } from 'antd';
import type { ColumnDef } from '@tanstack/react-table';
import { PageContainer, DataTable, ActionButtons, Filters } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { PageHeader } from '../components/page-header';
import { MemberDrawer } from '../components/member-drawer';
import type { CouncilMember } from '../model/types';
import { useCouncilRole } from '../model/role';
import {
  fetchMembersPage,
  useMembers,
  useMemberRemove,
  useMemberToggleVote,
  useReferenceList,
} from '../api/council-api';
import { useServerTable } from '../lib/use-server-table';

export default function KengashTarkibiPage() {
  const { message, modal } = App.useApp();
  const role = useCouncilRole();
  const isKotib = role === 'ilmiy_kengash_kotibi';

  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState<string | undefined>();
  const [position, setPosition] = useState<string | undefined>();
  const [academicTitle, setAcademicTitle] = useState<string | undefined>();
  const [filtersKey, setFiltersKey] = useState(0);
  const [drawer, setDrawer] = useState<{ open: boolean; member: CouncilMember | null }>({
    open: false,
    member: null,
  });

  const { rows, total, page, limit, loading, setPage, setLimit, resetFilters, reload } =
    useServerTable<CouncilMember>(fetchMembersPage, { initialLimit: 12 });
  const departments = useReferenceList('departments');
  const remove = useMemberRemove();
  const toggleVote = useMemberToggleVote();

  const allMembers = useMembers({});
  const uniqueRefs = (pick: (m: CouncilMember) => CouncilMember['position']) => {
    const seen = new Map<string, string>();
    (allMembers.data ?? []).forEach((m) => {
      const r = pick(m);
      if (r) seen.set(r.id, r.title);
    });
    return [...seen].map(([value, label]) => ({ value, label }));
  };
  const positionOptions = uniqueRefs((m) => m.position);
  const academicTitleOptions = uniqueRefs((m) => m.academicTitle);

  useEffect(() => {
    resetFilters({ search: search || undefined, departmentId, position, academicTitle });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, departmentId, position, academicTitle]);

  const hasActiveFilters = !!search || !!departmentId || !!position || !!academicTitle;
  const clearFilters = () => {
    setSearch('');
    setDepartmentId(undefined);
    setPosition(undefined);
    setAcademicTitle(undefined);
    setFiltersKey((k) => k + 1);
  };

  const handleToggleVote = async (member: CouncilMember, canVote: boolean) => {
    try {
      await toggleVote.mutateAsync({ id: member.id, canVote });
      message.success('Ovoz huquqi yangilandi');
      void reload();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleDelete = (member: CouncilMember) => {
    modal.confirm({
      title: "A'zoni o'chirish",
      content: `"${member.user.fullName}" kengash tarkibidan o'chirilsinmi?`,
      okText: "O'chirish",
      okType: 'danger',
      cancelText: 'Bekor qilish',
      centered: true,
      onOk: async () => {
        try {
          await remove.mutateAsync(member.id);
          message.success("O'chirildi");
          if (page > 1 && rows.length === 1) setPage(page - 1);
          else void reload();
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
    });
  };

  const columns: ColumnDef<CouncilMember>[] = [
    { header: '#', id: '_i', size: 44, cell: ({ row }) => row.index + 1 },
    {
      header: 'F.I.SH',
      id: 'fullName',
      cell: ({ row }) => (
        <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>
          {row.original.user.fullName || '—'}
        </span>
      ),
    },
    {
      header: 'Kafedra',
      id: 'department',
      cell: ({ row }) => row.original.department?.title ?? '—',
    },
    {
      header: 'Lavozim',
      id: 'position',
      cell: ({ row }) => row.original.position?.title ?? '—',
    },
    {
      header: 'Ilmiy unvon',
      id: 'academicTitle',
      cell: ({ row }) =>
        row.original.academicTitle ? (
          <Tag style={{ borderRadius: 6, fontWeight: 500, margin: 0 }}>
            {row.original.academicTitle.title}
          </Tag>
        ) : (
          '—'
        ),
    },
    {
      header: 'Ovoz huquqi',
      id: 'canVote',
      size: 120,
      cell: ({ row }) => (
        <Switch
          checked={row.original.canVote}
          disabled={!isKotib || toggleVote.isPending}
          onChange={(checked) => handleToggleVote(row.original, checked)}
        />
      ),
    },
    {
      header: 'Amallar',
      id: '_a',
      size: 120,
      meta: { align: 'right' as const },
      cell: ({ row }) => (
        <ActionButtons
          onEdit={isKotib ? () => setDrawer({ open: true, member: row.original }) : undefined}
          onDelete={isKotib ? () => handleDelete(row.original) : undefined}
          hideEdit={!isKotib}
          hideDelete={!isKotib}
          hideToggle
        />
      ),
    },
  ];

  return (
    <PageContainer title="Kengash tarkibi">
      <PageHeader
        title="Kengash tarkibi"
        extra={
          <Flex gap={12} align="center" wrap>
            {isKotib && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setDrawer({ open: true, member: null })}
                style={{ height: 40 }}
              >
                A'zo qo'shish
              </Button>
            )}
          </Flex>
        }
      />

      <Filters
        key={filtersKey}
        searchPlaceholder="F.I.SH bo'yicha"
        onSearch={setSearch}
        selects={[
          {
            key: 'department',
            placeholder: 'Kafedra',
            value: departmentId,
            options: (departments.data ?? []).map((d) => ({ value: d.id, label: d.title })),
            onChange: setDepartmentId,
          },
          {
            key: 'position',
            placeholder: 'Lavozim',
            value: position,
            options: positionOptions,
            onChange: setPosition,
          },
          {
            key: 'academicTitle',
            placeholder: 'Unvon',
            value: academicTitle,
            options: academicTitleOptions,
            onChange: setAcademicTitle,
          },
        ]}
        extra={
          hasActiveFilters ? (
            <Button onClick={clearFilters} style={{ height: 38 }}>
              Tozalash
            </Button>
          ) : undefined
        }
      />

      <DataTable<CouncilMember>
        data={rows}
        columns={columns}
        loading={loading}
        page={page}
        pageSize={limit}
        total={total}
        onPageChange={(p) => setPage(p)}
        onPageSizeChange={(size) => setLimit(size)}
      />

      <MemberDrawer
        open={drawer.open}
        member={drawer.member}
        onClose={() => setDrawer({ open: false, member: null })}
        onSuccess={reload}
      />
    </PageContainer>
  );
}
