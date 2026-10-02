import type { FormikProps } from 'formik';
import { TextAreaField } from '@/shared/ui';
import type { ScienceProgramFormValues } from '../../model/types';
import { FormElements } from '../../style';

interface IProps {
  formik: FormikProps<ScienceProgramFormValues>;
}

const StepThree = (_: IProps) => (
  <FormElements>
    <TextAreaField
      name="guidanceLiteratureDesc"
      label="scienceProgram.field.guidanceLiterature"
      placeholder="scienceProgram.field.textareaPlaceholder"
      rows={4}
    />

    <TextAreaField
      name="primaryLiteratureDesc"
      label="scienceProgram.field.primaryLiterature"
      placeholder="scienceProgram.field.textareaPlaceholder"
      rows={4}
    />

    <TextAreaField
      name="additionalLiteratureDesc"
      label="scienceProgram.field.additionalLiterature"
      placeholder="scienceProgram.field.textareaPlaceholder"
      rows={4}
    />

    <TextAreaField
      name="reviewerDesc"
      label="scienceProgram.field.reviewer"
      placeholder="scienceProgram.field.textareaPlaceholder"
      rows={3}
    />

    <TextAreaField
      name="informationSourceDesc"
      label="scienceProgram.field.informationSource"
      placeholder="scienceProgram.field.textareaPlaceholder"
      rows={4}
    />
  </FormElements>
);

export default StepThree;
