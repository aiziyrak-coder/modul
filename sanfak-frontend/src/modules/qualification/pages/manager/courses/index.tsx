import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { App, Button, DatePicker, Flex, Input, Select, Tag } from 'antd';
import dayjs from 'dayjs';
import { PageContainer, DataTable } from '@/shared/ui';
import { TableGap } from '../../../components/table-gap';
import { getApiErrorMessage } from '@/shared/api';
import { Can } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import { useConfirm } from '../../../lib/use-confirm';
import { useCoursesPaginated, useDeleteCourse } from '../../../api/course-api';
import { COURSE_STATUS, EDU_FORM } from '../../../model/course.types';
import type { Course } from '../../../model/course.types';
import CourseStatusTag from '../../../components/course-status-tag';
import CourseActions from '../../../components/course-actions';

const { RangePicker } = DatePicker;
const LIMIT = 12;
const FILTER_H = 38;

const fmtDate = (d?: string): string => (d ? dayjs(d).format('DD.MM.YYYY') : '—');

export default function CoursesPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { confirmDelete } = useConfirm();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [form, setForm] = useState<string | undefined>(undefined);
  const [range, setRange] = useState<[string, string] | null>(null);

  const { data, isFetching, refetch } = useCoursesPaginated({
    page,
    limit: pageSize,
    search: search || undefined,
    status: status ? Number(status) : undefined,
    form: form ? Number(form) : undefined,
    startDate: range?.[0],
    endDate: range?.[1],
  });
  const remove = useDeleteCourse();

  const rows = data?.items ?? [];

  const handleDelete = (row: Course) => {
    confirmDelete(
      async () => {
        try {
          await remove.mutateAsync(row.id);
          message.success(t('qualification.courses.deleted'));
          void refetch();
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
      { title: 'qualification.courses.deleteTitle', content: 'qualification.courses.deleteConfirm' },
    );
  };

  const columns: ColumnDef<Course, unknown>[] = [
    {
      header: '#',
      id: 'idx',
      size: 48,
      cell: ({ row }) => (
        <span style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {(page - 1) * pageSize + row.index + 1}
        </span>
      ),
    },
    {
      header: t('qualification.courses.col.name'),
      accessorKey: 'title',
      cell: ({ row }) => <strong>{row.original.title}</strong>,
    },
    {
      header: t('qualification.courses.col.courseType'),
      id: 'courseType',
      cell: ({ row }) =>
        row.original.courseTypeTitle || <span style={{ color: 'var(--color-text-soft)' }}>—</span>,
    },
    {
      header: t('qualification.courses.col.price'),
      id: 'price',
      cell: ({ row }) => row.original.price.toLocaleString('ru-RU'),
    },
    {
      header: t('qualification.courses.col.credit'),
      accessorKey: 'creditHours',
      size: 90,
    },
    {
      header: t('qualification.courses.col.start'),
      id: 'start',
      size: 120,
      cell: ({ row }) => fmtDate(row.original.startDate),
    },
    {
      header: t('qualification.courses.col.end'),
      id: 'end',
      size: 120,
      cell: ({ row }) => fmtDate(row.original.endDate),
    },
    {
      header: t('qualification.courses.col.listeners'),
      id: 'listeners',
      size: 120,
      cell: ({ row }) => `${row.original.totalSubscribers}/${row.original.listenersLimit}`,
    },
    {
      header: t('qualification.courses.col.status'),
      id: 'status',
      size: 130,
      cell: ({ row }) => <CourseStatusTag status={row.original.status} />,
    },
    {
      header: t('qualification.courses.col.form'),
      id: 'form',
      size: 110,
      cell: ({ row }) =>
        row.original.form === EDU_FORM.ONLINE ? (
          <Tag color="blue">{t('qualification.courses.form.online')}</Tag>
        ) : (
          <Tag color="gold">{t('qualification.courses.form.offline')}</Tag>
        ),
    },
    {
      header: t('actions'),
      id: 'actions',
      size: 150,
      meta: { align: 'center' as const },
      cell: ({ row }) => (
        <CourseActions
          status={row.original.status}
          form={row.original.form}
          onStudents={() => navigate(`/qualification/manager/courses/${row.original.id}/students`)}
          onCurriculum={() =>
            navigate(`/qualification/manager/courses/${row.original.id}/curriculum`)
          }
          onEdit={() => navigate(`/qualification/manager/courses/${row.original.id}/edit`)}
          onDelete={() => handleDelete(row.original)}
        />
      ),
    },
  ];

  const formOptions: { value: string; label: string }[] = [
    { value: String(EDU_FORM.ONLINE), label: t('qualification.courses.form.online') },
    { value: String(EDU_FORM.OFFLINE), label: t('qualification.courses.form.offline') },
  ];

  const statusOptions: { value: string; label: string }[] = [
    { value: String(COURSE_STATUS.PLANNED), label: t('qualification.courses.status.planned') },
    { value: String(COURSE_STATUS.ACTIVE), label: t('qualification.courses.status.active') },
    { value: String(COURSE_STATUS.FINISHED), label: t('qualification.courses.status.finished') },
  ];

  return (
    <PageContainer title={t('qualification.courses.nav')}>
      <Flex wrap gap={12} align="center" style={{ marginBottom: 'var(--space-4)' }}>
        <Input
          prefix={<SearchOutlined style={{ color: 'var(--color-text-mute, #9aa3b2)' }} />}
          placeholder={t('qualification.courses.searchPh')}
          allowClear
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          style={{ width: 260, height: FILTER_H }}
        />
        <Select
          placeholder={t('qualification.courses.col.status')}
          value={status}
          options={statusOptions}
          allowClear
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          style={{ width: 170, height: FILTER_H }}
        />
        <Select
          placeholder={t('qualification.courses.col.form')}
          value={form}
          options={formOptions}
          allowClear
          onChange={(v) => {
            setForm(v);
            setPage(1);
          }}
          style={{ width: 170, height: FILTER_H }}
        />
        <RangePicker
          value={range ? [dayjs(range[0]), dayjs(range[1])] : null}
          onChange={(_, ds) => {
            setRange(ds[0] && ds[1] ? [ds[0], ds[1]] : null);
            setPage(1);
          }}
          format="YYYY-MM-DD"
          placeholder={[t('qualification.courses.dateFrom'), t('qualification.courses.dateTo')]}
          style={{ height: FILTER_H, width: 240 }}
        />
        <div style={{ flex: 1, minWidth: 12 }} />
        <Can perform="qualCourse:create">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/qualification/manager/courses/create')}
            style={{ height: FILTER_H }}
          >
            {t('qualification.courses.add')}
          </Button>
        </Can>
      </Flex>

      <TableGap>
        <DataTable<Course>
          data={rows}
          columns={columns}
          loading={isFetching}
          page={page}
          pageSize={pageSize}
          total={data?.meta.total}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      </TableGap>
    </PageContainer>
  );
}
