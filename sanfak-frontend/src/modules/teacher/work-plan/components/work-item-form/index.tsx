import { Formik, Form as FormikForm } from 'formik';
import { Col, Row } from 'antd';
import { App, DateField, Form, ModalFooter, NumberField, SelectField, TextField, useModalStore } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/lib/i18n';
import { useAddActivity, useUpdateActivity } from '../../api/work-plan-api';
import { toWorkItemPayload } from '../../api/mapper';
import type { ActivitySection, WorkItem, WorkItemFormValues } from '../../model/types';
import { toWorkItemInitialValues, workItemValidationSchema } from '../../model/work-item-schema';
import { FormWrapper } from './style';

const VENUE_SECTIONS: ActivitySection[] = ['organizationalWork', 'mentoringWork'];

interface IProps {
  planId: string;
  section: ActivitySection;
  item?: WorkItem | null;
}

const WorkItemForm = ({ planId, section, item = null }: IProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const isEdit = item !== null;
  const showVenue = isEdit && VENUE_SECTIONS.includes(section);

  const addActivity = useAddActivity(planId);
  const updateActivity = useUpdateActivity(planId);
  const isPending = addActivity.isPending || updateActivity.isPending;

  const handleSubmit = async (values: WorkItemFormValues) => {
    try {
      const payload = toWorkItemPayload(values, showVenue);
      if (isEdit && item) {
        await updateActivity.mutateAsync({ activityId: item.id, section, payload });
        message.success(t('teacher.personalPlan.updated'));
      } else {
        await addActivity.mutateAsync({ section, payload });
        message.success(t('teacher.personalPlan.added'));
      }
      hideModal();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  return (
    <Formik
      initialValues={toWorkItemInitialValues(item)}
      validationSchema={workItemValidationSchema}
      onSubmit={handleSubmit}
      enableReinitialize
    >
      <FormWrapper>
        <FormikForm>
          <Form component={false} layout="vertical">
            <div className="form-body">
              <Row gutter={[12, 20]}>
                <Col span={24}>
                  <TextField
                    name="title"
                    label="teacher.personalPlan.form.field.title"
                    placeholder="teacher.personalPlan.form.field.titlePlaceholder"
                  />
                </Col>
                <Col span={12}>
                  <NumberField name="plannedCount" label="teacher.personalPlan.form.field.plannedCount" min={0} />
                </Col>
                <Col span={12}>
                  <SelectField
                    name="semester"
                    label="teacher.personalPlan.form.field.semester"
                    placeholder="teacher.personalPlan.form.field.semesterPlaceholder"
                    mode="multiple"
                    options={[
                      { label: t('teacher.personalPlan.semester.1short'), value: 1 },
                      { label: t('teacher.personalPlan.semester.2short'), value: 2 },
                    ]}
                  />
                </Col>
                <Col span={24}>
                  <DateField name="deadline" label="teacher.personalPlan.form.field.deadline" />
                </Col>
                {showVenue ? (
                  <Col span={24}>
                    <TextField
                      name="venue"
                      label="teacher.personalPlan.form.field.venue"
                      placeholder="teacher.personalPlan.form.field.venuePlaceholder"
                    />
                  </Col>
                ) : null}
              </Row>
            </div>

            <div className="form-footer">
              <ModalFooter spacing="none" submit loading={isPending} />
            </div>
          </Form>
        </FormikForm>
      </FormWrapper>
    </Formik>
  );
};

export default WorkItemForm;
