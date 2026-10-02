import { memo } from 'react';
import { Col, DatePicker, Row, Input, Typography } from 'antd';
import { PaperClipOutlined } from '@ant-design/icons';
import { Formik, Form as FormikForm } from 'formik';
import dayjs, { type Dayjs } from 'dayjs';
import { Form, SelectField, SmallUpload } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import type { StudyPlanDetail } from '../../model/detail-types';
import type { RefOption } from '../../api/references';
import { infoSchema, type InfoFormValues } from './schema';
import {
  InfoWrapper,
  InfoData,
  FileRowLabel,
  FileOpenBtn,
} from './style';

const { Text } = Typography;
const { TextArea } = Input;

interface IProps {
  editMode: boolean;
  data: StudyPlanDetail;
  directions: RefOption[];
  academicLevels: RefOption[];
  educationForms: RefOption[];
  readingForms: RefOption[];
  specializations: RefOption[];
  studyPeriods: RefOption[];
  onSubmit: (values: InfoFormValues) => void;
  formRef?: React.RefObject<{ submitForm: () => void } | null>;
}

function toOpts(list: RefOption[]) {
  return list.map((o) => ({ label: o.title, value: o.id }));
}

function initialFromData(data: StudyPlanDetail): InfoFormValues {
  return {
    direction: data.direction?.id ?? '',
    academicLevel: data.academicLevel?.id ?? '',
    educationForm: data.educationForm?.id ?? '',
    readingForm: data.readingForm?.id ?? '',
    specialization: data.specialization?.id ?? '',
    year: data.year ?? '',
    studyPeriod: data.studyPeriod?.id ?? '',
    comment: data.comment ?? '',
    studyProcessFile: null,
    studyPlanFile: null,
  };
}

function fileLabel(url: string | null | undefined): string {
  if (!url) return '';
  const parts = url.split('/');
  return parts[parts.length - 1] ?? url;
}

