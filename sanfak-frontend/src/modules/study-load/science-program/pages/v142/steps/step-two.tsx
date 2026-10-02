import { useFormikContext } from 'formik';
import { TextAreaField } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import type { V142FormValues } from '../../../model/types';
import PrerequisitesRepeater from '../../../components/prerequisites-repeater';
import CodeTextRepeater from '../../../components/code-text-repeater';
import { FormElements, SectionLabel } from '../../../style';

const StepTwo = () => {
  const { t } = useTranslation();
  const { values } = useFormikContext<V142FormValues>();

  return (
    <FormElements>
      <div>
        <SectionLabel>{t('scienceProgram.v142.section.content')}</SectionLabel>
        <TextAreaField
          name="sciencePurpose"
          label="scienceProgram.field.sciencePurpose"
          placeholder="scienceProgram.field.textareaPlaceholder"
          rows={4}
        />
        <TextAreaField
          name="scienceTasks"
          label="scienceProgram.field.scienceTasks"
          placeholder="scienceProgram.field.textareaPlaceholder"
          rows={4}
        />
      </div>

      <PrerequisitesRepeater />

      <div>
        <SectionLabel>{t('scienceProgram.v142.section.outcomes')}</SectionLabel>
        <FormElements>
          <CodeTextRepeater name="competencies" label="scienceProgram.v142.field.competencies" />
          <CodeTextRepeater
            name="skills"
            label="scienceProgram.v142.field.skills"
            codeOffset={values.competencies.length}
          />
        </FormElements>
      </div>
    </FormElements>
  );
};

export default StepTwo;
