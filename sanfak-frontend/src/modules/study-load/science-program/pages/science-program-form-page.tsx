import { useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Formik, type FormikHelpers } from 'formik';
import * as Yup from 'yup';
import { App, Button, Form, Spin, Typography } from 'antd';
import { CloseOutlined, LeftOutlined, RightOutlined, SaveOutlined } from '@ant-design/icons';
import { Stepper, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import SuccessModal from '../../components/success-modal';
import {
  useCreateScienceProgram,
  useUpdateScienceProgram,
  useScienceProgram,
  useMySciences,
  getApiErrorMessage,
} from '../api/science-program-api';
import type {
  ScienceOption,
  ScienceProgramFormValues,
  ScienceProgramPayload,
} from '../model/types';
import StepOne from './steps/step-one';
import StepTwo from './steps/step-two';
import StepThree from './steps/step-three';
import { WizardWrapper, FormWrapper, FormContent, FooterSection } from '../style';

const STEP_TITLES = [
  'scienceProgram.step.general',
  'scienceProgram.step.process',
  'scienceProgram.step.literature',
];

const initialValues: ScienceProgramFormValues = {
  science: '',
  knowledgeArea: [''],
  educationArea: [''],
  directions: [],
  language: '',
  sciencePurpose: '',
  scienceTasks: '',
  responsible: '',
  topics: [{ order: 1, title: '', desc: '' }],

  seminarRecommendationDesc: '',
  independentTaskDesc: '',
  learningOutcomeDesc: '',
  teachingMethodsDesc: '',
  creditRequirementsDesc: '',

  guidanceLiteratureDesc: '',
  primaryLiteratureDesc: '',
  additionalLiteratureDesc: '',
  reviewerDesc: '',
  informationSourceDesc: '',
};

const step1Schema = Yup.object({
  science: Yup.string().required('scienceProgram.validation.scienceRequired'),
});

const step2Schema = Yup.object({});
const step3Schema = Yup.object({});

const STEP_SCHEMAS = [step1Schema, step2Schema, step3Schema];

function toPayload(
  values: ScienceProgramFormValues,
  selectedScience?: ScienceOption | null,
  formVersion?: ScienceProgramPayload['formVersion'],
): ScienceProgramPayload {
  const knowledgeArea = values.knowledgeArea.filter((s) => s.trim().length > 0);
  const educationArea = values.educationArea.filter((s) => s.trim().length > 0);

  return {
    science: values.science,
    ...(formVersion ? { formVersion } : {}),
    academicYear: selectedScience?.academicYear ?? undefined,
    semester: selectedScience?.semester ?? undefined,
    knowledgeArea: knowledgeArea.length > 0 ? knowledgeArea : undefined,
    educationArea: educationArea.length > 0 ? educationArea : undefined,
    directions: values.directions.length > 0 ? values.directions : undefined,
    language: values.language ? values.language : undefined,
    sciencePurpose: values.sciencePurpose ? { desc: values.sciencePurpose } : undefined,
    scienceTasks: values.scienceTasks ? { desc: values.scienceTasks } : undefined,
    responsible: values.responsible ? { title: '', desc: values.responsible } : undefined,
    topics: values.topics.filter((t) => t.title?.trim()),
    seminarRecommendation: values.seminarRecommendationDesc
      ? { desc: values.seminarRecommendationDesc }
      : undefined,
    independentTask: values.independentTaskDesc
      ? { desc: values.independentTaskDesc }
      : undefined,
    learningOutcome: values.learningOutcomeDesc
      ? { desc: values.learningOutcomeDesc }
      : undefined,
    teachingMethods: values.teachingMethodsDesc
      ? { desc: values.teachingMethodsDesc }
      : undefined,
    creditRequirements: values.creditRequirementsDesc
      ? { desc: values.creditRequirementsDesc }
      : undefined,
    guidanceLiterature: values.guidanceLiteratureDesc
      ? { desc: values.guidanceLiteratureDesc }
      : undefined,
    primaryLiterature: values.primaryLiteratureDesc
      ? { desc: values.primaryLiteratureDesc }
      : undefined,
    additionalLiterature: values.additionalLiteratureDesc
      ? { desc: values.additionalLiteratureDesc }
      : undefined,
    reviewer: values.reviewerDesc
      ? { desc: values.reviewerDesc }
      : undefined,
    informationSource: values.informationSourceDesc
      ? { desc: values.informationSourceDesc }
      : undefined,
  };
}

const DRAFT_LIST_PATH = '/study-load/science-programs?tab=draft';
const LIST_PATH = '/study-load/science-programs';

const ScienceProgramFormPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const showModal = useModalStore((s) => s.showModal);
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEditMode = !!id;
  const [activeStep, setActiveStep] = useState(0);

  const handleCancel = (dirty: boolean) => {
    const target = isEditMode ? DRAFT_LIST_PATH : LIST_PATH;
    if (!dirty) {
      navigate(target);
      return;
    }
    modal.confirm({
      title: t('studyLoad.common.leaveConfirmTitle'),
      content: t('studyLoad.common.leaveConfirmText'),
      okText: t('studyLoad.common.leave'),
      cancelText: t('studyLoad.common.stay'),
      okButtonProps: { danger: true },
      onOk: () => navigate(target),
    });
  };

  const formVersionParam = searchParams.get('form') === 'v142' ? 'v142' : undefined;

  const { data: scienceOptions = [], isLoading: sciencesLoading } = useMySciences();
  const { data: existingRecord, isLoading: recordLoading } = useScienceProgram(id ?? '');
  const createMutation = useCreateScienceProgram();
  const updateMutation = useUpdateScienceProgram(id ?? '');

  if (!isEditMode && formVersionParam === 'v142') {
    return <Navigate to="/study-load/science-programs/new-142" replace />;
  }

  const isLastStep = activeStep === STEP_SCHEMAS.length - 1;

  const findScience = (sciId: string): ScienceOption | null =>
    scienceOptions.find((s) => s.id === sciId) ?? null;

  const handleSubmit = async (
    values: ScienceProgramFormValues,
    helpers: FormikHelpers<ScienceProgramFormValues>,
  ) => {
    if (!isLastStep) {
      setActiveStep((s) => s + 1);
      helpers.setSubmitting(false);
      return;
    }

    try {
      if (isEditMode) {
        await updateMutation.mutateAsync(toPayload(values, findScience(values.science)));
        message.success(t('studyLoad.scienceProgram.updated'));
        navigate('/study-load/science-programs');
      } else {
        const created = await createMutation.mutateAsync(
          toPayload(values, findScience(values.science), formVersionParam),
        );
        if (created?.warning) message.warning(created.warning, 8);
        showModal({
          withHeader: false,
          bodyPadding: '40px',
          maxWidth: '460px',
          body: () => (
            <SuccessModal
              title={t('studyLoad.scienceProgram.createdTitle')}
              text={t('studyLoad.scienceProgram.createdText')}
              onClose={() => navigate(DRAFT_LIST_PATH)}
            />
          ),
        });
      }
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      helpers.setSubmitting(false);
    }
  };

  const handleSaveDraft = async (
    values: ScienceProgramFormValues,
    setSubmitting: (v: boolean) => void,
  ) => {
    setSubmitting(true);
    try {
      if (isEditMode) {
        await updateMutation.mutateAsync(toPayload(values, findScience(values.science)));
      } else {
        const created = await createMutation.mutateAsync(
          toPayload(values, findScience(values.science), formVersionParam),
        );
        if (created?.warning) message.warning(created.warning, 8);
      }
      message.success(t('studyLoad.common.draftSaved'));
      navigate(DRAFT_LIST_PATH);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (isEditMode && recordLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Formik
      initialValues={isEditMode && existingRecord ? existingRecord : initialValues}
      validationSchema={STEP_SCHEMAS[activeStep]}
      onSubmit={handleSubmit}
      enableReinitialize
    >
      {(formik) => (
        <Form
          layout="vertical"
          onFinish={() => { void formik.submitForm(); }}
          style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}
        >
          <WizardWrapper>
            <FormWrapper>
              <Typography.Title level={4} style={{ margin: '0 0 24px' }}>
                {isEditMode
                  ? t('studyLoad.scienceProgram.editTitle')
                  : t('studyLoad.scienceProgram.create')}
              </Typography.Title>

              <Stepper current={activeStep} steps={STEP_TITLES} />

              <FormContent>
                {activeStep === 0 ? (
                  <StepOne
                    formik={formik}
                    scienceOptions={scienceOptions}
                    sciencesLoading={sciencesLoading}
                    currentProgramId={isEditMode ? (id ?? null) : null}
                  />
                ) : activeStep === 1 ? (
                  <StepTwo formik={formik} />
                ) : (
                  <StepThree formik={formik} />
                )}
              </FormContent>
            </FormWrapper>

            <FooterSection>
              <div>
                <Button
                  type="text"
                  icon={<CloseOutlined />}
                  onClick={() => handleCancel(formik.dirty)}
                  style={{ height: 40 }}
                >
                  {t('studyLoad.common.cancel')}
                </Button>
                {activeStep > 0 ? (
                  <Button
                    type="link"
                    icon={<LeftOutlined />}
                    onClick={() => setActiveStep((s) => s - 1)}
                    style={{ height: 40 }}
                  >
                    {t('studyLoad.common.back')}
                  </Button>
                ) : null}
              </div>

              <div className="right-buttons">
                <Button
                  type="link"
                  icon={<SaveOutlined />}
                  loading={formik.isSubmitting}
                  onClick={() => { void handleSaveDraft(formik.values, formik.setSubmitting); }}
                >
                  {t('studyLoad.common.saveDraft')}
                </Button>

                <Button
                  type="primary"
                  htmlType="button"
                  icon={isLastStep ? undefined : <RightOutlined />}
                  iconPosition={isLastStep ? undefined : 'end'}
                  loading={formik.isSubmitting}
                  style={{ height: 40 }}
                  onClick={() => { void formik.submitForm(); }}
                >
                  {isLastStep ? t('studyLoad.common.save') : t('studyLoad.common.continue')}
                </Button>
              </div>
            </FooterSection>
          </WizardWrapper>
        </Form>
      )}
    </Formik>
  );
};

export default ScienceProgramFormPage;
