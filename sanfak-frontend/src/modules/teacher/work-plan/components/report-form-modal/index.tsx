import { Formik, Form as FormikForm } from 'formik';
import * as Yup from 'yup';
import { Col, Row } from 'antd';
import { App, Form, ModalFooter, SelectField, TextAreaField, TextField, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useCreateReport, useUpdateReport, getApiErrorMessage } from '../../api/reports-api';
import type { PersonalReport, ReportFormValues } from '../../model/report-types';
import { SAFE_LINK_RX } from '../../model/safe-link';
import { FormWrapper } from './style';

const schema = Yup.object({
  semester: Yup.number().nullable().required('teacher.personalPlan.reports.form.semesterRequired'),
  text: Yup.string().trim().required('teacher.personalPlan.reports.form.textRequired'),
  councilDecisionFile: Yup.string().trim().matches(SAFE_LINK_RX, {
    message: 'teacher.personalPlan.link.invalid',
    excludeEmptyString: true,
  }),
});

const emptyValues: ReportFormValues = {
  semester: null,
  text: '',
  councilDecisionFile: '',
};

function toInitialValues(report: PersonalReport | null): ReportFormValues {
  if (!report) return emptyValues;
  return {
    semester: report.semester,
    text: report.text,
    councilDecisionFile: report.councilDecisionFile ?? '',
  };
}

interface IProps {
  planId: string;
  academicYearId: string | null;
  report?: PersonalReport | null;
}

const ReportFormModal = ({ planId, academicYearId, report = null }: IProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const isEdit = report !== null;

  const createReport = useCreateReport(planId, academicYearId ?? '');
  const updateReport = useUpdateReport(report?.id ?? '');
  const isPending = createReport.isPending || updateReport.isPending;

  const handleSubmit = async (values: ReportFormValues) => {
    if (!isEdit && !academicYearId) {
      message.error(t('teacher.personalPlan.reports.academicYearMissing'));
      return;
    }
    try {
      if (isEdit && report) {
        await updateReport.mutateAsync(values);
        message.success(t('teacher.personalPlan.reports.updated'));
      } else {
        await createReport.mutateAsync(values);
        message.success(t('teacher.personalPlan.reports.created'));
      }
      hideModal();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  return (
    <Formik
      initialValues={toInitialValues(report)}
      validationSchema={schema}
      onSubmit={handleSubmit}
      enableReinitialize
    >
      <FormWrapper>
        <FormikForm>
          <Form component={false} layout="vertical">
            <div className="form-body">
              <Row gutter={[12, 4]}>
                <Col span={24}>
                  <SelectField
                    name="semester"
                    label="teacher.personalPlan.reports.form.field.semester"
                    placeholder="teacher.personalPlan.reports.form.field.semesterPlaceholder"
                    options={[
                      { label: t('teacher.personalPlan.reports.semester.1'), value: 1 },
                      { label: t('teacher.personalPlan.reports.semester.2'), value: 2 },
                    ]}
                  />
                </Col>
                <Col span={24}>
                  <TextAreaField
                    name="text"
                    label="teacher.personalPlan.reports.form.field.text"
                    placeholder="teacher.personalPlan.reports.form.field.textPlaceholder"
                    rows={6}
                  />
                </Col>
                <Col span={24}>
                  <TextField
                    name="councilDecisionFile"
                    label="teacher.personalPlan.reports.form.field.councilFile"
                    placeholder="teacher.personalPlan.reports.form.field.councilFilePlaceholder"
                  />
                </Col>
              </Row>
            </div>

            <div className="form-footer">
              <ModalFooter
                spacing="none"
                submit
                cancelLabel={t('cancel')}
                confirmLabel={t('save')}
                loading={isPending}
              />
            </div>
          </Form>
        </FormikForm>
      </FormWrapper>
    </Formik>
  );
};

export default ReportFormModal;
