import { TextAreaField } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import StringListRepeater from '../../../components/string-list-repeater';
import { FormElements, SectionLabel } from '../../../style';

const StepFour = () => {
  const { t } = useTranslation();

  return (
    <FormElements>
      <div>
        <SectionLabel>{t('scienceProgram.v142.section.methods')}</SectionLabel>
        <StringListRepeater
          name="techMethods"
          label="scienceProgram.v142.field.techMethods"
          placeholder="scienceProgram.v142.field.techMethodsPlaceholder"
         
        />
      </div>

      <div>
        <SectionLabel>{t('scienceProgram.v142.section.credit')}</SectionLabel>
        <TextAreaField
          name="creditRequirements"
          label="scienceProgram.v142.field.creditRequirements"
          placeholder="scienceProgram.field.textareaPlaceholder"
         
        />
      </div>

      <div>
        <SectionLabel>{t('scienceProgram.v142.section.grading')}</SectionLabel>
        <StringListRepeater name="grading.a" label="scienceProgram.v142.field.gradingA" />
        <StringListRepeater name="grading.b" label="scienceProgram.v142.field.gradingB" />
        <StringListRepeater name="grading.d" label="scienceProgram.v142.field.gradingD" />
        <StringListRepeater name="grading.e" label="scienceProgram.v142.field.gradingE" />
      </div>
    </FormElements>
  );
};

export default StepFour;
