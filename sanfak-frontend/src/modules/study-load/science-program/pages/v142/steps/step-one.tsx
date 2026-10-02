import { useFormikContext } from 'formik';
import { Alert, Col, Row, Spin } from 'antd';
import { SelectField } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import type { ScienceOption, V142FormValues } from '../../../model/types';
import { useDirections } from '../../../../study-plan/api/study-plan-api';
import { useWorkingPlanStatus } from '../../../api/science-program-api';
import { EDUCATION_FORM_OPTION_KEYS, LANGUAGE_OPTION_KEYS } from '../../../lib/v142-defaults';
import AssignedHoursPanel from '../../../components/assigned-hours-panel';
import PlanHoursPanel from '../../../components/plan-hours-panel';
import TextRowsRepeater from '../../../components/text-rows-repeater';
import DerivedAreaHint from '../../../components/derived-area-hint';
import ProtocolFields from '../../../components/protocol-fields';
import PeopleRepeater from '../../../components/people-repeater';
import { FormElements, SectionLabel } from '../../../style';

interface IProps {
  scienceOptions: ScienceOption[];
  sciencesLoading: boolean;
}

const StepOne = ({ scienceOptions, sciencesLoading }: IProps) => {
  const { t } = useTranslation();
  const { values } = useFormikContext<V142FormValues>();

  const scienceSelectOptions = scienceOptions.map((s) => ({
    label: s.code ? `${s.name} (${s.code})` : s.name,
    value: s.id,
  }));
  const selectedScience = scienceOptions.find((s) => s.id === values.science) ?? null;

  const planQuery = useWorkingPlanStatus(values.science || undefined);

  const languageOptions = LANGUAGE_OPTION_KEYS.map((o) => ({ label: t(o.labelKey), value: o.value }));
  const educationFormOptions = EDUCATION_FORM_OPTION_KEYS.map((o) => ({
    label: t(o.labelKey),
    value: o.value,
  }));

  const { data: directions } = useDirections();
  const directionOptions = (directions ?? []).map((d) => ({ label: d.title, value: d.id }));

  return (
    <FormElements>
      <SectionLabel>{t('scienceProgram.v142.section.cover')}</SectionLabel>

      <SelectField
        name="science"
        label="scienceProgram.field.science"
        placeholder="scienceProgram.field.sciencePlaceholder"
        options={scienceSelectOptions}
      />
      {sciencesLoading ? (
        <Spin size="small" aria-label={t('scienceProgram.v142.field.sciencesLoading')} />
      ) : scienceOptions.length === 0 ? (
        <Alert type="info" showIcon message={t('scienceProgram.v142.field.noSciences')} />
      ) : null}

      <AssignedHoursPanel science={selectedScience} />
      {values.science ? (
        <PlanHoursPanel
          status={planQuery.data}
          isLoading={planQuery.isLoading}
          isError={planQuery.isError}
          onRetry={() => {
            void planQuery.refetch();
          }}
        />
      ) : null}

      <Row gutter={[16, 0]}>
        <Col xs={24} md={12}>
          <SelectField
            name="language"
            label="scienceProgram.field.language"
            placeholder="scienceProgram.field.selectPlaceholder"
            options={languageOptions}
          />
        </Col>
        <Col xs={24} md={12}>
          <SelectField
            name="educationForm"
            label="scienceProgram.v142.field.educationForm"
            placeholder="scienceProgram.field.selectPlaceholder"
            options={educationFormOptions}
          />
        </Col>
      </Row>

      <TextRowsRepeater
        name="knowledgeArea"
        label="scienceProgram.field.knowledgeArea"
        placeholder="scienceProgram.field.knowledgeAreaPlaceholder"
      />
      <DerivedAreaHint
        field="knowledgeArea"
        ownRows={values.knowledgeArea}
        selectedDirectionIds={values.directions}
        directions={directions}
      />
      <TextRowsRepeater
        name="educationArea"
        label="scienceProgram.field.educationArea"
        placeholder="scienceProgram.field.educationAreaPlaceholder"
      />
      <DerivedAreaHint
        field="educationArea"
        ownRows={values.educationArea}
        selectedDirectionIds={values.directions}
        directions={directions}
      />

      <SelectField
        name="directions"
        label="scienceProgram.field.directions"
        placeholder="scienceProgram.field.selectPlaceholder"
        options={directionOptions}
        mode="multiple"
      />

      <SectionLabel>{t('scienceProgram.v142.section.page2')}</SectionLabel>
      <ProtocolFields name="councilProtocol" label="scienceProgram.v142.field.councilProtocol" />
      <ProtocolFields
        name="departmentProtocol"
        label="scienceProgram.v142.field.departmentProtocol"
      />
      <PeopleRepeater name="authors" label="scienceProgram.v142.field.authors" />
      <PeopleRepeater name="reviewers" label="scienceProgram.v142.field.reviewers" />
    </FormElements>
  );
};

export default StepOne;
