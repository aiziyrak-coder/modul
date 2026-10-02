import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { App, Button, Flex, Select, Typography } from 'antd';
import { PageContainer, DataTable, Filters } from '@/shared/ui';
import { TableGap } from '../../../components/table-gap';
import { getApiErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/lib/i18n';
import { useCourse } from '../../../api/course-api';
import { useChangeEducationType, useCourseStudentsPaginated } from '../../../api/student-api';
import { EDU_TYPE } from '../../../model/student.types';
import type { CourseStudent, EduType } from '../../../model/student.types';
import EduTypeTag from '../../../components/edu-type-tag';

const { Title, Text } = Typography;
const BACK = '/qualification/manager/courses';
const LIMIT = 12;
const dash = (v?: string): string => (v && v.length > 0 ? v : '—');

export default function CourseStudentsPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id = '' } = useParams<{ id: string }>();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);
  const [search, setSearch] = useState('');

  const course = useCourse(id);
  const { data, isFetching, refetch } = useCourseStudentsPaginated({
    course: id,
    page,
    limit: pageSize,
    search: search || undefined,
  });
  const change = useChangeEducationType();

  const rows = data?.items ?? [];

  const onChangeEdu = async (row: CourseStudent, value: EduType) => {
    try {
      await change.mutateAsync({ id: row.id, educationType: value });
      message.success(t('qualification.students.changed'));
      void refetch();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const eduOptions = [
    { value: EDU_TYPE.GRANT, label: t('qualification.students.edu.grant') },
    { value: EDU_TYPE.CONTRACT, label: t('qualification.students.edu.contract') },
  ];

  const columns: ColumnDef<CourseStudent, unknown>[] = [
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
      header: t('qualification.students.col.name'),
      accessorKey: 'fullName',
      cell: ({ row }) => <strong>{row.original.fullName}</strong>,
    },
    { header: t('qualification.students.col.passport'), id: 'passport', cell: ({ row }) => dash(row.original.passport) },
    { header: t('qualification.students.col.province'), id: 'province', cell: ({ row }) => dash(row.original.province) },
    { header: t('qualification.students.col.region'), id: 'region', cell: ({ row }) => dash(row.original.region) },
    {
      header: t('qualification.students.col.institution'),
      id: 'institution',
      cell: ({ row }) => dash(row.original.institution),
    },
    { header: t('qualification.students.col.phone'), id: 'phone', cell: ({ row }) => dash(row.original.phone) },
    {
      header: t('qualification.students.col.eduType'),
      id: 'eduType',
      size: 130,
      cell: ({ row }) => <EduTypeTag type={row.original.educationType} />,
    },
    {
      header: t('qualification.students.col.changeEdu'),
      id: 'changeEdu',
      size: 170,
      cell: ({ row }) => (
        <Select
          size="small"
          value={row.original.educationType}
          style={{ width: 150 }}
          options={eduOptions}
          onChange={(v) => onChangeEdu(row.original, v as EduType)}
        />
      ),
    },
  ];

  return (
    <PageContainer title={t('qualification.students.nav')}>
      <Flex align="center" gap={12} style={{ marginBottom: 'var(--space-4)' }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(BACK)} />
        <div>
          <Title level={5} style={{ margin: 0 }}>
            {course.data?.title ?? '—'}
          </Title>
          {course.data?.courseTypeTitle ? (
            <Text type="secondary">{course.data.courseTypeTitle}</Text>
          ) : null}
        </div>
      </Flex>

      <Filters
        searchValue={search}
        searchPlaceholder="qualification.students.searchPh"
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        extra={
          <Text type="secondary">
            {t('qualification.students.count', { count: data?.meta.total ?? 0 })}
          </Text>
        }
      />

      <TableGap>
        <DataTable<CourseStudent>
          data={rows}
          columns={columns}
          loading={isFetching}
          page={page}
          pageSize={pageSize}
          total={data?.meta.total}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      </TableGap>
    </PageContainer>
  );
}
