import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Formik, useFormikContext, type FormikHelpers } from 'formik';
import { Alert, App, Button, Form, Spin, Typography } from 'antd';
import { LeftOutlined, ReloadOutlined, RightOutlined, SaveOutlined } from '@ant-design/icons';
import { Stepper, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import SuccessModal from '../../../components/success-modal';
import {
  useCreateScienceProgram,
  useUpdateScienceProgram,
  useScienceProgramV142,
  useMySciences,
  useWorkingPlanStatus,
  getApiErrorMessage,
} from '../../api/science-program-api';
import { toV142Payload } from '../../api/mapper';
import type { ScienceOption, V142FormValues } from '../../model/types';
import {
  LITERATURE_GROUP_TITLES,
  TOPIC_TYPE_LABEL_KEY,
  V142_INITIAL_VALUES,
} from '../../lib/v142-defaults';
import { V142_STEP_SCHEMAS } from '../../lib/v142-step-schemas';
import { hasHoursMismatch, mismatchedRows, summarizeTopicHours } from '../../lib/topic-hours';
import StepOne from './steps/step-one';
import StepTwo from './steps/step-two';
import StepThree from './steps/step-three';
import StepFour from './steps/step-four';
import StepFive from './steps/step-five';
import { WizardWrapper, FormWrapper, FormContent, FooterSection } from '../../style';

const STEP_TITLES = [
  'scienceProgram.v142.step.general',
  'scienceProgram.v142.step.content',
  'scienceProgram.v142.step.lessons',
  'scienceProgram.v142.step.methods',
  'scienceProgram.v142.step.literature',
];

const LIST_PATH = '/study-load/science-programs';
const DRAFT_LIST_PATH = '/study-load/science-programs?tab=draft';

interface ShellProps {
  isEditMode: boolean;
  locked: boolean;
  activeStep: number;
  setActiveStep: (updater: (s: number) => number) => void;
  scienceOptions: ScienceOption[];
  sciencesLoading: boolean;
  onSaveDraft: (values: V142FormValues, setSubmitting: (v: boolean) => void) => Promise<void>;
}

const WizardShell = ({
  isEditMode,
  locked,
  activeStep,
  setActiveStep,
  scienceOptions,
  sciencesLoading,
  onSaveDraft,
}: ShellProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { modal } = App.useApp();
  const formik = useFormikContext<V142FormValues>();
  const isLastStep = activeStep === V142_STEP_SCHEMAS.length - 1;

  const { data: planStatus } = useWorkingPlanStatus(formik.values.science || undefined);

  const handleCancel = () => {
    if (!formik.dirty || locked) {
      navigate(LIST_PATH);
      return;
    }
    modal.confirm({
      title: t('scienceProgram.v142.leaveConfirmTitle'),
      content: t('scienceProgram.v142.leaveConfirmText'),
      okText: t('scienceProgram.v142.leaveConfirmOk'),
      okButtonProps: { danger: true },
      cancelText: t('studyLoad.common.cancel'),
      onOk: () => navigate(LIST_PATH),
    });
  };

  const handlePrimary = async () => {
    if (!isLastStep) {
      if (locked) {
        setActiveStep((s) => s + 1);
        return;
      }
      await formik.submitForm();
      return;
    }

    const errors = await formik.validateForm();
    if (Object.keys(errors).length > 0) {
      await formik.submitForm();
      return;
    }

    const rows = summarizeTopicHours(formik.values.topics, planStatus?.planHours?.items ?? null);
    if (!hasHoursMismatch(rows)) {
      await formik.submitForm();
      return;
    }

    const details = mismatchedRows(rows)
      .map((r) => `${t(TOPIC_TYPE_LABEL_KEY[r.type])} ${r.used}/${r.plan ?? '—'}`)
      .join(', ');
    modal.confirm({
      title: t('scienceProgram.v142.hours.confirmMismatchTitle'),
      content: t('scienceProgram.v142.hours.confirmMismatchText', { details }),
      okText: t('studyLoad.common.save'),
      cancelText: t('studyLoad.common.cancel'),
      onOk: () => formik.submitForm(),
    });
  };

  return (
    <Form
      layout="vertical"
      disabled={locked}
      onFinish={() => {
        void handlePrimary();
      }}
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}
    >
      <WizardWrapper>
        <FormWrapper>
          <Typography.Title level={4} style={{ margin: '0 0 24px' }}>
            {isEditMode ? t('scienceProgram.v142.editTitle') : t('scienceProgram.v142.createTitle')}
          </Typography.Title>

          {locked ? (
            <Alert
              type="info"
              showIcon
              message={t('scienceProgram.v142.readOnly')}
              style={{ marginBottom: 16 }}
            />
          ) : null}

          <Stepper current={activeStep} steps={STEP_TITLES} />

          <FormContent>
            {activeStep === 0 ? (
              <StepOne scienceOptions={scienceOptions} sciencesLoading={sciencesLoading} />
            ) : activeStep === 1 ? (
              <StepTwo />
            ) : activeStep === 2 ? (
              <StepThree />
            ) : activeStep === 3 ? (
              <StepFour />
            ) : (
              <StepFive />
            )}
          </FormContent>
        </FormWrapper>

        <FooterSection>
          <div className="left-buttons">
            <Button type="link" disabled={false} onClick={handleCancel} style={{ height: 40 }}>
              {t('studyLoad.common.cancel')}
            </Button>
            {activeStep > 0 ? (
              <Button
                type="link"
                disabled={false}
                icon={<LeftOutlined />}
                onClick={() => setActiveStep((s) => s - 1)}
                style={{ height: 40 }}
              >
                {t('studyLoad.common.back')}
              </Button>
            ) : null}
          </div>

          <div className="right-buttons">
            {locked ? null : (
              <Button
                type="link"
                icon={<SaveOutlined />}
                loading={formik.isSubmitting}
                onClick={() => {
                  void onSaveDraft(formik.values, formik.setSubmitting);
                }}
              >
                {t('studyLoad.common.saveDraft')}
              </Button>
            )}

            {locked && isLastStep ? null : (
              <Button
                type="primary"
                htmlType="button"
                disabled={false}
                icon={isLastStep ? undefined : <RightOutlined />}
                iconPosition={isLastStep ? undefined : 'end'}
                loading={formik.isSubmitting}
                style={{ height: 40 }}
                onClick={() => {
                  void handlePrimary();
                }}
              >
                {isLastStep ? t('studyLoad.common.save') : t('studyLoad.common.continue')}
              </Button>
            )}
          </div>
        </FooterSection>
      </WizardWrapper>
    </Form>
  );
};

