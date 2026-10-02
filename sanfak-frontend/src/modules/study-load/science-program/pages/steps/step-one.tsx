import type { FormikProps } from 'formik';
import { Alert, App, Col, Input, Row, Button } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { SelectField, TextAreaField } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import type { ScienceProgramFormValues, ScienceOption } from '../../model/types';
import TopicsRepeater from '../../components/topics-repeater';
import DerivedAreaHint from '../../components/derived-area-hint';
import { useDirections } from '../../../study-plan/api/study-plan-api';
import { useWorkingPlanStatus } from '../../api/science-program-api';
import { openPdf } from '../../../lib/open-pdf';
import { getStatusMeta } from '../../../model/status-workflow';
import { findExistingProgram } from '../../lib/existing-program';
import { LANGUAGE_OPTION_KEYS } from '../../lib/v142-defaults';
import { FormElements, SectionLabel, FieldLabel } from '../../style';

interface IProps {
  formik: FormikProps<ScienceProgramFormValues>;
  scienceOptions: ScienceOption[];
  sciencesLoading?: boolean;
  currentProgramId?: string | null;
}

interface RepeaterRowsProps {
  label: string;
  values: string[];
  fieldName: string;
  placeholder: string;
  onAdd: () => void;
  onDelete: (idx: number) => void;
  onChange: (idx: number, val: string) => void;
}

const RepeaterRows = ({
  label,
  values,
  fieldName,
  placeholder,
  onAdd,
  onDelete,
  onChange,
}: RepeaterRowsProps) => {
  const { t } = useTranslation();
  return (
  <div>
    <FieldLabel>{t(label)}</FieldLabel>
    {values.map((val, idx) => (
      <div
        key={idx}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <Input
          name={`${fieldName}[${idx}]`}
          value={val}
          placeholder={t(placeholder)}
          onChange={(e) => onChange(idx, e.target.value)}
          style={{ flex: 1 }}
        />
        {idx === values.length - 1 ? (
          <Button
            type="link"
            icon={<PlusOutlined />}
            onClick={onAdd}
            style={{ padding: '0 8px' }}
          />
        ) : (
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onDelete(idx)}
            style={{ padding: '0 8px' }}
          />
        )}
      </div>
    ))}
  </div>
  );
};

const StepOne = ({ formik, scienceOptions, currentProgramId = null }: IProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const scienceSelectOptions = scienceOptions.map((s) => ({
    label: s.code ? `${s.name} (${s.code})` : s.name,
    value: s.id,
  }));

  const { data: planStatus } = useWorkingPlanStatus(formik.values.science || undefined);
  const planWarning =
    planStatus && !planStatus.hasWorkingPlan ? planStatus.warning : null;
  const existingProgram = findExistingProgram(
    scienceOptions,
    formik.values.science,
    currentProgramId,
  );
  const existingStatusLabel = existingProgram?.programStatus
    ? t(getStatusMeta(existingProgram.programStatus).labelKey)
    : '—';

  const languageOptions = LANGUAGE_OPTION_KEYS.map((o) => ({ label: t(o.labelKey), value: o.value }));

  const { data: directions } = useDirections();
  const directionOptions = (directions ?? []).map((d) => ({
    label: d.title,
    value: d.id,
  }));

  const handleKnowledgeAdd = () => {
    void formik.setFieldValue('knowledgeArea', [...formik.values.knowledgeArea, '']);
  };
  const handleKnowledgeDelete = (idx: number) => {
    void formik.setFieldValue(
      'knowledgeArea',
      formik.values.knowledgeArea.filter((_, i) => i !== idx),
    );
  };
  const handleKnowledgeChange = (idx: number, val: string) => {
    const updated = [...formik.values.knowledgeArea];
    updated[idx] = val;
    void formik.setFieldValue('knowledgeArea', updated);
  };

  const handleEducationAdd = () => {
    void formik.setFieldValue('educationArea', [...formik.values.educationArea, '']);
  };
  const handleEducationDelete = (idx: number) => {
    void formik.setFieldValue(
      'educationArea',
      formik.values.educationArea.filter((_, i) => i !== idx),
    );
  };
  const handleEducationChange = (idx: number, val: string) => {
    const updated = [...formik.values.educationArea];
    updated[idx] = val;
    void formik.setFieldValue('educationArea', updated);
  };

  return (
    <FormElements>
      <SectionLabel>{t('scienceProgram.section.content')}</SectionLabel>

      <SelectField
        name="science"
        label="scienceProgram.field.science"
        placeholder="scienceProgram.field.sciencePlaceholder"
        options={scienceSelectOptions}
      />

      {existingProgram && (
        <Alert
          type="info"
          showIcon
          data-testid="existing-program-alert"
          message={t('scienceProgram.existing.alert', {
            code: existingProgram.programCode ?? '—',
            status: existingStatusLabel,
          })}
          description={t('scienceProgram.existing.hint')}
          action={
            <Button
              size="small"
              onClick={() =>
                void openPdf(`/science-programs/${existingProgram.programId}/pdf`, message, t)
              }
            >
              {t('scienceProgram.existing.viewPdf')}
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {planWarning && (
        <Alert
          type="warning"
          showIcon
          message={planWarning}
          style={{ marginBottom: 16 }}
        />
      )}

      <RepeaterRows
        label="scienceProgram.field.knowledgeArea"
        values={formik.values.knowledgeArea}
        fieldName="knowledgeArea"
        placeholder="scienceProgram.field.knowledgeAreaPlaceholder"
        onAdd={handleKnowledgeAdd}
        onDelete={handleKnowledgeDelete}
        onChange={handleKnowledgeChange}
      />
      <DerivedAreaHint
        field="knowledgeArea"
        ownRows={formik.values.knowledgeArea}
        selectedDirectionIds={formik.values.directions}
        directions={directions}
      />

      <RepeaterRows
        label="scienceProgram.field.educationArea"
        values={formik.values.educationArea}
        fieldName="educationArea"
        placeholder="scienceProgram.field.educationAreaPlaceholder"
        onAdd={handleEducationAdd}
        onDelete={handleEducationDelete}
        onChange={handleEducationChange}
      />
      <DerivedAreaHint
        field="educationArea"
        ownRows={formik.values.educationArea}
        selectedDirectionIds={formik.values.directions}
        directions={directions}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <SelectField
            name="language"
            label="scienceProgram.field.language"
            placeholder="scienceProgram.field.selectPlaceholder"
            options={languageOptions}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <SelectField
            name="directions"
            label="scienceProgram.field.directions"
            placeholder="scienceProgram.field.selectPlaceholder"
            options={directionOptions}
            mode="multiple"
          />
        </Col>
      </Row>

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

      <TextAreaField
        name="responsible"
        label="scienceProgram.field.responsible"
        placeholder="scienceProgram.field.textareaPlaceholder"
        rows={3}
      />

      <TopicsRepeater />
    </FormElements>
  );
};

export default StepOne;
