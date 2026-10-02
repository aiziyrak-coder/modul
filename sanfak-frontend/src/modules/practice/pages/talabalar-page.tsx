import { useEffect, useState } from 'react';
import { PlusOutlined, SwapOutlined } from '@ant-design/icons';
import { App, Button, Checkbox, Flex, Modal, Select, Typography } from 'antd';
import type { ColumnDef } from '@tanstack/react-table';
import { PageContainer, DataTable, ActionButtons, Filters } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { PageHeader } from '../components/page-header';
import { StudentDrawer } from '../components/student-drawer';
import type { PracticeStudent } from '../model/types';
import { usePracticeRole } from '../model/view-role';
import { courseSelectOptions } from '../model/course-number';
import { useServerTable } from '../lib/use-server-table';
import {
  fetchStudentsPage,
  useStudentRemove,
  useBulkCourseTransfer,
  useReferenceList,
} from '../api/practice-api';

export default function TalabalarPage() {
  const { message, modal } = App.useApp();
  const role = usePracticeRole();
  const isDept = role === 'amaliyot_bolimi';

  const [search, setSearch] = useState('');
  const [regionId, setRegionId] = useState<string | undefined>();
  const [directionId, setDirectionId] = useState<string | undefined>();
  const [academicYearId, setAcademicYearId] = useState<string | undefined>();
  const [course, setCourse] = useState<number | undefined>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<{ open: boolean; student: PracticeStudent | null }>({ open: false, student: null });
  const [transfer, setTransfer] = useState<{ open: boolean; toCourse?: number }>({ open: false });

  const { rows, total, page, limit, loading, setPage, setLimit, resetFilters, reload } =
    useServerTable<PracticeStudent>(fetchStudentsPage, { initialLimit: 12 });
  const regions = useReferenceList('regions');
  const directions = useReferenceList('directions');
  const years = useReferenceList('academicYears');
  const courses = useReferenceList('courses');
  const remove = useStudentRemove();
  const bulk = useBulkCourseTransfer();

  const allSelected = rows.length > 0 && rows.every((s) => selected.has(s.id));

  useEffect(() => {
    resetFilters({ search: search || undefined, regionId, directionId, academicYearId, course });
    setSelected(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, regionId, directionId, academicYearId, course]);

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(rows.map((s) => s.id)));

  const handleDelete = (st: PracticeStudent) => {
    modal.confirm({
      title: "Talabani o'chirish",
      content: `"${st.fish}" o'chirilsinmi?`,
      okText: "O'chirish",
      okType: 'danger',
      cancelText: 'Bekor qilish',
      centered: true,
      onOk: async () => {
        try {
          await remove.mutateAsync(st.id);
          message.success("O'chirildi");
          if (page > 1 && rows.length === 1) setPage(page - 1);
          else void reload();
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
    });
  };

  const doTransfer = async () => {
    if (!transfer.toCourse) {
      message.error('Kursni tanlang');
      return;
    }
    try {
      const res = await bulk.mutateAsync({ ids: [...selected], toCourse: transfer.toCourse });
      message.success(`${res.modifiedCount} ta talaba ${transfer.toCourse}-kursga o'tkazildi`);
      setSelected(new Set());
      setTransfer({ open: false });
      void reload();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const [filtersKey, setFiltersKey] = useState(0);
  const clearFilters = () => {
    setRegionId(undefined);
    setDirectionId(undefined);
    setAcademicYearId(undefined);
    setCourse(undefined);
    setSearch('');
    setFiltersKey((k) => k + 1);
  };
  const hasFilter = !!(regionId || directionId || academicYearId || course);

  const opt = (items: { id: string; title: string }[]) =>
    items.map((i) => ({ value: i.id, label: i.title }));
  const courseOpts = courseSelectOptions(courses.data ?? []);

  const columns: ColumnDef<PracticeStudent>[] = [
    ...(isDept
      ? [
          {
            header: () => <Checkbox checked={allSelected} onChange={toggleAll} />,
            id: '_sel',
            size: 44,
            cell: ({ row }) => (
              <Checkbox checked={selected.has(row.original.id)} onChange={() => toggleOne(row.original.id)} />
            ),
          } as ColumnDef<PracticeStudent>,
        ]
      : []),
    { header: 'Talaba', id: 'fish', cell: ({ row }) => row.original.fish },
    { header: 'Guruh', id: 'group', size: 90, cell: ({ row }) => row.original.group },
    { header: 'Kurs', id: 'course', size: 70, cell: ({ row }) => row.original.course },
    { header: "O'quv yili", id: 'year', size: 110, cell: ({ row }) => row.original.academicYear.title },
    { header: "Yo'nalish", id: 'direction', cell: ({ row }) => row.original.direction.title },
    {
      header: 'Hudud',
      id: 'region',
      cell: ({ row }) => `${row.original.region.title}, ${row.original.district.title}`,
    },
    ...(isDept
      ? [
          {
            header: 'Amallar',
            id: '_a',
            size: 120,
            meta: { align: 'right' as const },
            cell: ({ row }) => (
              <ActionButtons
                onEdit={() => setDrawer({ open: true, student: row.original })}
                onDelete={() => handleDelete(row.original)}
                hideToggle
              />
            ),
          } as ColumnDef<PracticeStudent>,
        ]
      : []),
  ];

  return (
    <PageContainer title="Talabalar">
      <PageHeader
        title="Talabalar"
        extra={
          <Flex gap={12} align="center" wrap>
            {isDept && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawer({ open: true, student: null })} style={{ height: 40 }}>
                Talaba qo'shish
              </Button>
            )}
          </Flex>
        }
      />

      <Filters
        key={filtersKey}
        searchValue={search}
        searchPlaceholder="F.I.Sh. yoki guruh bo'yicha"
        onSearch={setSearch}
        selects={[
          { key: 'region', placeholder: 'Viloyat', value: regionId, options: opt(regions.data ?? []), onChange: setRegionId },
          { key: 'course', placeholder: 'Kurs', value: course ? String(course) : undefined, options: courseOpts.map((c) => ({ value: String(c.value), label: c.label, disabled: c.disabled })), onChange: (v) => setCourse(v ? Number(v) : undefined) },
          { key: 'year', placeholder: "O'quv yili", value: academicYearId, options: opt(years.data ?? []), onChange: setAcademicYearId },
          { key: 'direction', placeholder: "Yo'nalish", value: directionId, options: opt(directions.data ?? []), onChange: setDirectionId },
        ]}
        extra={hasFilter ? <Button onClick={clearFilters}>Tozalash</Button> : undefined}
      />

      {isDept && selected.size > 0 && (
        <Flex
          align="center"
          justify="space-between"
          style={{
            marginBottom: 12,
            padding: '10px 16px',
            background: 'var(--color-border-soft, #eef2f6)',
            borderRadius: 'var(--radius-md, 8px)',
          }}
        >
          <Typography.Text>{selected.size} ta talaba tanlandi</Typography.Text>
          <Button type="primary" icon={<SwapOutlined />} onClick={() => setTransfer({ open: true })}>
            Kursdan kursga o'tkazish
          </Button>
        </Flex>
      )}

      <DataTable<PracticeStudent>
        data={rows}
        columns={columns}
        loading={loading}
        page={page}
        pageSize={limit}
        total={total}
        onPageChange={(p) => setPage(p)}
        onPageSizeChange={(size) => setLimit(size)}
      />

      <StudentDrawer
        open={drawer.open}
        student={drawer.student}
        onClose={() => setDrawer({ open: false, student: null })}
        onSuccess={reload}
      />

      <Modal
        open={transfer.open}
        onCancel={() => setTransfer({ open: false })}
        onOk={doTransfer}
        title="Kursdan kursga o'tkazish"
        okText="O'tkazish"
        cancelText="Bekor qilish"
        centered
        confirmLoading={bulk.isPending}
      >
        <Typography.Paragraph>
          Tanlangan {selected.size} ta talaba quyidagi kursga o'tkaziladi:
        </Typography.Paragraph>
        <Select
          style={{ width: '100%' }}
          placeholder="Kursni tanlang"
          value={transfer.toCourse}
          options={courseOpts}
          onChange={(v) => setTransfer((p) => ({ ...p, toCourse: v }))}
        />
      </Modal>
    </PageContainer>
  );
}
