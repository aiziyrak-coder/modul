import type { FormikProps } from 'formik';
import { useTranslation } from '@/shared/lib/i18n';
import type { SyllabusFormValues } from '../../model/types';
import { FormElements, SectionLabel } from '../../style';
import KnowledgeRepeater from '../../components/knowledge-repeater';
import SkillsRepeater from '../../components/skills-repeater';
import TopicHourRepeater from '../../components/topic-hour-repeater';
import { useScienceProgramTopics } from '../../api/syllabus-api';

interface IProps {
  formik: FormikProps<SyllabusFormValues>;
}

const StepTwo = ({ formik }: IProps) => {
  const { t } = useTranslation();
  const { data: topicOptions = [] } = useScienceProgramTopics(
    formik.values.scienceProgram,
  );
  return (
  <FormElements>
    <div>
      <SectionLabel>{t('syllabus.section.studyResult')}</SectionLabel>

      <KnowledgeRepeater />

      <SkillsRepeater />
    </div>

    <div>
      <SectionLabel>{t('syllabus.section.scienceContent')}</SectionLabel>

      <TopicHourRepeater
        fieldName="lectures"
        label="syllabus.field.lecture"
        topicOptions={topicOptions}
      />

      <TopicHourRepeater
        fieldName="seminars"
        label="syllabus.field.seminarOrPractice"
        topicOptions={topicOptions}
      />
    </div>
  </FormElements>
  );
};

export default StepTwo;
