import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  DownloadOutlined,
  FormOutlined,
  PlayCircleOutlined,
  RightOutlined,
  SafetyOutlined,
  WarningFilled,
} from '@ant-design/icons';
import { App, Button, Empty, Modal, Spin, Typography } from 'antd';
import { PageContainer, Card, Flex } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import { useExitCourses } from '../../../api/student-exit-api';
import {
  useStartExit,
  useResumeExit,
  useSelectExitOption,
  useFinishExit,
  useActiveExit,
} from '../../../api/student-test-api';
import TestLeaveGuard from '../../../components/test-leave-guard';
import { useMySurvey } from '../../../api/student-survey-api';
import type { ExitCourse, ExitResult } from '../../../model/exit-test.types';
import type { ActiveTest, TestType } from '../../../model/learning.types';

const { Text } = Typography;

const OPT_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';
const mmss = (sec: number) => {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.max(0, sec) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

function Badge({ tone, children }: { tone: 'info' | 'warn'; children: React.ReactNode }) {
  const map = {
    info: { bg: 'color-mix(in srgb, var(--brand-info) 12%, #fff)', fg: 'var(--brand-info)' },
    warn: { bg: 'color-mix(in srgb, var(--brand-warning) 16%, #fff)', fg: '#a16207' },
  }[tone];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 500, background: map.bg, color: map.fg }}>
      {children}
    </span>
  );
}

export default function StudentExitTestPage() {
  const { t } = useTranslation();
  const [test, setTest] = useState<ActiveTest | null>(null);
  const [result, setResult] = useState<ExitResult | null>(null);
  const [current, setCurrent] = useState<{ id: string; name: string; passed?: boolean } | null>(null);
  const navigate = useNavigate();

  const mySurvey = useMySurvey(result && current ? current.id : undefined);
  const needSurvey = Boolean(mySurvey.data?.required && !mySurvey.data?.submitted);

  const activeExit = useActiveExit();
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current || test || !activeExit.data) return;
    resumedRef.current = true;
    setCurrent({ id: activeExit.data.course, name: activeExit.data.courseName });
    setTest(activeExit.data.active);
  }, [activeExit.data, test]);

  if (test && current) {
    return (
      <PageContainer title={t('qualification.exit.nav')}>
        <ExitTestRunner
          course={current.id}
          courseName={current.name}
          test={test}
          onFinish={(r) => {
            setTest(null);
            setResult(r);
            setCurrent((c) => (c ? { ...c, passed: r.isPassed } : c));
          }}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer title={t('qualification.exit.nav')}>
      <CourseList
        onStart={(c, active) => {
          setCurrent({ id: c.courseId, name: c.courseName });
          setTest(active);
        }}
      />
      <div aria-hidden style={{ height: 'var(--space-8, 40px)', flexShrink: 0 }} />

      <Modal
        open={!!result}
        footer={null}
        centered
        width={460}
        onCancel={() => {
          setResult(null);
          setCurrent(null);
        }}
        styles={{ body: { padding: '8px 8px 4px' } }}
      >
        {result ? (
          <ResultView
            result={result}
            needSurvey={needSurvey}
            onSurvey={() => {
              const c = current;
              setResult(null);
              setCurrent(null);
              if (c) navigate(`/survey/${c.id}`);
            }}
          />
        ) : null}
      </Modal>
    </PageContainer>
  );
}

