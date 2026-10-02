import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Formik, type FormikHelpers } from 'formik';
import { App, Button, Form, Spin, Typography } from 'antd';
import { CloseOutlined, LeftOutlined, RightOutlined, SaveOutlined } from '@ant-design/icons';
import { Stepper, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import SuccessModal from '../../components/success-modal';
import {
  useCreateSyllabus,
  useUpdateSyllabus,
  useSyllabus,
  useMyAssignedSciences,
  getApiErrorMessage,
} from '../api/syllabus-api';
import {
  useSciencePrograms,
} from '../../science-program/api/science-program-api';
import type { SyllabusFormValues, SyllabusPayload, SyllabusScience } from '../model/types';
import { buildScienceProgramOptions } from '../lib/science-program-options';
import { STEP_SCHEMAS } from '../lib/step-schemas';
import StepOne from './steps/step-one';
import StepTwo from './steps/step-two';
import StepThree from './steps/step-three';
import { WizardWrapper, FormWrapper, FormContent, FooterSection } from '../style';

const STEP_TITLES = [
  'syllabus.step.general',
  'syllabus.step.outcomes',
  'syllabus.step.independent',
];

const initialValues: SyllabusFormValues = {
  science: '',
  scienceProgram: '',
  evaluationForm: '',
  scienceLang: '',
  educationForm: '',
  prerequisiteKnowledge: '',

  knowledgeOutcomes: [''],
  skillOutcomes: [''],
  lectures: [{ topic: '', hour: 0 }],
  seminars: [{ topic: '', hour: 0 }],

  independentWorks: [{ topic: '', hour: 0 }],
  criteria5: '',
  criteria4: '',
  criteria3: '',
  criteria2: '',
  reviewer: '',
};

function toPayload(
  values: SyllabusFormValues,
  opts?: { finalize?: boolean; science?: SyllabusScience | null },
): SyllabusPayload {
  const sci = opts?.science ?? null;
  const positive = (v: number | null | undefined) => (v && v > 0 ? v : undefined);
  const topics = values.lectures
    .filter((t) => t.topic)
    .map((t) => ({ topic: t.topic, hour: Number(t.hour) }));

  const seminarTopics = values.seminars
    .filter((t) => t.topic)
    .map((t) => ({ topic: t.topic, hour: Number(t.hour) }));

  const independentTopics = values.independentWorks
    .filter((t) => t.topic)
    .map((t) => ({ topic: t.topic, hour: Number(t.hour) }));

  const knowledgeOutcomes = values.knowledgeOutcomes.filter(Boolean);
  const skillOutcomes = values.skillOutcomes.filter(Boolean);

  const criteria = [
    { slug: '5', title: "\"A'lo\" (5)", desc: values.criteria5 },
    { slug: '4', title: "Yaxshi (4)", desc: values.criteria4 },
    { slug: '3', title: "Qoniqarli (3)", desc: values.criteria3 },
    { slug: '2', title: "Qoniqarsiz (2)", desc: values.criteria2 },
  ].filter((c) => c.desc);

  return {
    science: values.science,
    scienceProgram: values.scienceProgram,
    evaluationForm: values.evaluationForm || undefined,
    scienceLang: values.scienceLang || undefined,
    educationForm: values.educationForm || undefined,
    prerequisiteKnowledge: values.prerequisiteKnowledge
      ? { desc: values.prerequisiteKnowledge }
      : undefined,
    learningOutcome:
      knowledgeOutcomes.length > 0 || skillOutcomes.length > 0
        ? { knowledgeOutcomes, skillOutcomes }
        : undefined,
    scienceContent: topics.length > 0 ? { topics } : undefined,
    trainingSeminar: seminarTopics.length > 0 ? { topics: seminarTopics } : undefined,
    independent: independentTopics.length > 0 ? { topics: independentTopics } : undefined,
    evaluationCriteria: criteria.length > 0 ? { criteria } : undefined,
    author: values.reviewer
      ? { reviewer: { desc: values.reviewer } }
      : undefined,
    year: positive(sci?.year),
    semester: positive(sci?.semester),
    finalize: opts?.finalize || undefined,
  };
}

const DRAFT_LIST_PATH = '/study-load/syllabi?tab=draft';
const LIST_PATH = '/study-load/syllabi';

const SyllabusFormPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const showModal = useModalStore((s) => s.showModal);
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const [activeStep, setActiveStep] = useState(0);

  const { data: sciences = [] } = useMyAssignedSciences();
  const { data: scienceProgramsData } = useSciencePrograms({
    page: 1,
    limit: 100,
    status: 'approved',
  });
  const { data: existingRecord, isLoading: recordLoading } = useSyllabus(id ?? '');

  const createMutation = useCreateSyllabus();
  const updateMutation = useUpdateSyllabus(id ?? '');
  const isLastStep = activeStep === STEP_SCHEMAS.length - 1;

  const getScienceById = (sciId: string): SyllabusScience | null => {
    return sciences.find((s) => s.id === sciId) ?? null;
  };

  const scienceOptions = useMemo(
    () => sciences.map((s) => ({
      label: s.code ? `${s.name} (${s.code})` : s.name,
      value: s.id,
    })),
    [sciences],
  );

  const scienceProgramOptions = useMemo(
    () => buildScienceProgramOptions(scienceProgramsData?.items ?? []),
    [scienceProgramsData],
  );

  const blockIfNoProgram = (
    values: SyllabusFormValues,
    setFieldTouched: FormikHelpers<SyllabusFormValues>['setFieldTouched'],
  ): boolean => {
    if (values.scienceProgram) return false;
    setActiveStep(0);
    void setFieldTouched('scienceProgram', true, true);
    message.error(t('syllabus.validation.scienceProgramRequired'));
    return true;
  };

  const handleSubmit = async (
    values: SyllabusFormValues,
    helpers: FormikHelpers<SyllabusFormValues>,
  ) => {
    if (!isLastStep) {
      setActiveStep((s) => s + 1);
      helpers.setSubmitting(false);
      return;
    }

    if (blockIfNoProgram(values, helpers.setFieldTouched)) {
      helpers.setSubmitting(false);
      return;
    }

    try {
      const science = getScienceById(values.science);
      if (isEditMode) {
        await updateMutation.mutateAsync(toPayload(values, { finalize: true, science }));
        message.success(t('studyLoad.syllabus.updated'));
        navigate('/study-load/syllabi');
      } else {
        await createMutation.mutateAsync(toPayload(values, { finalize: true, science }));
        showModal({
          withHeader: false,
          maxWidth: '460px',
          bodyPadding: '40px',
          body: () => (
            <SuccessModal
              title={t('studyLoad.syllabus.createdTitle')}
              onClose={() => navigate('/study-load/syllabi')}
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
    values: SyllabusFormValues,
    helpers: Pick<FormikHelpers<SyllabusFormValues>, 'setSubmitting' | 'setFieldTouched'>,
  ) => {
    if (blockIfNoProgram(values, helpers.setFieldTouched)) return;

    helpers.setSubmitting(true);
    try {
      const science = getScienceById(values.science);
      if (isEditMode) {
        await updateMutation.mutateAsync(toPayload(values, { science }));
      } else {
        await createMutation.mutateAsync(toPayload(values, { science }));
      }
      message.success(t('studyLoad.common.draftSaved'));
      navigate(DRAFT_LIST_PATH);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      helpers.setSubmitting(false);
    }
  };

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
                {isEditMode ? t('studyLoad.syllabus.editTitle') : t('studyLoad.syllabus.create')}
              </Typography.Title>

              <Stepper current={activeStep} steps={STEP_TITLES} />

              <FormContent>
                {activeStep === 0 ? (
                  <StepOne
                    formik={formik}
                    scienceOptions={scienceOptions}
                    selectedScience={getScienceById(formik.values.science)}
                    scienceProgramOptions={scienceProgramOptions}
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
                  onClick={() => { void handleSaveDraft(formik.values, formik); }}
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

export default SyllabusFormPage;
