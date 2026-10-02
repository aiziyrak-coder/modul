import { useState } from 'react';
import type { AccessTestInput, ReorderItem } from '../../model/access-test.types';
import {
  fetchAllFinalTests,
  useBulkCreateFinalTest,
  useCreateFinalTest,
  useDeleteFinalTest,
  useFinalTests,
  useReorderFinalTest,
  useUpdateFinalTest,
} from '../../api/topic-material-api';
import TestAuthoring from '../test-authoring';

interface IProps {
  courseId: string;
  topicId: string;
}

export default function TopicFinalTestTab({ courseId, topicId }: IProps) {
  const LIMIT = 10;
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useFinalTests(courseId, topicId, page, LIMIT);
  const create = useCreateFinalTest();
  const bulkCreate = useBulkCreateFinalTest();
  const update = useUpdateFinalTest();
  const remove = useDeleteFinalTest();
  const reorder = useReorderFinalTest();

  const onCreate = async (input: AccessTestInput): Promise<string> => {
    const doc = await create.mutateAsync({
      course: courseId,
      topic: topicId,
      testType: input.testType,
      question: input.question,
      options: input.options,
    });
    return doc._id;
  };
  const onBulkCreate = async (items: Omit<AccessTestInput, 'course'>[]) => {
    await bulkCreate.mutateAsync({ course: courseId, topic: topicId, items });
  };
  const onUpdate = async (id: string, input: Omit<AccessTestInput, 'course'>) => {
    await update.mutateAsync({ id, input });
  };
  const onDelete = async (id: string) => {
    await remove.mutateAsync(id);
  };
  const onReorder = async (items: ReorderItem[]) => {
    await reorder.mutateAsync(items);
  };

  return (
    <TestAuthoring
      courseId={courseId}
      kind={3}
      topic={topicId}
      questions={data?.items ?? []}
      isLoading={isLoading}
      isFetching={isFetching}
      page={page}
      total={data?.meta.total ?? 0}
      limit={LIMIT}
      onPageChange={setPage}
      createPerm="qualTopicFinalTest:create"
      showConfig
      compact
      onCreate={onCreate}
      onBulkCreate={onBulkCreate}
      onFetchAll={() => fetchAllFinalTests(courseId, topicId)}
      onUpdate={onUpdate}
      onDelete={onDelete}
      onReorder={onReorder}
    />
  );
}
