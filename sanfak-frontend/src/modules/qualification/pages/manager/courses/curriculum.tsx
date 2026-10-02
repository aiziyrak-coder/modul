import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Flex, Typography } from 'antd';
import { PageContainer, DataTable, ActionButtons, useModalStore } from '@/shared/ui';
import { TableGap } from '../../../components/table-gap';
import { getApiErrorMessage } from '@/shared/api';
import { Can } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import { useConfirm } from '../../../lib/use-confirm';
import { useCourse } from '../../../api/course-api';
import { useDeleteTopic, useTopicsByCoursePaginated } from '../../../api/topic-api';
import type { Topic } from '../../../model/topic.types';
import LessonKindTag from '../../../components/lesson-kind-tag';
import TopicForm from '../../../components/topic-form-modal';

const { Title, Text } = Typography;
const BACK = '/qualification/manager/courses';
const LIMIT = 12;

export default function CurriculumPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { confirmDelete } = useConfirm();
  const navigate = useNavigate();
  const { id = '' } = useParams<{ id: string }>();

  const course = useCourse(id);
  const showModal = useModalStore((s) => s.showModal);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);
  const { data, isFetching, refetch } = useTopicsByCoursePaginated({ course: id, page, limit: pageSize });
  const remove = useDeleteTopic();

  const rows = data?.items ?? [];
  const total = data?.meta.total ?? 0;

  const openForm = (topic: Topic | null) =>
    showModal({
      title: topic
        ? t('qualification.curriculum.editTitle')
        : t('qualification.curriculum.addTitle'),
      body: () => <TopicForm courseId={id} defaultOrder={total + 1} editTopic={topic} />,
      maxWidth: '480px',
    });

  const handleDelete = (row: Topic) => {
    confirmDelete(
      async () => {
        try {
          await remove.mutateAsync(row.id);
          message.success(t('qualification.curriculum.deleted'));
          void refetch();
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
      { title: 'qualification.curriculum.deleteTitle', content: 'qualification.curriculum.deleteConfirm' },
    );
  };

  const columns: ColumnDef<Topic, unknown>[] = [
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
      header: t('qualification.curriculum.col.name'),
      accessorKey: 'title',
      cell: ({ row }) => <strong>{row.original.title}</strong>,
    },
    {
      header: t('qualification.curriculum.col.code'),
      id: 'code',
      size: 110,
      cell: ({ row }) =>
        row.original.code || <span style={{ color: 'var(--color-text-soft)' }}>—</span>,
    },
    {
      header: t('qualification.curriculum.col.duration'),
      id: 'duration',
      size: 100,
      cell: ({ row }) => row.original.duration,
    },
    {
      header: t('qualification.curriculum.col.kind'),
      id: 'kind',
      size: 140,
      cell: ({ row }) => <LessonKindTag kind={row.original.kind} />,
    },
    {
      header: t('qualification.curriculum.col.order'),
      accessorKey: 'orderNumber',
      size: 90,
    },
    {
      header: t('actions'),
      id: 'actions',
      size: 110,
      meta: { align: 'center' as const },
      cell: ({ row }) => (
        <ActionButtons
          onEdit={() => openForm(row.original)}
          onDelete={() => handleDelete(row.original)}
          hideToggle
        />
      ),
    },
  ];

  return (
    <PageContainer title={t('qualification.curriculum.nav')}>
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

      <Flex justify="space-between" align="center" style={{ marginBottom: 'var(--space-3)' }}>
        <Text strong>{t('qualification.curriculum.count', { count: total })}</Text>
        <Can perform="qualTopic:create">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openForm(null)}
            style={{ height: 40 }}
          >
            {t('qualification.curriculum.add')}
          </Button>
        </Can>
      </Flex>

      <TableGap>
        <DataTable<Topic>
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
