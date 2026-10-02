import { useTranslation } from '@/shared/lib/i18n';
import StringListRepeater from '../../../components/string-list-repeater';
import { FormElements, SectionLabel } from '../../../style';

const StepFive = () => {
  const { t } = useTranslation();

  return (
    <FormElements>
      <div>
        <SectionLabel>{t('scienceProgram.v142.section.literature')}</SectionLabel>
        <StringListRepeater
          name="primaryLiterature"
          label="scienceProgram.v142.field.primaryLiterature"
          hint="scienceProgram.v142.field.literatureRefsHint"
         
        />
        <StringListRepeater
          name="additionalLiterature"
          label="scienceProgram.v142.field.additionalLiterature"
         
        />
        <StringListRepeater
          name="informationSources"
          label="scienceProgram.v142.field.informationSources"
         
        />
      </div>
    </FormElements>
  );
};

export default StepFive;
