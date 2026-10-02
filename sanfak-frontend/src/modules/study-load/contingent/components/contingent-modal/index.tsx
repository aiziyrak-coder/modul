import { Formik, Form as FormikForm } from 'formik';
import * as Yup from 'yup';
import { Row, Col } from 'antd';
import { App, Form, ModalFooter, NumberField, SelectField, TextField, useModalStore } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/lib/i18n';
import {
  useCreateContingent,
  useUpdateContingent,
  useDirectionsRef,
  useCoursesRef,
  useLanguagesRef,
  useAcademicYearsForSelect,
} from '../../api/contingent-api';
import type { Contingent, ContingentFormValues } from '../../model/types';
import { FormWrapper } from './style';

const schema = Yup.object({
  title: Yup.string().trim().required('studyLoad.contingent.form.titleRequired'),
  desc: Yup.string().trim().min(3, 'studyLoad.contingent.form.descMinLength'),
  direction: Yup.string(),
  course: Yup.string(),
  lang: Yup.string(),
  academicYear: Yup.string(),
  studentNumber: Yup.number()
    .min(1, 'studyLoad.contingent.form.studentNumberMin')
    .required('studyLoad.contingent.form.studentNumberRequired'),
});

const emptyValues: ContingentFormValues = {
  title: '',
  desc: '',
  direction: '',
  course: '',
  lang: '',
  academicYear: '',
  studentNumber: 0,
};

function toInitialValues(item: Contingent | null): ContingentFormValues {
  if (!item) return emptyValues;
  return {
    title: item.title,
    desc: item.desc ?? '',
    direction: item.directionId ?? '',
    course: item.courseId ?? '',
    lang: item.langId ?? '',
    academicYear: item.academicYearId ?? '',
    studentNumber: item.studentNumber,
  };
}

interface IProps {
  item?: Contingent | null;
}

const ContingentForm = ({ item = null }: IProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const isEdit = item !== null;

  const createContingent = useCreateContingent();
  const updateContingent = useUpdateContingent();

  const { data: directions = [] } = useDirectionsRef();
  const { data: courses = [] } = useCoursesRef();
  const { data: languages = [] } = useLanguagesRef();
  const { data: academicYears = [] } = useAcademicYearsForSelect();

  const toSelectOptions = (list: { id: string; title: string }[]) =>
    list.map((opt) => ({ label: opt.title, value: opt.id }));

  const handleSubmit = async (values: ContingentFormValues) => {
    try {
      if (isEdit && item) {
        await updateContingent.mutateAsync({ id: item.id, values });
        message.success(t('studyLoad.contingent.updated'));
      } else {
        await createContingent.mutateAsync(values);
        message.success(t('studyLoad.contingent.created'));
      }
      hideModal();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const isPending = createContingent.isPending || updateContingent.isPending;

  return (
    <Formik
      initialValues={toInitialValues(item)}
      validationSchema={schema}
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
                    label="studyLoad.contingent.form.title"
                    placeholder="studyLoad.contingent.form.titlePlaceholder"
                  />
                </Col>

                <Col span={24}>
                  <TextField
                    name="desc"
                    label="studyLoad.contingent.form.desc"
                    placeholder="studyLoad.contingent.form.descPlaceholder"
                  />
                </Col>

                <Col span={24}>
                  <SelectField
                    name="direction"
                    label="studyLoad.contingent.form.direction"
                    placeholder="studyLoad.contingent.form.directionPlaceholder"
                    options={toSelectOptions(directions)}
                  />
                </Col>

                <Col span={24}>
                  <SelectField
                    name="course"
                    label="studyLoad.contingent.form.course"
                    placeholder="studyLoad.contingent.form.coursePlaceholder"
                    options={toSelectOptions(courses)}
                  />
                </Col>

                <Col span={24}>
                  <SelectField
                    name="academicYear"
                    label="studyLoad.contingent.form.academicYear"
                    placeholder="studyLoad.contingent.form.academicYearPlaceholder"
                    options={toSelectOptions(academicYears)}
                  />
                </Col>

                <Col span={24} sm={{ span: 12 }}>
                  <SelectField
                    name="lang"
                    label="studyLoad.contingent.form.lang"
                    placeholder="studyLoad.contingent.form.langPlaceholder"
                    options={toSelectOptions(languages)}
                  />
                </Col>

                <Col span={24} sm={{ span: 12 }}>
                  <NumberField
                    name="studentNumber"
                    label="studyLoad.contingent.form.studentNumber"
                    min={1}
                  />
                </Col>
              </Row>
            </div>

            <div className="form-footer">
              <ModalFooter
                spacing="none"
                submit
                cancelLabel={t('studyLoad.common.cancel')}
                confirmLabel={t('studyLoad.common.save')}
                loading={isPending}
              />
            </div>
          </Form>
        </FormikForm>
      </FormWrapper>
    </Formik>
  );
};

export default ContingentForm;
