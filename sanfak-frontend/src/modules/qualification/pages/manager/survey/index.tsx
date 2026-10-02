import { useState } from 'react';
import { PageContainer } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useSurveyMutations, useSurveyQuestions } from '../../../api/survey-api';
import SurveyAuthoring from '../../../components/survey-authoring';

const LIMIT = 12;

export default function ManagerSurveyPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(LIMIT);

  const { data, isLoading, isFetching } = useSurveyQuestions(page, limit);
  const { create, update, remove, reorder, bulkCreate } = useSurveyMutations();

  return (
    <PageContainer title={t('qualification.survey.nav')}>
      <SurveyAuthoring
        questions={data?.items ?? []}
        isLoading={isLoading}
        isFetching={isFetching}
        page={page}
        limit={limit}
        total={data?.meta.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setLimit(size);
          setPage(1);
        }}
        createPerm="qualSurvey:create"
        onCreate={async (input) => {
          await create.mutateAsync(input);
        }}
        onUpdate={async (id, input) => {
          await update.mutateAsync({ id, input });
        }}
        onDelete={async (id) => {
          await remove.mutateAsync(id);
        }}
        onReorder={async (items) => {
          await reorder.mutateAsync(items);
        }}
        onBulkCreate={async (items) => {
          await bulkCreate.mutateAsync(items);
          setPage(1);
        }}
      />
    </PageContainer>
  );
}
