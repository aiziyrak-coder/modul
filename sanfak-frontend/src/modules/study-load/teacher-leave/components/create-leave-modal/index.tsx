import { Formik, Form as FormikForm } from 'formik';
import { Row, Col, Select, Form, DatePicker, Input } from 'antd';
import dayjs from 'dayjs';
import { App, ModalFooter, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import {
  useCreateTeacherLeave,
  useTeachersForSelect,
  useDistributionsForSelect,
  getApiErrorMessage,
  type CreateTeacherLeaveBody,
} from '../../api/teacher-leave-api';
import SuccessModal from '../../../components/success-modal';
import { FormWrapper } from './style';

import { createLeaveSchema as schema, emptyValues, preventEnterSubmit, type FormValues } from './schema';

const CreateLeaveModal = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const showModal = useModalStore((s) => s.showModal);

  const createLeave = useCreateTeacherLeave();
  const { data: teachers = [] } = useTeachersForSelect();
  const { data: distributions = [] } = useDistributionsForSelect();

  const TYPE_OPTIONS = [
    { label: t('studyLoad.teacherLeave.type.leave'), value: 'leave' },
    { label: t('studyLoad.teacherLeave.type.resignation'), value: 'resignation' },
    { label: t('studyLoad.teacherLeave.type.transfer'), value: 'transfer' },
  ];

  const teacherOptions = teachers.map((t) => ({ label: t.fullName, value: t.id }));
  const distributionOptions = distributions.map((d) => {
    const courseLabel = d.course ? t('studyLoad.common.courseN', { n: d.course }) : null;
    const builtLabel = [d.year, courseLabel].filter(Boolean).join(' · ');
    return { label: d.title ?? (builtLabel || d.id), value: d.id };
  });

  const handleSubmit = async (values: FormValues) => {
    if (!values.type) return;

    const body: CreateTeacherLeaveBody = {
      type: values.type,
      reason: values.reason.trim(),
      fromDate: values.fromDate,
    };
    if (values.teacher) body.teacher = values.teacher;
    if (values.distribution) body.distribution = values.distribution;
    if (values.toDate) body.toDate = values.toDate;

    try {
      await createLeave.mutateAsync(body);
      showModal({
        withHeader: false,
        maxWidth: '460px',
        bodyPadding: '40px',
        body: () => (
          <SuccessModal
            title={t('studyLoad.teacherLeave.submittedTitle')}
            text={t('studyLoad.teacherLeave.submittedText')}
          />
        ),
      });
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  return (
    <Formik
      initialValues={emptyValues}
      validationSchema={schema}
      onSubmit={handleSubmit}
      enableReinitialize
    >
      {(formik) => (
        <FormWrapper>
          <FormikForm onKeyDown={preventEnterSubmit}>
            <Form component={false} layout="vertical">
              <div className="form-body">
                <Row gutter={[12, 8]}>
                  <Col span={24}>
                    <Form.Item
                      label={t('studyLoad.teacherLeave.form.type')}
                      required
                      validateStatus={
                        formik.touched.type && formik.errors.type ? 'error' : ''
                      }
                      help={formik.touched.type && formik.errors.type ? t(formik.errors.type) : undefined}
                    >
                      <Select
                        placeholder={t('studyLoad.teacherLeave.form.typePlaceholder')}
                        options={TYPE_OPTIONS}
                        value={formik.values.type || null}
                        onChange={(v) => void formik.setFieldValue('type', v ?? '')}
                        onBlur={() => void formik.setFieldTouched('type')}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>

                  <Col span={24}>
                    <Form.Item
                      label={t('studyLoad.teacherLeave.form.teacherLabel')}
                    >
                      <Select
                        showSearch
                        allowClear
                        placeholder={t('studyLoad.teacherLeave.form.teacherPlaceholder')}
                        options={teacherOptions}
                        value={formik.values.teacher || null}
                        onChange={(v) => void formik.setFieldValue('teacher', v ?? '')}
                        filterOption={(input, opt) =>
                          String(opt?.label ?? '')
                            .toLowerCase()
                            .includes(input.toLowerCase())
                        }
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>

                  <Col span={24}>
                    <Form.Item
                      label={t('studyLoad.teacherLeave.form.reason')}
                      required
                      validateStatus={formik.touched.reason && formik.errors.reason ? 'error' : ''}
                      help={formik.touched.reason && formik.errors.reason ? t(formik.errors.reason) : undefined}
                    >
                      <Input.TextArea
                        rows={3}
                        placeholder={t('studyLoad.teacherLeave.form.reasonPlaceholder')}
                        value={formik.values.reason}
                        onChange={(e) =>
                          void formik.setFieldValue('reason', e.target.value)
                        }
                        onBlur={() => void formik.setFieldTouched('reason')}
                        style={{ resize: 'none' }}
                      />
                    </Form.Item>
                  </Col>

                  <Col span={24}>
                    <Form.Item label={t('studyLoad.teacherLeave.form.distributionOptional')}>
                      <Select
                        showSearch
                        allowClear
                        placeholder={t('studyLoad.teacherLeave.form.distributionPlaceholder')}
                        options={distributionOptions}
                        value={formik.values.distribution || null}
                        onChange={(v) =>
                          void formik.setFieldValue('distribution', v ?? '')
                        }
                        filterOption={(input, opt) =>
                          String(opt?.label ?? '')
                            .toLowerCase()
                            .includes(input.toLowerCase())
                        }
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>

                  <Col span={12}>
                    <Form.Item
                      label={t('studyLoad.teacherLeave.form.fromDate')}
                      required
                      validateStatus={formik.touched.fromDate && formik.errors.fromDate ? 'error' : ''}
                      help={formik.touched.fromDate && formik.errors.fromDate ? t(formik.errors.fromDate) : undefined}
                    >
                      <DatePicker
                        style={{ width: '100%' }}
                        placeholder={t('studyLoad.teacherLeave.form.datePlaceholder')}
                        value={
                          formik.values.fromDate
                            ? dayjs(formik.values.fromDate)
                            : null
                        }
                        onChange={(d) =>
                          void formik.setFieldValue(
                            'fromDate',
                            d ? d.toISOString() : '',
                          )
                        }
                        onBlur={() => void formik.setFieldTouched('fromDate')}
                        format="DD.MM.YYYY"
                      />
                    </Form.Item>
                  </Col>

                  <Col span={12}>
                    <Form.Item
                      label={t('studyLoad.teacherLeave.form.toDate')}
                      required={formik.values.type === 'leave'}
                      validateStatus={formik.touched.toDate && formik.errors.toDate ? 'error' : ''}
                      help={formik.touched.toDate && formik.errors.toDate ? t(formik.errors.toDate) : undefined}
                    >
                      <DatePicker
                        style={{ width: '100%' }}
                        placeholder={t('studyLoad.teacherLeave.form.datePlaceholder')}
                        value={
                          formik.values.toDate ? dayjs(formik.values.toDate) : null
                        }
                        onChange={(d) =>
                          void formik.setFieldValue(
                            'toDate',
                            d ? d.toISOString() : '',
                          )
                        }
                        onBlur={() => void formik.setFieldTouched('toDate')}
                        format="DD.MM.YYYY"
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              <div className="form-footer">
                <ModalFooter
                  spacing="none"
                  submit
                  cancelLabel={t('studyLoad.common.cancel')}
                  confirmLabel={t('studyLoad.distribution.action.submit')}
                  loading={createLeave.isPending}
                />
              </div>
            </Form>
          </FormikForm>
        </FormWrapper>
      )}
    </Formik>
  );
};

export default CreateLeaveModal;
