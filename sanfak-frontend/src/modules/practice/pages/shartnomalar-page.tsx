import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileTextOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Flex } from 'antd';
import dayjs from 'dayjs';
import type { ColumnDef } from '@tanstack/react-table';
import { PageContainer, DataTable, ActionButtons, Filters } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { PageHeader } from '../components/page-header';
import { StatusTabs } from '../components/status-tabs';
import { StatusTag } from '../components/status-tag';
import { EriModal } from '../components/eri-modal';
import { RejectModal } from '../components/reject-modal';
import type { Contract, EriKey } from '../model/types';
import { tabsForRole, visibleStatusesForRole } from '../model/status';
import { usePracticeRole } from '../model/view-role';
import { courseSelectOptions } from '../model/course-number';
import { useServerTable } from '../lib/use-server-table';
import {
  fetchContractsPage,
  useTabsCount,
  useSendToRector,
  useRectorSign,
  useOrgSign,
  useReject,
  useContractRemove,
  useReferenceList,
  useStudents,
} from '../api/practice-api';

const fmt = (d: string) => dayjs(d).format('DD.MM.YYYY');

export default function ShartnomalarPage() {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const role = usePracticeRole();
  const isDept = role === 'amaliyot_bolimi';
  const tabs = useMemo(() => tabsForRole(role), [role]);
  const visible = useMemo(() => visibleStatusesForRole(role), [role]);

  const [activeKey, setActiveKey] = useState('all');
  const [search, setSearch] = useState('');
  const [academicYearId, setAcademicYearId] = useState<string | undefined>();
  const [directionId, setDirectionId] = useState<string | undefined>();
  const [course, setCourse] = useState<number | undefined>();
  const [group, setGroup] = useState<string | undefined>();
  const [eri, setEri] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [reject, setReject] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const { data: counts } = useTabsCount(visible);
  const years = useReferenceList('academicYears');
  const directions = useReferenceList('directions');
  const courses = useReferenceList('courses');
  const courseOpts = courseSelectOptions(courses.data ?? []);
  const groupSource = useStudents({ directionId, course });
  const groupOptions = useMemo(() => {
    const set = new Set((groupSource.data ?? []).map((s) => s.group).filter(Boolean));
    return [...set].sort().map((g) => ({ value: g, label: g }));
  }, [groupSource.data]);

  const [filtersKey, setFiltersKey] = useState(0);
  const clearFilters = () => {
    setAcademicYearId(undefined);
    setDirectionId(undefined);
    setCourse(undefined);
    setGroup(undefined);
    setSearch('');
    setFiltersKey((k) => k + 1);
  };
  const hasFilter = !!(academicYearId || directionId || course || (isDept && group));

  const sendToRector = useSendToRector();
  const rectorSign = useRectorSign();
  const orgSign = useOrgSign();
  const rejectMut = useReject();
  const remove = useContractRemove();

  const activeTab = tabs.find((t) => t.key === activeKey) ?? tabs[0];
  const statusParam = activeTab?.statuses ? activeTab.statuses.join(',') : undefined;

  const { rows, total, page, limit, loading, setPage, setLimit, resetFilters, reload } =
    useServerTable<Contract>(fetchContractsPage, { initialLimit: 12 });

  useEffect(() => {
    resetFilters({
      search: search || undefined,
      status: statusParam,
      academicYearId,
      directionId,
      course,
      group,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusParam, academicYearId, directionId, course, group]);

  const guard = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      message.success(ok);
      if (page > 1 && rows.length === 1) setPage(page - 1);
      else void reload();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleSend = (c: Contract) => {
    modal.confirm({
      title: 'Rektorga yuborish',
      content: `"${c.number}" shartnomasi rektorga tasdiqlashga yuborilsinmi?`,
      okText: 'Yuborish',
      cancelText: 'Bekor qilish',
      centered: true,
      onOk: () => guard(() => sendToRector.mutateAsync(c.id), 'Rektorga yuborildi'),
    });
  };

  const handleDelete = (c: Contract) => {
    modal.confirm({
      title: "Shartnomani o'chirish",
      content: `"${c.number}" o'chirilsinmi?`,
      okText: "O'chirish",
      okType: 'danger',
      cancelText: 'Bekor qilish',
      centered: true,
      onOk: () => guard(() => remove.mutateAsync(c.id), "O'chirildi"),
    });
  };

  const onEriConfirm = async (cert: EriKey) => {
    if (!eri.id) return;
    const fn = role === 'rektor' ? rectorSign : orgSign;
    await guard(() => fn.mutateAsync({ id: eri.id as string, cert }), 'Imzolandi');
    setEri({ open: false, id: null });
  };

  const onRejectConfirm = async (reason: string) => {
    if (!reject.id) return;
    const rejectedBy = role === 'rektor' ? 'rektor' : 'org_head';
    await guard(() => rejectMut.mutateAsync({ id: reject.id as string, reason, rejectedBy }), 'Rad etildi');
    setReject({ open: false, id: null });
  };

  const view = (c: Contract) => navigate(`/amaliyot/shartnomalar/${c.id}`);

  const renderActions = (c: Contract) => {
    if (isDept) {
      if (c.status === 'draft')
        return (
          <ActionButtons
            onView={() => view(c)}
            onSend={() => handleSend(c)}
            onEdit={() => navigate(`/amaliyot/shartnomalar/${c.id}/tahrirlash`)}
            onDelete={() => handleDelete(c)}
            sendLabel="Rektorga yuborish"
            hideToggle
          />
        );
      if (c.status === 'rejected')
        return (
          <ActionButtons
            onView={() => view(c)}
            onEdit={() => navigate(`/amaliyot/shartnomalar/${c.id}/tahrirlash`)}
            onDelete={() => handleDelete(c)}
            hideToggle
          />
        );
      return <ActionButtons onView={() => view(c)} hideToggle hideEdit hideDelete />;
    }
    const pending = role === 'rektor' ? 'in_progress' : 'rektor_approved';
    if (c.status === pending)
      return (
        <ActionButtons
          onView={() => view(c)}
          onConfirm={() => setEri({ open: true, id: c.id })}
          onReturn={() => setReject({ open: true, id: c.id })}
          confirmLabel="Tasdiqlash (ERI)"
          returnLabel="Rad etish"
          hideToggle
        />
      );
    return <ActionButtons onView={() => view(c)} hideToggle hideEdit hideDelete />;
  };

  const columns: ColumnDef<Contract>[] = [
    {
      header: 'Shartnoma',
      id: 'number',
      cell: ({ row }) => (
        <div>
          <div style={{ fontWeight: 500 }}>{row.original.number}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-soft, #697586)' }}>
            {row.original.id}
          </div>
        </div>
      ),
    },
    { header: 'Amaliyot bazasi', id: 'base', cell: ({ row }) => row.original.organization.title },
    { header: "Yo'nalish", id: 'direction', cell: ({ row }) => row.original.direction.title },
    { header: 'Talaba', id: 'students', size: 80, cell: ({ row }) => row.original.studentsCount },
    {
      header: 'Muddat',
      id: 'period',
      cell: ({ row }) => `${fmt(row.original.startDate)} — ${fmt(row.original.endDate)}`,
    },
    {
      header: 'Status',
      id: 'status',
      cell: ({ row }) => <StatusTag status={row.original.status} role={role} />,
    },
    {
      header: 'Amallar',
      id: '_a',
      size: 170,
      meta: { align: 'right' as const },
      cell: ({ row }) => renderActions(row.original),
    },
  ];

  return (
    <PageContainer title="Shartnomalar">
      <PageHeader
        title="Shartnomalar"
        extra={
          <Flex gap={12} align="center" wrap>
            {isDept && (
              <>
                <Button
                  icon={<FileTextOutlined />}
                  onClick={() => navigate('/amaliyot/shartnomalar/shablon')}
                  style={{ height: 40 }}
                >
                  Shartnoma shabloni
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => navigate('/amaliyot/shartnomalar/yangi')}
                  style={{ height: 40 }}
                >
                  Shartnoma shakllantirish
                </Button>
              </>
            )}
          </Flex>
        }
      />

      <StatusTabs tabs={tabs} active={activeKey} counts={counts} onChange={setActiveKey} />

      <Filters
        key={filtersKey}
        searchValue={search}
        searchPlaceholder="Shartnoma raqami yoki amaliyot bazasi"
        onSearch={setSearch}
        selects={
          isDept
            ? [
                { key: 'year', placeholder: "O'quv yili", value: academicYearId, options: (years.data ?? []).map((y) => ({ value: y.id, label: y.title })), onChange: setAcademicYearId },
                { key: 'direction', placeholder: "Yo'nalish", value: directionId, options: (directions.data ?? []).map((d) => ({ value: d.id, label: d.title })), onChange: setDirectionId },
                { key: 'course', placeholder: 'Kurs', value: course ? String(course) : undefined, options: courseOpts.map((c) => ({ value: String(c.value), label: c.label, disabled: c.disabled })), onChange: (v) => setCourse(v ? Number(v) : undefined) },
                { key: 'group', placeholder: 'Guruh', value: group, options: groupOptions, onChange: setGroup },
              ]
            : [
                { key: 'year', placeholder: "O'quv yili", value: academicYearId, options: (years.data ?? []).map((y) => ({ value: y.id, label: y.title })), onChange: setAcademicYearId },
                { key: 'course', placeholder: 'Kurs', value: course ? String(course) : undefined, options: courseOpts.map((c) => ({ value: String(c.value), label: c.label, disabled: c.disabled })), onChange: (v) => setCourse(v ? Number(v) : undefined) },
                { key: 'direction', placeholder: "Yo'nalish", value: directionId, options: (directions.data ?? []).map((d) => ({ value: d.id, label: d.title })), onChange: setDirectionId },
              ]
        }
        extra={hasFilter ? <Button onClick={clearFilters}>Tozalash</Button> : undefined}
      />

      <DataTable<Contract>
        data={rows}
        columns={columns}
        loading={loading}
        page={page}
        pageSize={limit}
        total={total}
        onPageChange={(p) => setPage(p)}
        onPageSizeChange={(size) => setLimit(size)}
        onRowClick={(c) => view(c)}
      />

      <EriModal
        open={eri.open}
        onCancel={() => setEri({ open: false, id: null })}
        onConfirm={onEriConfirm}
        loading={rectorSign.isPending || orgSign.isPending}
      />
      <RejectModal
        open={reject.open}
        onCancel={() => setReject({ open: false, id: null })}
        onConfirm={onRejectConfirm}
        loading={rejectMut.isPending}
      />
    </PageContainer>
  );
}
