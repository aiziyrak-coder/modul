import type { FormikProps } from 'formik';
import { TextAreaField } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import type { ScienceProgramFormValues } from '../../model/types';
import { FormElements, SectionLabel } from '../../style';

interface IProps {
  formik: FormikProps<ScienceProgramFormValues>;
}

const StepTwo = (_: IProps) => {
  const { t } = useTranslation();
  return (
  <FormElements>
    <div>
      <SectionLabel>{t('scienceProgram.section.seminarRecommendation')}</SectionLabel>
      <TextAreaField
        name="seminarRecommendationDesc"
        label="scienceProgram.field.seminarRecommendation"
        placeholder="scienceProgram.field.textareaPlaceholder"
        rows={4}
      />
    </div>

    <div>
      <SectionLabel>{t('scienceProgram.section.independentTask')}</SectionLabel>
      <TextAreaField
        name="independentTaskDesc"
        label="scienceProgram.field.independentTask"
        placeholder="scienceProgram.field.textareaPlaceholder"
        rows={4}
      />
    </div>

    <div>
      <SectionLabel>{t('scienceProgram.section.learningOutcome')}</SectionLabel>
      <TextAreaField
        name="learningOutcomeDesc"
        label="scienceProgram.field.learningOutcome"
        placeholder="scienceProgram.field.textareaPlaceholder"
        rows={4}
      />
    </div>

    <div>
      <SectionLabel>{t('scienceProgram.section.teachingMethods')}</SectionLabel>
      <TextAreaField
        name="teachingMethodsDesc"
        label="scienceProgram.field.teachingMethods"
        placeholder="scienceProgram.field.textareaPlaceholder"
        rows={4}
      />
    </div>

    <div>
      <SectionLabel>{t('scienceProgram.section.creditRequirements')}</SectionLabel>
      <TextAreaField
        name="creditRequirementsDesc"
        label="scienceProgram.field.creditRequirements"
        placeholder="scienceProgram.field.textareaPlaceholder"
        rows={4}
      />
    </div>
  </FormElements>
  );
};

export default StepTwo;
