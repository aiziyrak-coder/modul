import { useMemo } from 'react';
import { useFormikContext } from 'formik';
import { TextAreaField } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import type { V142FormValues } from '../../../model/types';
import { useWorkingPlanStatus } from '../../../api/science-program-api';
import { summarizeTopicHours } from '../../../lib/topic-hours';
import TopicHoursSummary from '../../../components/topic-hours-summary';
import TopicsByTypeRepeater from '../../../components/topics-by-type-repeater';
import IndependentTasksRepeater from '../../../components/independent-tasks-repeater';
import { FormElements, SectionLabel, StickySummary } from '../../../style';

const StepThree = () => {
  const { t } = useTranslation();
  const { values } = useFormikContext<V142FormValues>();

  const { data: planStatus } = useWorkingPlanStatus(values.science || undefined);
  const planItems = planStatus?.planHours?.items ?? null;

  const rows = useMemo(
    () => summarizeTopicHours(values.topics, planItems),
    [values.topics, planItems],
  );

  return (
    <FormElements>
      <StickySummary>
        <TopicHoursSummary rows={rows} hasPlan={Boolean(planItems && planItems.length > 0)} />
      </StickySummary>

      <div>
        <SectionLabel>{t('scienceProgram.v142.section.lessonsTitle')}</SectionLabel>
        <TopicsByTypeRepeater />
      </div>

      <IndependentTasksRepeater />

      <TextAreaField
        name="independentNote"
        label="scienceProgram.v142.independent.note"
        placeholder="scienceProgram.v142.independent.notePlaceholder"
        rows={3}
      />
    </FormElements>
  );
};

export default StepThree;