function CourseList({ onStart }: { onStart: (c: ExitCourse, active: ActiveTest) => void }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { data: courses = [], isLoading } = useExitCourses();
  const startExit = useStartExit();
  const resumeExit = useResumeExit();
  const [confirm, setConfirm] = useState<ExitCourse | null>(null);
  const [reason, setReason] = useState<ExitCourse | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const begin = async (c: ExitCourse) => {
    setBusyId(c.courseId);
    try {
      const active = await startExit.mutateAsync(c.courseId);
      onStart(c, active);
    } catch (e) {
      try {
        const active = await resumeExit.mutateAsync(c.courseId);
        if (active && active.questions.length) onStart(c, active);
        else message.error(getApiErrorMessage(e) || t('qualification.exit.startError'));
      } catch {
        message.error(getApiErrorMessage(e) || t('qualification.exit.startError'));
      }
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: 240 }}>
        <Spin />
      </Flex>
    );
  }

  if (courses.length === 0) {
    return (
      <Card size="small">
        <Flex align="center" justify="center" style={{ minHeight: 200 }}>
          <Empty description={t('qualification.exit.noCourses')} />
        </Flex>
      </Card>
    );
  }

  return (
    <Card size="small" styles={{ body: { padding: 0 } }} style={{ overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border-soft)' }}>
        <Text strong style={{ fontSize: 13 }}>{t('qualification.exit.title')}</Text>
        <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
          {t('qualification.exit.coursesCount', { n: courses.length })}
        </Text>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--color-fill-tertiary, #f8fafc)' }}>
              {[
                t('qualification.exit.colNum'),
                t('qualification.exit.colCourse'),
                t('qualification.exit.colMode'),
                t('qualification.exit.colHours'),
                t('qualification.exit.colDates'),
                t('qualification.exit.colAction'),
              ].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--color-text-mute)', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {courses.map((c, i) => (
              <tr key={c.courseId} style={{ borderTop: '1px solid var(--color-border-soft)' }}>
                <td style={{ padding: '12px 16px', color: 'var(--color-text-mute)' }}>{i + 1}</td>
                <td style={{ padding: '12px 16px', fontWeight: 500, maxWidth: 280 }}>{c.courseName}</td>
                <td style={{ padding: '12px 16px' }}>
                  {c.form === 1 ? <Badge tone="info">{t('qualification.exit.online')}</Badge> : c.form === 2 ? <Badge tone="warn">{t('qualification.exit.offline')}</Badge> : '—'}
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--color-text-soft)', whiteSpace: 'nowrap' }}>
                  {c.creditHours ? t('qualification.exit.hours', { h: c.creditHours }) : '—'}
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--color-text-soft)', whiteSpace: 'nowrap' }}>
                  {fmtDate(c.startDate)} — {fmtDate(c.endDate)}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {c.alreadySubmitted ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: 'var(--brand-info)' }}>
                      <CheckCircleFilled /> {t('qualification.exit.submitted')}
                    </span>
                  ) : c.eligible ? (
                    <Button
                      type="primary"
                      size="small"
                      icon={<PlayCircleOutlined />}
                      loading={busyId === c.courseId}
                      onClick={() => setConfirm(c)}
                      style={{ height: 32, borderRadius: 'var(--radius-md)', paddingInline: 14 }}
                    >
                      {t('qualification.exit.takeTest')}
                    </Button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setReason(c)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: 'var(--brand-error)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      <WarningFilled /> {t('qualification.exit.cantTake')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal centered open={!!confirm} footer={null} onCancel={() => setConfirm(null)} width={420}>
        <Flex vertical align="center" gap={14} style={{ padding: '8px 4px 0' }}>
          <span style={{ width: 66, height: 66, borderRadius: '50%', background: 'color-mix(in srgb, var(--brand-warning) 16%, #fff)', color: '#a16207', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>
            <SafetyOutlined />
          </span>
          <Text strong style={{ fontSize: 17, textAlign: 'center' }}>{t('qualification.exit.confirmTitle')}</Text>
          <Text type="secondary" style={{ textAlign: 'center', fontSize: 14 }}>{t('qualification.exit.confirmBody')}</Text>
          {confirm ? (
            <div style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-elevate)' }}>
              <Text style={{ fontSize: 11, color: 'var(--color-text-mute)', display: 'block' }}>{t('qualification.exit.confirmCourseLabel')}</Text>
              <Text style={{ fontSize: 14, fontWeight: 500 }}>{confirm.courseName}</Text>
            </div>
          ) : null}
          <Flex gap={10} style={{ width: '100%', marginTop: 6 }}>
            <Button block size="large" style={{ height: 44 }} onClick={() => setConfirm(null)}>{t('qualification.learning.cancel')}</Button>
            <Button
              block
              size="large"
              type="primary"
              style={{ height: 44 }}
              loading={busyId === confirm?.courseId}
              onClick={() => {
                const c = confirm;
                setConfirm(null);
                if (c) begin(c);
              }}
            >
              {t('qualification.exit.confirmStart')}
            </Button>
          </Flex>
        </Flex>
      </Modal>

      <Modal centered open={!!reason} footer={null} onCancel={() => setReason(null)} width={440} title={t('qualification.exit.notEligibleTitle')}>
        <Flex vertical gap={14} style={{ paddingTop: 4 }}>
          <Flex align="center" gap={12} style={{ padding: 14, borderRadius: 'var(--radius-lg)', background: 'color-mix(in srgb, var(--brand-error) 8%, #fff)', border: '1px solid color-mix(in srgb, var(--brand-error) 22%, #fff)' }}>
            <span style={{ width: 40, height: 40, flexShrink: 0, borderRadius: '50%', background: 'color-mix(in srgb, var(--brand-error) 14%, #fff)', color: 'var(--brand-error)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
              <WarningFilled />
            </span>
            <Text strong>{reason?.courseName}</Text>
          </Flex>

          <Text type="secondary" style={{ fontSize: 13 }}>{t('qualification.exit.notEligibleBody')}</Text>

          <Flex vertical gap={8}>
            {[
              { active: reason?.reason === 'payment', label: t('qualification.exit.reasonPaymentLabel'), desc: t('qualification.exit.reasonPaymentDesc') },
              {
                active: reason?.reason === 'not_open' || reason?.reason === 'closed',
                label: t('qualification.exit.reasonWindowLabel'),
                desc:
                  reason?.reason === 'closed'
                    ? t('qualification.exit.reasonClosedDesc', { date: fmtDate(reason?.closeDate ?? undefined) })
                    : t('qualification.exit.reasonNotOpenDesc', { date: fmtDate(reason?.openDate ?? undefined) }),
              },
              { active: reason?.reason === 'incomplete', label: t('qualification.exit.reasonIncompleteLabel'), desc: t('qualification.exit.reasonIncompleteDesc') },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: 12,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid',
                  ...(item.active
                    ? { background: 'color-mix(in srgb, var(--brand-error) 8%, #fff)', borderColor: 'color-mix(in srgb, var(--brand-error) 26%, #fff)' }
                    : { background: 'var(--color-fill-tertiary, #f8fafc)', borderColor: 'var(--color-border-soft)', opacity: 0.55 }),
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0, background: item.active ? 'var(--brand-error)' : 'var(--color-border)' }} />
                <div>
                  <Text strong style={{ fontSize: 13, display: 'block' }}>{item.label}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>{item.desc}</Text>
                </div>
              </div>
            ))}
          </Flex>

          <Text type="secondary" style={{ fontSize: 11 }}>{t('qualification.exit.notEligibleFooter')}</Text>
        </Flex>
      </Modal>
    </Card>
  );
}

