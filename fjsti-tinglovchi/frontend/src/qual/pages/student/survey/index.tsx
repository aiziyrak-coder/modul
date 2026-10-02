import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Input, Progress, Radio, Rate, Spin, Typography, message } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import { useMySurvey, useSubmitSurvey } from '../../../api/student-survey-api';
import { useExitCourses } from '../../../api/student-exit-api';
import { SURVEY_TYPE, type SurveyAnswer, type SurveyQuestion } from '../../../model/survey.types';

const { Text, Title } = Typography;

const STEP_SIZE = 5;

const CARD: React.CSSProperties = {
  background: 'var(--color-bg, #fff)',
  border: '1px solid var(--color-border, #e3e8ef)',
  borderRadius: 'var(--radius-lg, 12px)',
  padding: '20px 24px',
};

export default function StudentSurveyPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId: string }>();

  const survey = useMySurvey(courseId);
  const submit = useSubmitSurvey();

  const { data: courses = [] } = useExitCourses();
  const courseName = courses.find((c) => c.courseId === courseId)?.courseName ?? '';

  const [values, setValues] = useState<Record<string, SurveyAnswer>>({});
  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const questions = useMemo(
    () => (survey.data?.questions ?? []).slice().sort((a, b) => a.order - b.order),
    [survey.data],
  );

  const steps = useMemo(() => {
    const out: SurveyQuestion[][] = [];
    for (let i = 0; i < questions.length; i += STEP_SIZE) {
      out.push(questions.slice(i, i + STEP_SIZE));
    }
    return out;
  }, [questions]);

  useEffect(() => {
    if (survey.data && survey.data.submitted) navigate('/certificate', { replace: true });
  }, [survey.data, navigate]);

  const pageQuestions = steps[step] ?? [];
  const isLast = step >= steps.length - 1;

  const setAnswer = (q: SurveyQuestion, patch: Partial<SurveyAnswer>) =>
    setValues((prev) => ({ ...prev, [q._id]: { question: q._id, ...patch } }));

  const isBlank = (q: SurveyQuestion) => {
    const a = values[q._id];
    if (!a) return true;
    if (q.type === SURVEY_TYPE.CHOICE) return a.optionIndex == null;
    if (q.type === SURVEY_TYPE.RATING) return !a.rating;
    return !String(a.text ?? '').trim();
  };

  const missingHere = pageQuestions.filter((q) => q.required && isBlank(q));
  const answeredAll = questions.filter((q) => !isBlank(q)).length;

  const validateStep = () => {
    if (!missingHere.length) return true;
    setShowErrors(true);
    const first = missingHere[0];
    if (first) {
      document
        .getElementById(`survey-q-${first._id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return false;
  };

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const goNext = () => {
    if (!validateStep()) return;
    setShowErrors(false);
    setStep((s) => s + 1);
    scrollTop();
  };

  const goBack = () => {
    setShowErrors(false);
    setStep((s) => Math.max(0, s - 1));
    scrollTop();
  };

  const onSubmit = async () => {
    if (!courseId) return;
    if (!validateStep()) return;

    const missingAny = questions.filter((q) => q.required && isBlank(q));
    if (missingAny.length) {
      const first = missingAny[0];
      const idx = questions.findIndex((q) => q._id === first?._id);
      setStep(Math.floor(idx / STEP_SIZE));
      setShowErrors(true);
      scrollTop();
      return;
    }

    const answers = questions.map((q) => values[q._id]).filter(Boolean) as SurveyAnswer[];
    try {
      await submit.mutateAsync({ course: courseId, answers });
      message.success(t('qualification.survey.submitted'));
      navigate('/certificate', { replace: true });
    } catch (err) {
      message.error(getApiErrorMessage(err));
    }
  };

  return (
    <PageContainer title={t('qualification.survey.title')}>
      <div ref={topRef} />

      {survey.isLoading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin />
        </div>
      ) : !questions.length ? (
        <Alert type="info" message={t('qualification.survey.empty')} />
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            maxWidth: 760,
            margin: '0 auto',
          }}
        >
          <div style={{ ...CARD, borderTop: '10px solid var(--brand-primary, #34c18c)' }}>
            <Title level={4} style={{ margin: 0 }}>
              {t('qualification.survey.title')}
            </Title>
            {courseName ? (
              <div style={{ marginTop: 6 }}>
                <Text strong>{courseName}</Text>
              </div>
            ) : null}
            <div style={{ marginTop: 10 }}>
              <Text type="secondary">{t('qualification.survey.hint')}</Text>
            </div>

            <div style={{ marginTop: 14 }}>
              <Progress
                percent={Math.round((answeredAll / questions.length) * 100)}
                size="small"
                strokeColor="var(--brand-primary, #34c18c)"
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('qualification.survey.stepOf', { a: step + 1, b: steps.length })} ·{' '}
                {t('qualification.survey.answeredOf', { a: answeredAll, b: questions.length })}
              </Text>
            </div>

            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px solid var(--color-border, #e3e8ef)',
              }}
            >
              <Text type="danger">{t('qualification.survey.requiredNote')}</Text>
            </div>
          </div>

          {pageQuestions.map((q, i) => {
            const invalid = showErrors && q.required && isBlank(q);
            return (
              <div
                key={q._id}
                id={`survey-q-${q._id}`}
                style={{
                  ...CARD,
                  borderColor: invalid ? 'var(--brand-error, #F04438)' : (CARD.border as string),
                }}
              >
                <div style={{ marginBottom: 14, fontSize: 15 }}>
                  <Text strong>
                    {step * STEP_SIZE + i + 1}. {q.question}
                  </Text>
                  {q.required ? <Text type="danger"> *</Text> : null}
                </div>

                {q.type === SURVEY_TYPE.CHOICE ? (
                  <Radio.Group
                    value={values[q._id]?.optionIndex}
                    onChange={(e) => setAnswer(q, { optionIndex: e.target.value })}
                    style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                  >
                    {q.options.map((o, idx) => (
                      <Radio key={idx} value={idx} style={{ fontSize: 14 }}>
                        {o.text}
                      </Radio>
                    ))}
                  </Radio.Group>
                ) : q.type === SURVEY_TYPE.RATING ? (
                  <Rate
                    value={values[q._id]?.rating}
                    onChange={(rating) => setAnswer(q, { rating })}
                  />
                ) : (
                  <Input.TextArea
                    rows={3}
                    maxLength={2000}
                    showCount
                    value={values[q._id]?.text ?? ''}
                    onChange={(e) => setAnswer(q, { text: e.target.value })}
                    placeholder={t('qualification.survey.textPlaceholder')}
                  />
                )}

                {invalid ? (
                  <div style={{ marginTop: 10 }}>
                    <Text type="danger">{t('qualification.survey.requiredError')}</Text>
                  </div>
                ) : null}
              </div>
            );
          })}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              paddingTop: 4,
              paddingBottom: 24,
            }}
          >
            {step > 0 ? (
              <Button size="large" icon={<LeftOutlined />} onClick={goBack}>
                {t('qualification.survey.back')}
              </Button>
            ) : null}

            {isLast ? (
              <Button type="primary" size="large" loading={submit.isPending} onClick={onSubmit}>
                {t('qualification.survey.submit')}
              </Button>
            ) : (
              <Button type="primary" size="large" onClick={goNext}>
                {t('qualification.survey.next')} <RightOutlined />
              </Button>
            )}

            <div style={{ flex: 1 }} />
            <Button type="text" onClick={() => navigate('/certificate')}>
              {t('qualification.survey.later')}
            </Button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
