import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageContainer } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useCourse } from '../../../../api/course-api';
import {
  fetchAllAccessTests,
  useAccessTestQuestions,
  useBulkCreateAccessTest,
  useCreateAccessTest,
  useDeleteAccessTest,
  useReorderAccessTest,
  useUpdateAccessTest,
} from '../../../../api/access-test-api';
import type { AccessTestInput, ReorderItem } from '../../../../model/access-test.types';
import CourseHeader from '../../../../components/course-header';
import CourseTabs from '../../../../components/course-tabs';
import TestAuthoring from '../../../../components/test-authoring';

export default function TeacherEntranceTestPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id = '' } = useParams<{ id: string }>();

  const [pageSize, setPageSize] = useState(12);
  const [page, setPage] = useState(1);
  const course = useCourse(id);
  const { data, isLoading, isFetching } = useAccessTestQuestions(id, page, pageSize);
  const create = useCreateAccessTest();
  const bulkCreate = useBulkCreateAccessTest();
  const update = useUpdateAccessTest();
  const remove = useDeleteAccessTest();
  const reorder = useReorderAccessTest();

  const onCreate = async (input: AccessTestInput): Promise<string> => {
    const doc = await create.mutateAsync(input);
    return doc._id;
  };
  const onBulkCreate = async (items: Omit<AccessTestInput, 'course'>[]) => {
    await bulkCreate.mutateAsync({ course: id, items });
  };
  const onUpdate = async (qid: string, input: Omit<AccessTestInput, 'course'>) => {
    await update.mutateAsync({ id: qid, input });
  };
  const onDelete = async (qid: string) => {
    await remove.mutateAsync(qid);
  };
  const onReorder = async (items: ReorderItem[]) => {
    await reorder.mutateAsync(items);
  };

  return (
    <PageContainer title={course.data?.title ?? t('qualification.courseTabs.entrance')}>
      <CourseHeader
        course={course.data}
        fallbackTitle={t('qualification.courseTabs.entrance')}
        onBack={() => navigate('/qualification/teacher/courses')}
      />

      <CourseTabs courseId={id} form={course.data?.form} />

      <TestAuthoring
        courseId={id}
        kind={1}
        questions={data?.items ?? []}
        isLoading={isLoading}
        isFetching={isFetching}
        page={page}
        total={data?.meta.total ?? 0}
        limit={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
        createPerm="qualAccessTest:create"
        onCreate={onCreate}
        onBulkCreate={onBulkCreate}
        onFetchAll={() => fetchAllAccessTests(id)}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onReorder={onReorder}
      />
    </PageContainer>
  );
}