const ScienceProgramV142FormPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { message } = App.useApp();
  const showModal = useModalStore((s) => s.showModal);
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const [activeStep, setActiveStep] = useState(0);

  const { data: scienceOptions = [], isLoading: sciencesLoading } = useMySciences();
  const detailQuery = useScienceProgramV142(id ?? '');
  const createMutation = useCreateScienceProgram();
  const updateMutation = useUpdateScienceProgram(id ?? '');

  const isLastStep = activeStep === V142_STEP_SCHEMAS.length - 1;

  const findScience = (sciId: string): ScienceOption | null =>
    scienceOptions.find((s) => s.id === sciId) ?? null;

  const handleSubmit = async (values: V142FormValues, helpers: FormikHelpers<V142FormValues>) => {
    if (!isLastStep) {
      setActiveStep((s) => s + 1);
      helpers.setSubmitting(false);
      return;
    }

    try {
      if (isEditMode) {
        await updateMutation.mutateAsync(
          toV142Payload(values, findScience(values.science), false, LITERATURE_GROUP_TITLES),
        );
        message.success(t('studyLoad.scienceProgram.updated'));
        navigate(DRAFT_LIST_PATH);
      } else {
        const created = await createMutation.mutateAsync(
          toV142Payload(values, findScience(values.science), true, LITERATURE_GROUP_TITLES),
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

  const handleSaveDraft = async (values: V142FormValues, setSubmitting: (v: boolean) => void) => {
    setSubmitting(true);
    try {
      if (isEditMode) {
        await updateMutation.mutateAsync(
          toV142Payload(values, findScience(values.science), false, LITERATURE_GROUP_TITLES),
        );
      } else {
        const created = await createMutation.mutateAsync(
          toV142Payload(values, findScience(values.science), true, LITERATURE_GROUP_TITLES),
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

  if (isEditMode && detailQuery.isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (isEditMode && detailQuery.isError) {
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <Alert
          type="error"
          showIcon
          message={t('scienceProgram.v142.loadError')}
          description={getApiErrorMessage(detailQuery.error)}
          action={
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => {
                void detailQuery.refetch();
              }}
            >
              {t('scienceProgram.v142.common.retry')}
            </Button>
          }
        />
      </div>
    );
  }

  const detail = isEditMode ? detailQuery.data : undefined;

  const isV142Doc = detail ? detail.formVersion === 'v142' : true;
  if (isEditMode && detail && !isV142Doc) {
    return <Navigate to={`${LIST_PATH}/${id}/edit`} replace />;
  }

  const locked = Boolean(detail && detail.status !== 'draft');

  return (
    <Formik
      initialValues={detail ? detail.values : V142_INITIAL_VALUES}
      validationSchema={V142_STEP_SCHEMAS[activeStep]}
      onSubmit={handleSubmit}
      enableReinitialize
    >
      <WizardShell
        isEditMode={isEditMode}
        locked={locked}
        activeStep={activeStep}
        setActiveStep={setActiveStep}
        scienceOptions={scienceOptions}
        sciencesLoading={sciencesLoading}
        onSaveDraft={handleSaveDraft}
      />
    </Formik>
  );
};

export default ScienceProgramV142FormPage;
