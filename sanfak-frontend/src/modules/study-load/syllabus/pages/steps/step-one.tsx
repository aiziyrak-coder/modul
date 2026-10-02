import type { FormikProps } from 'formik';
import { Col, Divider, Row, Typography } from 'antd';
import { SelectField, TextAreaField } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import type { ScienceProgramOption, SyllabusFormValues, SyllabusScience } from '../../model/types';
import ScienceProgramSelect from '../../components/science-program-select';
import { FormElements, InfoGrid, InfoItem, InfoItemLabel, InfoItemValue, SectionLabel } from '../../style';

interface IProps {
  formik: FormikProps<SyllabusFormValues>;
  scienceOptions: { label: string; value: string }[];
  selectedScience: SyllabusScience | null;
  scienceProgramOptions: ScienceProgramOption[];
}

const EVALUATION_FORM_OPTION_KEYS = [
  { labelKey: 'syllabus.option.evaluationForm.exam', value: 'exam' },
  { labelKey: 'syllabus.option.evaluationForm.test', value: 'test' },
  { labelKey: 'syllabus.option.evaluationForm.courseWork', value: 'course_work' },
  { labelKey: 'syllabus.option.evaluationForm.report', value: 'report' },
];

const SCIENCE_LANG_OPTION_KEYS = [
  { labelKey: 'syllabus.option.lang.uz', value: 'uz' },
  { labelKey: 'syllabus.option.lang.ru', value: 'ru' },
  { labelKey: 'syllabus.option.lang.en', value: 'en' },
];

const EDUCATION_FORM_OPTION_KEYS = [
  { labelKey: 'syllabus.option.educationForm.fullTime', value: 'full_time' },
  { labelKey: 'syllabus.option.educationForm.partTime', value: 'part_time' },
  { labelKey: 'syllabus.option.educationForm.evening', value: 'evening' },
];

function displayHour(val: number | null | undefined): string {
  return val !== null && val !== undefined ? String(val) : '—';
}

const StepOne = ({
  formik,
  scienceOptions,
  selectedScience,
  scienceProgramOptions,
}: IProps) => {
  const _ = formik;
  const { t } = useTranslation();

  const evaluationFormOptions = EVALUATION_FORM_OPTION_KEYS.map((o) => ({
    label: t(o.labelKey),
    value: o.value,
  }));
  const scienceLangOptions = SCIENCE_LANG_OPTION_KEYS.map((o) => ({
    label: t(o.labelKey),
    value: o.value,
  }));
  const educationFormOptions = EDUCATION_FORM_OPTION_KEYS.map((o) => ({
    label: t(o.labelKey),
    value: o.value,
  }));

  return (
    <FormElements>
      <SelectField
        name="science"
        label="syllabus.field.science"
        placeholder="syllabus.field.sciencePlaceholder"
        options={scienceOptions}
      />

      {selectedScience !== null ? (
        <>
          <InfoGrid>
            <InfoItem>
              <InfoItemLabel>{t('syllabus.info.scienceName')}</InfoItemLabel>
              <InfoItemValue>{selectedScience.name ?? '—'}</InfoItemValue>
            </InfoItem>
            <InfoItem>
              <InfoItemLabel>{t('syllabus.info.scienceType')}</InfoItemLabel>
              <InfoItemValue>{selectedScience.scienceType ?? '—'}</InfoItemValue>
            </InfoItem>
            <InfoItem>
              <InfoItemLabel>{t('syllabus.info.scienceCode')}</InfoItemLabel>
              <InfoItemValue>{selectedScience.code ?? '—'}</InfoItemValue>
            </InfoItem>
            <InfoItem>
              <InfoItemLabel>{t('syllabus.info.academicYear')}</InfoItemLabel>
              <InfoItemValue>{selectedScience.year ?? '—'}</InfoItemValue>
            </InfoItem>
            <InfoItem>
              <InfoItemLabel>{t('syllabus.info.semester')}</InfoItemLabel>
              <InfoItemValue>{selectedScience.semester ?? '—'}</InfoItemValue>
            </InfoItem>
          </InfoGrid>

          <div>
            <SectionLabel style={{ fontSize: 14, marginBottom: 12 }}>
              {t('syllabus.info.hoursTitle')}
            </SectionLabel>
            <Row gutter={[16, 12]}>
              <Col xs={12} sm={8} md={4}>
                <InfoItem>
                  <InfoItemLabel>{t('syllabus.field.lecture')}</InfoItemLabel>
                  <InfoItemValue>{displayHour(selectedScience.lectureHour)}</InfoItemValue>
                </InfoItem>
              </Col>
              <Col xs={12} sm={8} md={4}>
                <InfoItem>
                  <InfoItemLabel>{t('syllabus.info.practicalHour')}</InfoItemLabel>
                  <InfoItemValue>{displayHour(selectedScience.practicalHour)}</InfoItemValue>
                </InfoItem>
              </Col>
              <Col xs={12} sm={8} md={4}>
                <InfoItem>
                  <InfoItemLabel>{t('syllabus.info.labHour')}</InfoItemLabel>
                  <InfoItemValue>{displayHour(selectedScience.labHour)}</InfoItemValue>
                </InfoItem>
              </Col>
              <Col xs={12} sm={8} md={4}>
                <InfoItem>
                  <InfoItemLabel>{t('syllabus.info.seminarHour')}</InfoItemLabel>
                  <InfoItemValue>{displayHour(selectedScience.seminarHour)}</InfoItemValue>
                </InfoItem>
              </Col>
              <Col xs={12} sm={8} md={4}>
                <InfoItem>
                  <InfoItemLabel>{t('syllabus.field.independentWork')}</InfoItemLabel>
                  <InfoItemValue>{displayHour(selectedScience.independentHour)}</InfoItemValue>
                </InfoItem>
              </Col>
              <Col xs={12} sm={8} md={4}>
                <InfoItem>
                  <InfoItemLabel>{t('syllabus.info.credits')}</InfoItemLabel>
                  <InfoItemValue>{displayHour(selectedScience.credits)}</InfoItemValue>
                </InfoItem>
              </Col>
            </Row>
          </div>

          <Divider style={{ margin: '4px 0' }} />
        </>
      ) : (
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {t('syllabus.field.notSelectedHint')}
        </Typography.Text>
      )}

      <ScienceProgramSelect
        name="scienceProgram"
        label="syllabus.field.scienceProgram"
        placeholder="syllabus.field.scienceProgramPlaceholder"
        options={scienceProgramOptions}
      />

      <SelectField
        name="evaluationForm"
        label="syllabus.field.evaluationForm"
        placeholder="syllabus.field.selectPlaceholder"
        options={evaluationFormOptions}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <SelectField
            name="scienceLang"
            label="syllabus.field.scienceLang"
            placeholder="syllabus.field.selectPlaceholder"
            options={scienceLangOptions}
          />
        </Col>
        <Col xs={24} md={12}>
          <SelectField
            name="educationForm"
            label="syllabus.field.educationForm"
            placeholder="syllabus.field.selectPlaceholder"
            options={educationFormOptions}
          />
        </Col>
      </Row>

      <TextAreaField
        name="prerequisiteKnowledge"
        label="syllabus.field.prerequisiteKnowledge"
        placeholder="syllabus.field.textareaPlaceholder"
        rows={4}
      />
    </FormElements>
  );
};

export default StepOne;
