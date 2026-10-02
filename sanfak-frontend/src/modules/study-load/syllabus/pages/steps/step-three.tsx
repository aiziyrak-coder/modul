import type { FormikProps } from 'formik';
import { TextAreaField } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import type { SyllabusFormValues } from '../../model/types';
import { FormElements, SectionLabel, CriteriaBlock } from '../../style';
import TopicHourRepeater from '../../components/topic-hour-repeater';
import { useScienceProgramTopics } from '../../api/syllabus-api';

interface IProps {
  formik: FormikProps<SyllabusFormValues>;
}

const StepThree = ({ formik }: IProps) => {
  const { t } = useTranslation();
  const { data: topicOptions = [] } = useScienceProgramTopics(
    formik.values.scienceProgram,
  );
  return (
  <FormElements>
    <TopicHourRepeater
      fieldName="independentWorks"
      label="syllabus.field.independentWork"
      topicOptions={topicOptions}
    />

    <div>
      <SectionLabel>{t('syllabus.section.evaluationCriteria')}</SectionLabel>
      <CriteriaBlock>
        <TextAreaField
          name="criteria5"
          label="syllabus.field.criteria5"
          placeholder="syllabus.field.criteriaPlaceholder"
          rows={3}
        />
        <TextAreaField
          name="criteria4"
          label="syllabus.field.criteria4"
          placeholder="syllabus.field.criteriaPlaceholder"
          rows={3}
        />
        <TextAreaField
          name="criteria3"
          label="syllabus.field.criteria3"
          placeholder="syllabus.field.criteriaPlaceholder"
          rows={3}
        />
        <TextAreaField
          name="criteria2"
          label="syllabus.field.criteria2"
          placeholder="syllabus.field.criteriaPlaceholder"
          rows={3}
        />
      </CriteriaBlock>
    </div>

    <TextAreaField
      name="reviewer"
      label="syllabus.field.reviewer"
      placeholder="syllabus.field.textareaPlaceholder"
      rows={4}
    />
  </FormElements>
  );
};

export default StepThree;
