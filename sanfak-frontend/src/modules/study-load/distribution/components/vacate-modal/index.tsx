import { Formik, Form as FormikForm } from 'formik';
import { Row, Col, Select, Form, DatePicker, Input } from 'antd';
import dayjs from 'dayjs';
import { App, ModalFooter, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useVacateTeacher, getApiErrorMessage } from '../../api/distribution-api';
import { buildVacatePayload, vacateEmptyValues, type VacateFormValues } from './helper';
import { FormWrapper } from './style';

interface IProps {
  distributionId: string;
  teacherEntryId: string;
}

const VacateModal = ({ distributionId, teacherEntryId }: IProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const vacateTeacher = useVacateTeacher(distributionId);

  const academicTitleOptions = [
    { label: t('studyLoad.distribution.vacateModal.academicTitle.phd'), value: 'phd' },
    { label: t('studyLoad.distribution.vacateModal.academicTitle.docent'), value: 'docent' },
    { label: t('studyLoad.distribution.vacateModal.academicTitle.professor'), value: 'professor' },
  ];

  const handleSubmit = async (values: VacateFormValues) => {
    try {
      await vacateTeacher.mutateAsync({ teacherEntryId, payload: buildVacatePayload(values) });
      message.success(t('studyLoad.distribution.vacateModal.success'));
      hideModal();
    } catch (err) {
      message.error(getApiErrorMessage(err));
    }
  };

  return (
    <Formik initialValues={vacateEmptyValues} onSubmit={handleSubmit}>
      {(formik) => (
        <FormWrapper>
          <FormikForm>
            <Form component={false} layout="vertical">
              <div className="form-body">
                <Row gutter={[12, 8]}>
                  <Col span={24}>
                    <Form.Item label={t('studyLoad.distribution.vacateModal.reasonLabel')}>
                      <Input.TextArea
                        rows={3}
                        value={formik.values.reason}
                        onChange={(e) => void formik.setFieldValue('reason', e.target.value)}
                        style={{ resize: 'none' }}
                      />
                    </Form.Item>
                  </Col>

                  <Col span={24}>
                    <Form.Item
                      label={t('studyLoad.distribution.vacateModal.requiredPositionLabel')}
                    >
                      <Input
                        value={formik.values.requiredPosition}
                        onChange={(e) =>
                          void formik.setFieldValue('requiredPosition', e.target.value)
                        }
                      />
                    </Form.Item>
                  </Col>

                  <Col span={24}>
                    <Form.Item
                      label={t('studyLoad.distribution.vacateModal.requiredSpecializationLabel')}
                    >
                      <Input
                        placeholder={t(
                          'studyLoad.distribution.vacateModal.requiredSpecializationPlaceholder',
                        )}
                        value={formik.values.requiredSpecialization}
                        onChange={(e) =>
                          void formik.setFieldValue('requiredSpecialization', e.target.value)
                        }
                      />
                    </Form.Item>
                  </Col>

                  <Col span={12}>
                    <Form.Item
                      label={t('studyLoad.distribution.vacateModal.requiredAcademicTitleLabel')}
                    >
                      <Select
                        allowClear
                        options={academicTitleOptions}
                        value={formik.values.requiredAcademicTitle || undefined}
                        onChange={(v) =>
                          void formik.setFieldValue('requiredAcademicTitle', v ?? '')
                        }
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>

                  <Col span={12}>
                    <Form.Item label={t('studyLoad.distribution.vacateModal.deadlineLabel')}>
                      <DatePicker
                        style={{ width: '100%' }}
                        value={formik.values.deadline ? dayjs(formik.values.deadline) : null}
                        onChange={(d) =>
                          void formik.setFieldValue('deadline', d ? d.toISOString() : '')
                        }
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
                  danger
                  cancelLabel={t('studyLoad.common.cancel')}
                  confirmLabel={t('studyLoad.distribution.vacateModal.confirm')}
                  loading={vacateTeacher.isPending}
                />
              </div>
            </Form>
          </FormikForm>
        </FormWrapper>
      )}
    </Formik>
  );
};

export default VacateModal;
