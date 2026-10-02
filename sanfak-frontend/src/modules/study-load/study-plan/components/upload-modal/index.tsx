import { useState } from 'react';
import { Row, Col, DatePicker, Radio, Input } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { Formik, Form as FormikForm } from 'formik';
import * as Yup from 'yup';
import { App, Form, ModalFooter, SelectField, SmallUpload, TextAreaField, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import {
  useCreateStudyPlan,
  useDirections,
  getApiErrorMessage,
  type StudyPlanImportReport,
} from '../../api/study-plan-api';
import {
  useAcademicLevels,
  useEducationForms,
  useReadingForms,
  useSpecializations,
  useStudyPeriods,
} from '../../api/references';
import { FormWrapper, FileLabel, FileError } from './style';

interface FormValues {
  direction: string;
  academicLevel: string;
  educationForm: string;
  readingForm: string;
  specialization: string;
  year: string;
  studyPeriod: string;
  planSource: string;
  basisNote: string;
  comment: string;
}

const initialValues: FormValues = {
  direction: '',
  academicLevel: '',
  educationForm: '',
  readingForm: '',
  specialization: '',
  year: '',
  studyPeriod: '',
  planSource: 'institute',
  basisNote: '',
  comment: '',
};

const schema = Yup.object({
  direction: Yup.string().required('studyLoad.studyPlan.upload.directionRequired'),
  academicLevel: Yup.string().required('studyLoad.studyPlan.upload.academicLevelRequired'),
  educationForm: Yup.string().required('studyLoad.studyPlan.upload.educationFormRequired'),
  readingForm: Yup.string().required('studyLoad.studyPlan.upload.readingFormRequired'),
  specialization: Yup.string().required('studyLoad.studyPlan.upload.specializationRequired'),
  year: Yup.string().required('studyLoad.studyPlan.upload.yearRequired'),
  studyPeriod: Yup.string().required('studyLoad.studyPlan.upload.studyPeriodRequired'),
  planSource: Yup.string().oneOf(['institute', 'ministry']),
  basisNote: Yup.string()
    .max(500, 'studyLoad.studyPlan.upload.basisNoteMaxLength')
    .when('planSource', {
      is: 'ministry',
      then: (s) => s.required('studyLoad.studyPlan.upload.basisNoteRequiredWhenMinistry'),
    }),
  comment: Yup.string(),
});

type Opt = { id: string; title: string };
const toOptions = (list: Opt[]) => list.map((o) => ({ label: o.title, value: o.id }));

export default function UploadForm() {
  const { message, modal } = App.useApp();
  const { t } = useTranslation();
  const hideModal = useModalStore((s) => s.hideModal);

  const [file, setFile] = useState<File | null>(null);
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [planFileError, setPlanFileError] = useState('');

  const createStudyPlan = useCreateStudyPlan();

  const { data: directions = [] } = useDirections();
  const { data: academicLevels = [] } = useAcademicLevels();
  const { data: educationForms = [] } = useEducationForms();
  const { data: readingForms = [] } = useReadingForms();
  const { data: specializations = [] } = useSpecializations();
  const { data: studyPeriods = [] } = useStudyPeriods();

  const handleSubmit = async (values: FormValues) => {
    if (!file) {
      setFileError(t('studyLoad.studyPlan.upload.studyProcessFileRequired'));
    }
    if (!planFile) {
      setPlanFileError(t('studyLoad.studyPlan.upload.studyPlanFileRequired'));
    }
    if (!file || !planFile) return;
    setFileError("");
    setPlanFileError("");

    const fd = new FormData();
    fd.append('direction', values.direction);
    fd.append('academicLevel', values.academicLevel);
    fd.append('educationForm', values.educationForm);
    fd.append('readingForm', values.readingForm);
    fd.append('specialization', values.specialization);
    fd.append('studyPeriod', values.studyPeriod);
    fd.append('year', values.year);
    fd.append('planSource', values.planSource);
    if (values.basisNote) fd.append('basisNote', values.basisNote);
    if (values.comment) fd.append('comment', values.comment);
    fd.append('file', file);
    if (planFile) fd.append('planFile', planFile);

    try {
      const res = await createStudyPlan.mutateAsync(fd);
      message.success(t('studyLoad.studyPlan.upload.success'));
      hideModal();
      showImportReport(res?.import);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const showImportReport = (report?: StudyPlanImportReport) => {
    if (!report || report.unlinkedCount === 0) return;

    const hidden = report.unlinkedDistinct - report.unlinked.length;

    modal.warning({
      title: t('studyLoad.studyPlan.import.title'),
      width: 620,
      okText: t('studyLoad.studyPlan.import.close'),
      content: (
        <div>
          <p>
            {t('studyLoad.studyPlan.import.summary', {
              linked: report.linked,
              total: report.total,
            })}
          </p>
          <p>{t('studyLoad.studyPlan.import.hint')}</p>
          <ul
            style={{
              maxHeight: 220,
              overflowY: 'auto',
              paddingLeft: 20,
              margin: 0,
            }}
          >
            {report.unlinked.map((s) => (
              <li key={`${s.code ?? ''}|${s.title ?? ''}`}>
                {s.code ? `${s.code} — ` : ''}
                {s.title ?? '—'}
              </li>
            ))}
          </ul>
          {hidden > 0 ? (
            <p>{t('studyLoad.studyPlan.import.more', { n: hidden })}</p>
          ) : null}
        </div>
      ),
    });
  };

  return (
    <Formik initialValues={initialValues} validationSchema={schema} onSubmit={handleSubmit}>
      {(formik) => (
        <FormWrapper>
          <FormikForm>
            <Form component={false} layout="vertical">
              <div className="form-body">
                <Row gutter={[12, 24]}>
                  <Col span={24} sm={{ span: 12 }}>
                    <SelectField name="direction" label={t('studyLoad.studyPlan.upload.direction')} placeholder={t('studyLoad.studyPlan.upload.directionPlaceholder')} options={toOptions(directions)} />
                  </Col>
                  <Col span={24} sm={{ span: 12 }}>
                    <SelectField name="academicLevel" label={t('studyLoad.studyPlan.upload.academicLevel')} placeholder={t('studyLoad.studyPlan.upload.academicLevelPlaceholder')} options={toOptions(academicLevels)} />
                  </Col>
                  <Col span={24} sm={{ span: 12 }}>
                    <SelectField name="educationForm" label={t('studyLoad.studyPlan.upload.educationForm')} placeholder={t('studyLoad.studyPlan.upload.educationFormPlaceholder')} options={toOptions(educationForms)} />
                  </Col>
                  <Col span={24} sm={{ span: 12 }}>
                    <SelectField name="readingForm" label={t('studyLoad.studyPlan.upload.readingForm')} placeholder={t('studyLoad.studyPlan.upload.readingFormPlaceholder')} options={toOptions(readingForms)} />
                  </Col>
                  <Col span={24}>
                    <SelectField name="specialization" label={t('studyLoad.studyPlan.upload.specialization')} placeholder={t('studyLoad.studyPlan.upload.specializationPlaceholder')} options={toOptions(specializations)} />
                  </Col>
                  <Col span={24} sm={{ span: 12 }}>
                    <Form.Item
                      label={t('studyLoad.studyPlan.upload.approvedYearLabel')}
                      validateStatus={formik.touched.year && formik.errors.year ? 'error' : ''}
                      help={formik.touched.year && formik.errors.year ? t(formik.errors.year) : undefined}
                    >
                      <DatePicker
                        picker="year"
                        style={{ width: '100%' }}
                        placeholder={t('studyLoad.studyPlan.upload.yearPickerPlaceholder')}
                        value={formik.values.year ? dayjs().year(Number(formik.values.year)) : null}
                        onChange={(_: Dayjs | null, ds: string | string[]) =>
                          formik.setFieldValue('year', Array.isArray(ds) ? ds[0] : ds)
                        }
                        onBlur={() => formik.setFieldTouched('year', true)}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={24} sm={{ span: 12 }}>
                    <SelectField name="studyPeriod" label={t('studyLoad.studyPlan.upload.studyPeriod')} placeholder={t('studyLoad.studyPlan.upload.studyPeriodPlaceholder')} options={toOptions(studyPeriods)} />
                  </Col>
                  <Col span={24}>
                    <Form.Item label={t('studyLoad.studyPlan.upload.planSourceLabel')}>
                      <Radio.Group
                        value={formik.values.planSource}
                        onChange={(e) => formik.setFieldValue('planSource', e.target.value)}
                      >
                        <Radio value="institute">{t('studyLoad.studyPlan.upload.planSourceInstitute')}</Radio>
                        <Radio value="ministry">{t('studyLoad.studyPlan.upload.planSourceMinistry')}</Radio>
                      </Radio.Group>
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item
                      label={
                        formik.values.planSource === 'ministry'
                          ? t('studyLoad.studyPlan.upload.basisNoteLabelRequired')
                          : t('studyLoad.studyPlan.upload.basisNoteLabelOptional')
                      }
                      validateStatus={formik.touched.basisNote && formik.errors.basisNote ? 'error' : ''}
                      help={
                        formik.touched.basisNote && formik.errors.basisNote
                          ? t(formik.errors.basisNote)
                          : undefined
                      }
                    >
                      <Input.TextArea
                        rows={4}
                        maxLength={500}
                        showCount
                        placeholder={t('studyLoad.studyPlan.upload.basisNotePlaceholder')}
                        value={formik.values.basisNote}
                        onChange={(e) => formik.setFieldValue('basisNote', e.target.value)}
                        onBlur={() => formik.setFieldTouched('basisNote', true)}
                      />
                    </Form.Item>
                  </Col>

                  <Col span={24}>
                    <FileLabel>{t('studyLoad.studyPlan.upload.studyProcessFileLabel')}</FileLabel>
                    <SmallUpload
                      value={file ? file.name : null}
                      onFileSelect={(f) => {
                        setFile(f);
                        setFileError('');
                      }}
                      placeholder={t('studyLoad.studyPlan.upload.filePickerPlaceholder')}
                      accept=".xlsx,.xls"
                      width="100%"
                      status={fileError ? 'error' : file ? 'success' : 'idle'}
                    />
                    {fileError && <FileError>{fileError}</FileError>}
                  </Col>
                  <Col span={24}>
                    <FileLabel>{t('studyLoad.studyPlan.upload.studyPlanFileLabel')}</FileLabel>
                    <SmallUpload
                      value={planFile ? planFile.name : null}
                      onFileSelect={(f) => {
                        setPlanFile(f);
                        setPlanFileError("");
                      }}
                      placeholder={t('studyLoad.studyPlan.upload.filePickerPlaceholder')}
                      accept=".xlsx,.xls"
                      width="100%"
                      status={planFileError ? "error" : planFile ? "success" : "idle"}
                    />
                    {planFileError ? <FileError>{planFileError}</FileError> : null}
                  </Col>
                  <Col span={24}>
                    <TextAreaField name="comment" label={t('studyLoad.studyPlan.upload.commentLabel')} placeholder={t('studyLoad.studyPlan.upload.commentPlaceholder')} rows={8} />
                  </Col>
                </Row>
              </div>

              <div className="form-footer">
                <ModalFooter
                  spacing="none"
                  submit
                  cancelLabel={t('studyLoad.common.cancel')}
                  confirmLabel={t('studyLoad.common.save')}
                  loading={createStudyPlan.isPending}
                />
              </div>
            </Form>
          </FormikForm>
        </FormWrapper>
      )}
    </Formik>
  );
}