function ExitTestRunner({
  course,
  courseName,
  test,
  onFinish,
}: {
  course: string;
  courseName: string;
  test: ActiveTest;
  onFinish: (r: ExitResult) => void;
}) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const selectExit = useSelectExitOption();
  const finishExit = useFinishExit();
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState<Record<string, string[]>>(() => {
    const m: Record<string, string[]> = {};
    test.questions.forEach((q) => {
      m[q.id] = q.options.filter((o) => o.isSelected).map((o) => o.id);
    });
    return m;
  });
  const [timeLeft, setTimeLeft] = useState(test.remainingTime);
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const doFinish = async () => {
    setFinishing(true);
    try {
      const r = await finishExit.mutateAsync(course);
      onFinish(r);
    } catch (e) {
      message.error(getApiErrorMessage(e) || t('qualification.learning.errorGeneric'));
      setFinishing(false);
    }
  };

  const finishRef = useRef(doFinish);
  finishRef.current = doFinish;
  const firedRef = useRef(false);
  useEffect(() => {
    const id = setInterval(() => setTimeLeft((x) => Math.max(0, x - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (timeLeft <= 0 && !firedRef.current) {
      firedRef.current = true;
      finishRef.current();
    }
  }, [timeLeft]);

  const q = test.questions[idx];
  const total = test.questions.length;
  const answered = Object.values(sel).filter((a) => a.length > 0).length;
  const danger = timeLeft < 60;

  const pick = (questionId: string, optionId: string, testType: TestType) => {
    setSel((prev) => {
      const cur = prev[questionId] ?? [];
      const next = testType === 1 ? [optionId] : cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId];
      return { ...prev, [questionId]: next };
    });
    selectExit.mutate({ resultId: test.resultId, questionId, optionId });
  };

  if (!q) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--color-bg-elevate)', overflowY: 'auto', padding: '24px 16px' }}>
    <TestLeaveGuard active onLeave={doFinish} leaving={finishing} />
    <Flex vertical gap={16} style={{ maxWidth: 960, width: '100%', margin: '0 auto' }}>
      <Card size="small" styles={{ body: { padding: '12px 20px' } }}>
        <Flex align="center" justify="space-between" gap={12} wrap>
          <Flex align="center" gap={8} style={{ minWidth: 0 }}>
            <Text strong style={{ fontSize: 15 }}>{courseName}</Text>
            <Text type="secondary" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
              · {t('qualification.learning.answeredCount', { a: answered, n: total })}
            </Text>
          </Flex>
          <Flex align="center" gap={8} style={{ padding: '5px 14px', borderRadius: 'var(--radius-pill)', background: danger ? 'color-mix(in srgb, var(--brand-error) 12%, #fff)' : 'var(--color-bg-elevate)' }}>
            <ClockCircleOutlined style={{ color: danger ? 'var(--brand-error)' : 'var(--color-text-soft)' }} />
            <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: danger ? 'var(--brand-error)' : 'var(--color-text)' }}>{mmss(timeLeft)}</Text>
          </Flex>
          <Button type="primary" danger onClick={() => setFinishOpen(true)}>
            {t('qualification.learning.finishTest')}
          </Button>
        </Flex>
      </Card>

      <Card size="small" styles={{ body: { padding: '16px 20px' } }}>
        <Text style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.6, color: 'var(--color-text-mute)' }}>
          {t('qualification.learning.questionsLabel')}
        </Text>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {test.questions.map((qq, i) => {
            const cur = i === idx;
            const ans = (sel[qq.id] ?? []).length > 0;
            return (
              <button
                key={qq.id}
                type="button"
                onClick={() => setIdx(i)}
                style={{
                  width: 38,
                  height: 38,
                  flexShrink: 0,
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: cur ? '2px solid var(--brand-info)' : `1px solid ${ans ? 'var(--brand-primary)' : 'var(--color-border)'}`,
                  background: ans ? 'var(--brand-primary-soft)' : 'var(--color-bg)',
                  color: cur ? 'var(--brand-info)' : ans ? 'var(--brand-primary)' : 'var(--color-text)',
                }}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <Flex gap={18} wrap style={{ marginTop: 14 }}>
          <LegendItem variant="answered" label={t('qualification.learning.answered')} />
          <LegendItem variant="notAnswered" label={t('qualification.learning.notAnswered')} />
          <LegendItem variant="current" label={t('qualification.learning.currentQuestion')} />
        </Flex>
      </Card>

      <Card size="small" styles={{ body: { padding: 20 } }}>
        <Flex align="center" gap={10} style={{ marginBottom: 12 }}>
          <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', fontSize: 12, fontWeight: 600 }}>
            {idx + 1} / {total}
          </span>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {q.testType === 2 ? t('qualification.learning.testType2') : t('qualification.learning.testType1')}
          </Text>
        </Flex>

        <div style={{ padding: 16, borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-elevate)', marginBottom: 16 }}>
          <Text strong style={{ fontSize: 15 }}>{q.question}</Text>
        </div>

        <Flex vertical gap={10}>
          {q.options.map((o, oi) => {
            const checked = (sel[q.id] ?? []).includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => pick(q.id, o.id, q.testType)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${checked ? 'var(--brand-primary)' : 'var(--color-border-soft)'}`,
                  background: checked ? 'var(--brand-primary-soft)' : 'var(--color-bg)',
                }}
              >
                <span
                  style={{
                    width: 26,
                    height: 26,
                    flexShrink: 0,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 600,
                    background: checked ? 'var(--brand-primary)' : 'var(--color-bg-elevate)',
                    color: checked ? '#fff' : 'var(--color-text-soft)',
                    border: checked ? 'none' : '1px solid var(--color-border)',
                  }}
                >
                  {OPT_LETTERS[oi] ?? ''}
                </span>
                <Text style={{ fontSize: 14 }}>{o.text}</Text>
              </button>
            );
          })}
        </Flex>

        <Flex align="center" justify="space-between" style={{ marginTop: 20 }}>
          <Button disabled={idx === 0} onClick={() => setIdx((i) => Math.max(0, i - 1))}>
            <ArrowLeftOutlined /> {t('qualification.learning.prev')}
          </Button>
          <Button type="primary" disabled={idx >= total - 1} onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}>
            {t('qualification.learning.next')} <RightOutlined />
          </Button>
        </Flex>
      </Card>

      <Modal centered open={finishOpen} footer={null} onCancel={() => setFinishOpen(false)} width={420}>
        <Flex vertical align="center" gap={14} style={{ padding: '8px 4px 0' }}>
          <span style={{ width: 66, height: 66, borderRadius: '50%', background: 'color-mix(in srgb, var(--brand-warning) 16%, #fff)', color: 'rgb(234, 179, 8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
            <WarningFilled />
          </span>
          <Text strong style={{ fontSize: 17 }}>{t('qualification.learning.finishConfirmTitle')}</Text>
          <Text type="secondary" style={{ textAlign: 'center', fontSize: 14 }}>
            {t('qualification.learning.finishConfirmBody', { a: answered, n: total })}
          </Text>
          {answered < total ? (
            <div style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'color-mix(in srgb, var(--brand-warning) 14%, #fff)', color: '#a16207', fontSize: 13, textAlign: 'center' }}>
              {t('qualification.learning.finishWarnUnanswered', { count: total - answered })}
            </div>
          ) : null}
          <Flex gap={10} style={{ width: '100%', marginTop: 6 }}>
            <Button block size="large" style={{ height: 44 }} onClick={() => setFinishOpen(false)}>{t('qualification.learning.cancel')}</Button>
            <Button block size="large" style={{ height: 44 }} type="primary" loading={finishing} onClick={() => { setFinishOpen(false); doFinish(); }}>
              {t('qualification.learning.finish')}
            </Button>
          </Flex>
        </Flex>
      </Modal>
    </Flex>
    </div>
  );
}

function ResultView({
  result,
  needSurvey,
  onSurvey,
}: {
  result: ExitResult;
  needSurvey: boolean;
  onSurvey: () => void;
}) {
  const { t } = useTranslation();
  const passed = result.isPassed;
  const accent = passed ? 'var(--brand-primary)' : 'var(--brand-error)';

  return (
    <Flex vertical align="center" gap={20} style={{ padding: '24px 12px 8px' }}>
      <div style={{ width: 128, height: 128, borderRadius: '50%', border: `4px solid ${accent}`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 700 }}>
        {result.percentage}%
      </div>
      <Flex vertical align="center" gap={6}>
        <Text strong style={{ fontSize: 17, color: accent, textAlign: 'center' }}>
          {passed ? t('qualification.exit.passedMsg') : t('qualification.exit.failedMsg')}
        </Text>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {t('qualification.exit.scoreLine', { c: result.totalCorrects, n: result.totalQuestions })}
        </Text>
      </Flex>
      <Flex vertical gap={10} align="center" style={{ width: '100%' }}>
        {needSurvey ? (
          <>
            <Button
              type="primary"
              size="large"
              icon={<FormOutlined />}
              style={{ borderRadius: 'var(--radius-md)' }}
              onClick={onSurvey}
            >
              {t('qualification.exit.surveyAction')}
            </Button>
            <Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>
              {t('qualification.exit.surveyHint')}
            </Text>
          </>
        ) : result.file ? (
          <Button
            type={passed ? 'primary' : 'default'}
            size="large"
            icon={<DownloadOutlined />}
            style={{ borderRadius: 'var(--radius-md)' }}
            onClick={() => window.open(result.file as string, '_blank', 'noopener,noreferrer')}
          >
            {passed ? t('qualification.exit.downloadCert') : t('qualification.exit.downloadRef')}
          </Button>
        ) : (
          <>
            <Button size="large" disabled icon={<ClockCircleOutlined />} style={{ borderRadius: 'var(--radius-md)' }}>
              {t('qualification.exit.pending')}
            </Button>
            <Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>
              {t('qualification.exit.pendingHint')}
            </Text>
          </>
        )}
      </Flex>
    </Flex>
  );
}

function LegendItem({ variant, label }: { variant: 'answered' | 'notAnswered' | 'current'; label: string }) {
  const box =
    variant === 'answered'
      ? { background: 'var(--brand-primary)', border: 'none' }
      : variant === 'current'
        ? { background: 'var(--color-bg)', border: '2px solid var(--brand-info)' }
        : { background: 'var(--color-bg)', border: '1px solid var(--color-border)' };
  return (
    <Flex align="center" gap={6}>
      <span style={{ width: 14, height: 14, borderRadius: 4, display: 'inline-block', ...box }} />
      <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
    </Flex>
  );
}