const StudyPlanInfo = memo(
  ({
    editMode,
    data,
    directions,
    academicLevels,
    educationForms,
    readingForms,
    specializations,
    studyPeriods,
    onSubmit,
    formRef,
  }: IProps) => {
    const initial = initialFromData(data);
    const { t } = useTranslation();

    return (
      <Formik
        initialValues={initial}
        validationSchema={infoSchema}
        onSubmit={onSubmit}
        enableReinitialize
      >
        {(formik) => {
          if (formRef && formRef.current !== undefined) {
            (formRef as React.MutableRefObject<{ submitForm: () => void } | null>).current = {
              submitForm: formik.submitForm,
            };
          }

          return (
            <FormikForm>
              <Form component={false} layout="vertical">
                <InfoWrapper>
                  <div className="left-section">
                    <div className="plan-info">
                      <h3>{t('studyLoad.studyPlan.info.cardTitle')}</h3>

                      {!editMode ? (
                        <InfoData>
                          <Row gutter={[20, 24]}>
                            <Col span={12}>
                              <p>{t('studyLoad.studyPlan.info.direction')}</p>
                              <h2>{data.direction?.title ?? '—'}</h2>
                            </Col>
                            <Col span={12}>
                              <p>{t('studyLoad.studyPlan.info.academicLevel')}</p>
                              <h2>{data.academicLevel?.title ?? '—'}</h2>
                            </Col>
                            <Col span={12}>
                              <p>{t('studyLoad.studyPlan.info.educationForm')}</p>
                              <h2>{data.educationForm?.title ?? '—'}</h2>
                            </Col>
                            <Col span={12}>
                              <p>{t('studyLoad.studyPlan.info.readingForm')}</p>
                              <h2>{data.readingForm?.title ?? '—'}</h2>
                            </Col>
                            <Col span={12}>
                              <p>{t('studyLoad.studyPlan.info.specialization')}</p>
                              <h2>{data.specialization?.title ?? '—'}</h2>
                            </Col>
                            <Col span={12}>
                              <p>{t('studyLoad.studyPlan.info.approvedYearView')}</p>
                              <h2>{data.year ?? '—'}</h2>
                            </Col>
                            <Col span={12}>
                              <p>{t('studyLoad.studyPlan.info.studyPeriod')}</p>
                              <h2>{data.studyPeriod?.title ?? '—'}</h2>
                            </Col>
                          </Row>
                        </InfoData>
                      ) : (
                        <Row gutter={[20, 24]}>
                          <Col span={24} sm={{ span: 12 }}>
                            <SelectField
                              name="direction"
                              label={t('studyLoad.studyPlan.info.direction')}
                              placeholder={t('studyLoad.studyPlan.info.directionPlaceholder')}
                              options={toOpts(directions)}
                            />
                          </Col>
                          <Col span={24} sm={{ span: 12 }}>
                            <SelectField
                              name="academicLevel"
                              label={t('studyLoad.studyPlan.info.academicLevel')}
                              placeholder={t('studyLoad.studyPlan.info.academicLevelPlaceholder')}
                              options={toOpts(academicLevels)}
                            />
                          </Col>
                          <Col span={24} sm={{ span: 12 }}>
                            <SelectField
                              name="educationForm"
                              label={t('studyLoad.studyPlan.info.educationForm')}
                              placeholder={t('studyLoad.studyPlan.info.educationFormPlaceholder')}
                              options={toOpts(educationForms)}
                            />
                          </Col>
                          <Col span={24} sm={{ span: 12 }}>
                            <SelectField
                              name="readingForm"
                              label={t('studyLoad.studyPlan.info.readingForm')}
                              placeholder={t('studyLoad.studyPlan.info.readingFormPlaceholder')}
                              options={toOpts(readingForms)}
                            />
                          </Col>
                          <Col span={24}>
                            <SelectField
                              name="specialization"
                              label={t('studyLoad.studyPlan.info.specialization')}
                              placeholder={t('studyLoad.studyPlan.info.specializationPlaceholder')}
                              options={toOpts(specializations)}
                            />
                          </Col>
                          <Col span={24} sm={{ span: 12 }}>
                            <Form.Item
                              label={t('studyLoad.studyPlan.info.approvedYearLabel')}
                              validateStatus={
                                formik.touched.year && formik.errors.year
                                  ? 'error'
                                  : ''
                              }
                              help={
                                formik.touched.year && formik.errors.year
                                  ? t(formik.errors.year)
                                  : undefined
                              }
                            >
                              <DatePicker
                                picker="year"
                                format="YYYY"
                                style={{ width: '100%' }}
                                placeholder={t('studyLoad.studyPlan.info.yearPickerPlaceholder')}
                                value={
                                  formik.values.year
                                    ? dayjs().year(Number(formik.values.year))
                                    : null
                                }
                                onChange={(
                                  _: Dayjs | null,
                                  ds: string | string[],
                                ) =>
                                  void formik.setFieldValue(
                                    'year',
                                    Array.isArray(ds) ? ds[0] : ds,
                                  )
                                }
                                onBlur={() =>
                                  void formik.setFieldTouched('year', true)
                                }
                              />
                            </Form.Item>
                          </Col>
                          <Col span={24} sm={{ span: 12 }}>
                            <SelectField
                              name="studyPeriod"
                              label={t('studyLoad.studyPlan.info.studyPeriod')}
                              placeholder={t('studyLoad.studyPlan.info.studyPeriodPlaceholder')}
                              options={toOpts(studyPeriods)}
                            />
                          </Col>
                        </Row>
                      )}
                    </div>

                    <div className="plan-file">
                      <Row gutter={[20, 16]}>
                        <Col span={24}>
                          <FileRowLabel>{t('studyLoad.studyPlan.info.studyProcessFile')}</FileRowLabel>
                          {editMode ? (
                            <SmallUpload
                              value={
                                formik.values.studyProcessFile
                                  ? formik.values.studyProcessFile.name
                                  : data.file
                                    ? fileLabel(data.file)
                                    : null
                              }
                              onFileSelect={(f) =>
                                void formik.setFieldValue(
                                  'studyProcessFile',
                                  f,
                                )
                              }
                              placeholder={t('studyLoad.studyPlan.info.filePickerPlaceholder')}
                              accept=".xlsx,.xls"
                              width="100%"
                              status={
                                formik.values.studyProcessFile
                                  ? 'success'
                                  : 'idle'
                              }
                            />
                          ) : data.file ? (
                            <FileOpenBtn
                              type="button"
                              onClick={() =>
                                window.open(data.file!, '_blank', 'noopener')
                              }
                            >
                              <PaperClipOutlined />
                              <span className="file-name">
                                {fileLabel(data.file)}
                              </span>
                            </FileOpenBtn>
                          ) : (
                            <Text type="secondary" style={{ fontSize: 13 }}>
                              {t('studyLoad.studyPlan.info.fileNotUploaded')}
                            </Text>
                          )}
                        </Col>

                        <Col span={24}>
                          <FileRowLabel>{t('studyLoad.studyPlan.info.studyPlanFile')}</FileRowLabel>
                          {editMode ? (
                            <SmallUpload
                              value={
                                formik.values.studyPlanFile
                                  ? formik.values.studyPlanFile.name
                                  : data.planFile
                                    ? fileLabel(data.planFile)
                                    : null
                              }
                              onFileSelect={(f) =>
                                void formik.setFieldValue('studyPlanFile', f)
                              }
                              placeholder={t('studyLoad.studyPlan.info.filePickerPlaceholder')}
                              accept=".xlsx,.xls"
                              width="100%"
                              status={
                                formik.values.studyPlanFile ? 'success' : 'idle'
                              }
                            />
                          ) : data.planFile ? (
                            <FileOpenBtn
                              type="button"
                              onClick={() =>
                                window.open(
                                  data.planFile!,
                                  '_blank',
                                  'noopener',
                                )
                              }
                            >
                              <PaperClipOutlined />
                              <span className="file-name">
                                {fileLabel(data.planFile)}
                              </span>
                            </FileOpenBtn>
                          ) : (
                            <Text type="secondary" style={{ fontSize: 13 }}>
                              {t('studyLoad.studyPlan.info.fileNotUploaded')}
                            </Text>
                          )}
                        </Col>
                      </Row>
                    </div>
                  </div>

                  <div className="right-section">
                    <h2>{t('studyLoad.studyPlan.info.commentHeading')}</h2>
                    <div className="comment-block">
                      {editMode ? (
                        <TextArea
                          rows={8}
                          placeholder={t('studyLoad.studyPlan.info.commentPlaceholder')}
                          value={formik.values.comment}
                          onChange={(e) =>
                            void formik.setFieldValue(
                              'comment',
                              e.target.value,
                            )
                          }
                          style={{ resize: 'vertical', width: '100%' }}
                        />
                      ) : data.comment ? (
                        data.comment
                      ) : (
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          {t('studyLoad.studyPlan.info.commentEmpty')}
                        </Text>
                      )}
                    </div>
                  </div>
                </InfoWrapper>
              </Form>
            </FormikForm>
          );
        }}
      </Formik>
    );
  },
);

StudyPlanInfo.displayName = 'StudyPlanInfo';

export default StudyPlanInfo;
