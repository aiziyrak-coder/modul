import { Formik, Form as FormikForm } from 'formik';
import * as Yup from 'yup';
import { Row, Col } from 'antd';
import { App, Form, ModalFooter, SelectField, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage, useCreateDistribution, useWorkloadsForSelect } from '../../api/distribution-api';
import type { DistributionFormValues } from '../../model/types';
import { FormWrapper } from './style';
import SuccessModal from '../../../components/success-modal';

const schema = Yup.object({
  workload: Yup.string().required('studyLoad.distribution.form.workloadRequired'),
});

const emptyValues: DistributionFormValues = { workload: '' };

const DistributionCreateForm = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const showModal = useModalStore((s) => s.showModal);
  const createDistribution = useCreateDistribution();
  const { data: workloads = [] } = useWorkloadsForSelect();

  const workloadOptions = workloads.map((w) => ({ label: w.label, value: w.id }));

  const handleSubmit = async (values: DistributionFormValues) => {
    try {
      await createDistribution.mutateAsync(values);
      showModal({
        withHeader: false,
        maxWidth: '460px',
        bodyPadding: '40px',
        body: () => (
          <SuccessModal
            title={t('studyLoad.distribution.createdTitle')}
            text={t('studyLoad.distribution.createdText')}
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
      <FormWrapper>
        <FormikForm>
          <Form component={false} layout="vertical">
            <div className="form-body">
              <Row gutter={[12, 8]}>
                <Col span={24}>
                  <SelectField
                    name="workload"
                    label="studyLoad.distribution.form.workload"
                    placeholder="studyLoad.distribution.form.workloadPlaceholder"
                    options={workloadOptions}
                  />
                  {workloadOptions.length === 0 ? (
                    <div
                      style={{
                        marginTop: -8,
                        fontSize: 12,
                        lineHeight: 1.5,
                        color: 'var(--color-text-muted, #667085)',
                      }}
                    >
                      {t('studyLoad.distribution.form.noWorkloadHint')}
                    </div>
                  ) : null}
                </Col>
              </Row>
            </div>

            <div className="form-footer">
              <ModalFooter
                spacing="none"
                submit
                cancelLabel={t('studyLoad.common.cancel')}
                confirmLabel={t('studyLoad.common.create')}
                loading={createDistribution.isPending}
              />
            </div>
          </Form>
        </FormikForm>
      </FormWrapper>
    </Formik>
  );
};

export default DistributionCreateForm;
