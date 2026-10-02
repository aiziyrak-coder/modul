import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  CheckOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  DownloadOutlined,
  FileImageOutlined,
  FileTextOutlined,
  LockOutlined,
  PaperClipOutlined,
  PlayCircleOutlined,
  ReadOutlined,
  RightOutlined,
  SolutionOutlined,
  WarningFilled,
} from '@ant-design/icons';
import { App, Button, Empty, Modal, Progress, Spin, Typography } from 'antd';
import dayjs from 'dayjs';
import { PageContainer, Card, Flex } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import { useMyCourses } from '../../../api/my-course-api';
import { useMyProgress, useStartTopic, useAdvanceTopic, useSubmitScenario } from '../../../api/learning-api';
import {
  useStartEntrance,
  useResumeEntrance,
  useSelectEntranceOption,
  useFinishEntrance,
  useStartFinal,
  useResumeFinal,
  useSelectFinalOption,
  useFinishFinal,
} from '../../../api/student-test-api';
import {
  useLectures,
  usePracticals,
  useVideos,
  useScenarios,
} from '../../../api/topic-material-api';
import { VideoPlayer } from '../../../components/video-player';
import type { MyCourse } from '../../../model/my-course.types';
import type {
  ActiveTest,
  EntranceResult,
  FinalResult,
  MaterialTab,
  TopicProgress,
  TestType,
  PaymentLock,
} from '../../../model/learning.types';

const { Text } = Typography;

const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';
const fmtTime = (s?: string | null) =>
  s
    ? `${new Date(s).toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' })} ${new Date(s).toTimeString().slice(0, 5)}`
    : '—';
const mmss = (sec: number) => {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.max(0, sec) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};
const isNotStarted = (c: MyCourse) => {
  if (!c.startDate) return false;
  const start = new Date(c.startDate);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return start > today;
};

const CONTENT_TABS: MaterialTab[] = ['lecture', 'practice', 'video', 'scenario'];
const ALL_TABS: MaterialTab[] = [...CONTENT_TABS, 'final'];
const TAB_STAGE: Record<MaterialTab, number> = {
  lecture: 1,
  practice: 2,
  video: 3,
  scenario: 4,
  final: 5,
};
const stageToTab = (status: number): MaterialTab =>
  status <= 1 ? 'lecture' : status === 2 ? 'practice' : status === 3 ? 'video' : status === 4 ? 'scenario' : 'final';

function GraduationCapIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
      <path d="M22 10v6" />
      <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
    </svg>
  );
}

export default function StudentLearningPage() {
  const { t } = useTranslation();
  const { data: courses = [], isLoading } = useMyCourses();
  const location = useLocation();
  const navigate = useNavigate();
  const courseId = (location.state as { course?: string } | null)?.course ?? null;
  const selected = courses.find((c) => c.id === courseId) ?? null;

  const openCourse = (c: MyCourse) =>
    navigate('/learning',{ state: { course: c.id } });
  const backToCourses = () =>
    navigate('/learning',{ state: {} });

  return (
    <PageContainer title={t('qualification.learning.nav')}>
      {selected ? (
        <CourseDetail course={selected} onBack={backToCourses} />
      ) : (
        <CourseSelection courses={courses} loading={isLoading} onOpen={openCourse} />
      )}
      <div aria-hidden style={{ height: 'var(--space-8, 40px)', flexShrink: 0 }} />
    </PageContainer>
  );
}

function CourseSelection({
  courses,
  loading,
  onOpen,
}: {
  courses: MyCourse[];
  loading: boolean;
  onOpen: (c: MyCourse) => void;
}) {
  const { t } = useTranslation();
  const [notStarted, setNotStarted] = useState<MyCourse | null>(null);
  const [confirmCourse, setConfirmCourse] = useState<MyCourse | null>(null);

  const handleClick = (c: MyCourse) => {
    if (isNotStarted(c)) {
      setNotStarted(c);
      return;
    }
    if (c.entranceTestDone) {
      onOpen(c);
      return;
    }
    setConfirmCourse(c);
  };

  if (loading) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: 240 }}>
        <Spin />
      </Flex>
    );
  }

  return (
    <>
      <Card
        size="small"
        style={{ marginBottom: 16 }}
        styles={{ body: { padding: '14px 16px' } }}
      >
        <Text strong style={{ fontSize: 14 }}>
          {t('qualification.learning.selectCourse')}
        </Text>
        <div style={{ fontSize: 12, color: 'var(--color-text-mute)', marginTop: 2 }}>
          {t('qualification.learning.selectCourseHint')}
        </div>
      </Card>

      {courses.length === 0 ? (
        <Card size="small">
          <Flex vertical align="center" justify="center" gap={12} style={{ padding: '56px 16px' }}>
            <span style={{ color: 'var(--color-text-mute)' }}>
              <GraduationCapIcon size={44} />
            </span>
            <Text type="secondary">{t('qualification.learning.noCourses')}</Text>
          </Flex>
        </Card>
      ) : (
        <>
          <style>{`
            .ql-learn-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
            @media (min-width: 640px) { .ql-learn-grid { grid-template-columns: 1fr 1fr; } }
          `}</style>
          <div className="ql-learn-grid">
            {courses.map((c) => (
              <CourseCard key={c.id} course={c} onClick={() => handleClick(c)} />
            ))}
          </div>
        </>
      )}

      <Modal
        centered
        open={!!notStarted}
        onCancel={() => setNotStarted(null)}
        footer={null}
        title={t('qualification.learning.notStartedTitle')}
        width={380}
      >
        <Flex vertical align="center" gap={16} style={{ padding: '12px 0' }}>
          <span style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>
            <CalendarOutlined />
          </span>
          <Text style={{ textAlign: 'center' }}>
            {t('qualification.learning.notStartedBody', { date: fmtDate(notStarted?.startDate) })}
          </Text>
          <Button type="primary" block onClick={() => setNotStarted(null)}>
            {t('qualification.learning.gotIt')}
          </Button>
        </Flex>
      </Modal>

      <Modal
        centered
        open={!!confirmCourse}
        footer={null}
        onCancel={() => setConfirmCourse(null)}
        width={420}
      >
        <Flex vertical align="center" gap={14} style={{ padding: '8px 4px 0' }}>
          <span style={{ width: 66, height: 66, borderRadius: '50%', background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
            <PlayCircleOutlined />
          </span>
          <Text strong style={{ fontSize: 17 }}>{t('qualification.learning.entranceConfirmTitle')}</Text>
          {confirmCourse ? (
            <span style={{ padding: '4px 12px', borderRadius: 'var(--radius-pill)', background: 'var(--color-bg-elevate)', fontSize: 13, fontWeight: 500, textAlign: 'center', maxWidth: '100%' }}>
              {confirmCourse.title}
            </span>
          ) : null}
          <Text type="secondary" style={{ textAlign: 'center', fontSize: 14 }}>
            {t('qualification.learning.entranceConfirmBody')}
          </Text>
          <Flex gap={10} style={{ width: '100%', marginTop: 6 }}>
            <Button block size="large" onClick={() => setConfirmCourse(null)}>
              {t('qualification.learning.cancel')}
            </Button>
            <Button
              block
              size="large"
              type="primary"
              onClick={() => {
                const c = confirmCourse;
                setConfirmCourse(null);
                if (c) onOpen(c);
              }}
            >
              {t('qualification.learning.confirm')}
            </Button>
          </Flex>
        </Flex>
      </Modal>
    </>
  );
}

function CourseCard({ course, onClick }: { course: MyCourse; onClick: () => void }) {
  const { t } = useTranslation();
  const planned = isNotStarted(course);
  const online = course.form === 1;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: 'left',
        cursor: 'pointer',
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border-soft)',
        borderRadius: 'var(--radius-lg)',
        padding: 20,
        display: 'flex',
        gap: 16,
        alignItems: 'flex-start',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <span style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 'var(--radius-lg)', background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <GraduationCapIcon size={24} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Flex align="flex-start" gap={8}>
          <Text strong style={{ flex: 1, fontSize: 14, lineHeight: 1.35 }} ellipsis={{ tooltip: course.title }}>
            {course.title}
          </Text>
          {planned ? <Badge tone="info">{t('qualification.learning.planned')}</Badge> : null}
        </Flex>
        <Flex wrap gap={8} align="center" style={{ marginTop: 10 }}>
          <Badge tone={online ? 'info' : 'warn'}>
            {online ? t('qualification.learning.online') : t('qualification.learning.offline')}
          </Badge>
          <Meta icon={<ClockCircleOutlined />}>{t('qualification.learning.hours', { h: course.creditHours })}</Meta>
          <Meta icon={<CalendarOutlined />}>
            {fmtDate(course.startDate)} — {fmtDate(course.endDate)}
          </Meta>
        </Flex>
      </div>
      <RightOutlined style={{ fontSize: 14, color: 'var(--color-text-mute)', marginTop: 4 }} />
    </button>
  );
}

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
function Meta({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--color-text-mute)' }}>
      {icon}
      {children}
    </span>
  );
}

function CourseDetail({ course, onBack }: { course: MyCourse; onBack: () => void }) {
  const { t } = useTranslation();
  const { data: progress, isLoading } = useMyProgress(course.id);

  return (
    <Flex vertical gap={12} style={{ minHeight: 0 }}>
      <Flex align="center" gap={10}>
        <Button type="text" size="small" icon={<ArrowLeftOutlined />} onClick={onBack} style={{ paddingLeft: 4 }}>
          {t('qualification.learning.back')}
        </Button>
        <Text type="secondary">/</Text>
        <Text strong ellipsis={{ tooltip: course.title }} style={{ maxWidth: 360 }}>
          {course.title}
        </Text>
      </Flex>

      {isLoading || !progress ? (
        <Flex align="center" justify="center" style={{ minHeight: 240 }}>
          <Spin />
        </Flex>
      ) : progress.payment && progress.payment.locked ? (
        <PaymentLockedScreen lock={progress.payment} />
      ) : !progress.entranceDone ? (
        <EntranceGate course={course} />
      ) : course.form === 2 ? (
        <OfflineScreen />
      ) : (
        <MaterialsView course={course} topics={progress.topics} />
      )}
    </Flex>
  );
}

function PaymentLockedScreen({ lock }: { lock: PaymentLock }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fmt = (n: number) => new Intl.NumberFormat('uz-UZ').format(n) + " so'm";
  return (
    <Card size="small">
      <Flex vertical align="center" justify="center" gap={14} style={{ padding: '64px 16px', textAlign: 'center' }}>
        <span
          style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'color-mix(in srgb, var(--brand-error) 14%, #fff)',
            color: 'var(--brand-error)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 28,
          }}
        >
          <LockOutlined />
        </span>
        <Text strong style={{ fontSize: 16 }}>{t('qualification.learning.paymentLockedTitle')}</Text>
        <Text type="secondary" style={{ maxWidth: 420 }}>
          {t('qualification.learning.paymentLockedText')}
        </Text>
        <Flex gap={24} wrap justify="center">
          <Flex vertical gap={2}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('qualification.learning.paymentRequired')}
            </Text>
            <Text strong>{fmt(lock.requiredAmount)}</Text>
          </Flex>
          <Flex vertical gap={2}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('qualification.learning.paymentPaid')}
            </Text>
            <Text strong>{fmt(lock.paidAmount)}</Text>
          </Flex>
          {lock.dueAt ? (
            <Flex vertical gap={2}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('qualification.learning.paymentDue')}
              </Text>
              <Text strong style={{ color: 'var(--brand-error)' }}>
                {dayjs(lock.dueAt).format('DD.MM.YYYY')}
              </Text>
            </Flex>
          ) : null}
        </Flex>
        <Button type="primary" onClick={() => navigate('/payment')}>
          {t('qualification.learning.paymentGo')}
        </Button>
      </Flex>
    </Card>
  );
}

function OfflineScreen() {
  const { t } = useTranslation();
  return (
    <Card size="small">
      <Flex vertical align="center" justify="center" gap={14} style={{ padding: '72px 16px' }}>
        <span style={{ width: 64, height: 64, borderRadius: '50%', background: 'color-mix(in srgb, var(--brand-warning) 16%, #fff)', color: '#a16207', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
          <CalendarOutlined />
        </span>
        <Text strong>{t('qualification.learning.offlineTitle')}</Text>
        <Text type="secondary" style={{ textAlign: 'center', maxWidth: 420 }}>
          {t('qualification.learning.offlineBody')}
        </Text>
      </Flex>
    </Card>
  );
}

function EntranceGate({ course }: { course: MyCourse }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const start = useStartEntrance();
  const resume = useResumeEntrance();
  const finish = useFinishEntrance();
  const qc = useQueryClient();
  const [test, setTest] = useState<ActiveTest | null>(null);
  const [result, setResult] = useState<EntranceResult | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    resume.mutateAsync(course.id).then(async (active) => {
      if (!alive) return;
      if (active && active.questions.length) {
        setTest(active);
      } else {
        try {
          const started = await start.mutateAsync(course.id);
          if (alive) setTest(started);
        } catch (e) {
          try {
            const r = await finish.mutateAsync(course.id);
            if (alive) setResult(r);
          } catch {
            if (alive) message.error(getApiErrorMessage(e) || t('qualification.learning.startError'));
          }
        }
      }
      if (alive) setChecked(true);
    });
    return () => {
      alive = false;
    };
  }, [course.id]);

  const onFinish = async () => {
    try {
      const r = await finish.mutateAsync(course.id);
      setTest(null);
      setResult(r);
    } catch (e) {
      message.error(getApiErrorMessage(e) || t('qualification.learning.errorGeneric'));
    }
  };

  if (test) {
    return (
      <TestRunner
        title={t('qualification.learning.entranceTitle')}
        test={test}
        endpointKind="entrance"
        onFinish={onFinish}
        finishing={finish.isPending}
      />
    );
  }

  return (
    <>
      {!checked ? (
        <Flex align="center" justify="center" style={{ minHeight: 200 }}>
          <Spin />
        </Flex>
      ) : null}

      <EntranceResultModal
        result={result}
        courseName={course.title}
        onClose={() => {
          setResult(null);
          qc.invalidateQueries({ queryKey: ['qual-learning', 'my', course.id] });
          qc.invalidateQueries({ queryKey: ['qual-my-course'] });
        }}
      />
    </>
  );
}

function EntranceResultModal({
  result,
  courseName,
  onClose,
}: {
  result: EntranceResult | null;
  courseName: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const total = result?.totalQuestions ?? 0;
  const correct = result?.totalCorrects ?? 0;
  const pct = total ? Math.round((correct / total) * 100) : 0;
  return (
    <Modal centered open={!!result} onCancel={onClose} footer={null} title={t('qualification.learning.entranceResultTitle')} width={400}>
      {result ? (
        <Flex vertical align="center" gap={16} style={{ padding: '8px 0' }}>
          <div style={{ width: 108, height: 108, borderRadius: '50%', border: '4px solid var(--brand-primary)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700 }}>
            {pct}%
          </div>
          <Text strong style={{ textAlign: 'center' }}>{courseName}</Text>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ResultRow label={t('qualification.learning.correct')} value={t('qualification.learning.count', { n: correct })} tone="ok" />
            <ResultRow label={t('qualification.learning.incorrect')} value={t('qualification.learning.count', { n: total - correct })} tone="bad" />
          </div>
          <Button type="primary" block onClick={onClose}>
            {t('qualification.learning.goToLearning')}
          </Button>
        </Flex>
      ) : null}
    </Modal>
  );
}
function ResultRow({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'bad' }) {
  const c = tone === 'ok'
    ? { bg: 'var(--brand-primary-soft)', fg: 'var(--brand-primary)' }
    : { bg: 'color-mix(in srgb, var(--brand-error) 10%, #fff)', fg: 'var(--brand-error)' };
  return (
    <Flex align="center" justify="space-between" style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', background: c.bg }}>
      <Text style={{ fontSize: 13 }}>{label}</Text>
      <Text strong style={{ fontSize: 13, color: c.fg }}>{value}</Text>
    </Flex>
  );
}

function MaterialsView({ course, topics }: { course: MyCourse; topics: TopicProgress[] }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const startTopic = useStartTopic();
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MaterialTab>('lecture');

  useEffect(() => {
    if (!topics.length) {
      setCurrentId(null);
      return;
    }
    if (!currentId || !topics.some((tp) => tp.id === currentId)) {
      const firstOpen = topics.find((tp) => !tp.isLocked && !tp.isCompleted) ?? topics.find((tp) => !tp.isLocked) ?? topics[0]!;
      setCurrentId(firstOpen.id);
    }
  }, [topics, currentId]);

  const current = topics.find((tp) => tp.id === currentId) ?? null;

  useEffect(() => {
    if (!current) return;
    setActiveTab(stageToTab(current.status));
    if (current.status === 0 && !current.isLocked) {
      startTopic.mutate({ course: course.id, topic: current.id });
    }
  }, [current?.id]);

  useEffect(() => {
    if (!current) return;
    const stillAvailable =
      current.isCompleted || current.status >= TAB_STAGE[activeTab];
    if (!stillAvailable) setActiveTab(stageToTab(current.status));
  }, [current?.id, current?.status, current?.isCompleted, activeTab]);

  const overall = topics.length
    ? Math.round(topics.reduce((s, tp) => s + (tp.progressPercent ?? 0), 0) / topics.length)
    : 0;

  const handleSelectTopic = (tp: TopicProgress) => {
    if (tp.isLocked) {
      message.info(t('qualification.learning.topicLockedHint'));
      return;
    }
    setCurrentId(tp.id);
  };

  return (
    <Flex gap={16} align="flex-start">
      <Card size="small" style={{ width: 300, flexShrink: 0, overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border-soft)' }}>
          <Flex align="center" justify="space-between" style={{ marginBottom: 8 }}>
            <Text strong style={{ fontSize: 13 }}>{t('qualification.learning.overallProgress')}</Text>
            <Text style={{ fontSize: 12, color: 'var(--brand-primary)', fontWeight: 600 }}>{overall}%</Text>
          </Flex>
          <Progress percent={overall} showInfo={false} strokeColor="var(--brand-primary)" size="small" />
        </div>
        <div style={{ maxHeight: 520, overflowY: 'auto' }}>
          {topics.map((tp, i) => {
            const active = tp.id === currentId;
            const last = i === topics.length - 1;
            return (
              <button
                key={tp.id}
                type="button"
                onClick={() => handleSelectTopic(tp)}
                disabled={tp.isLocked}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  display: 'flex',
                  gap: 12,
                  padding: '12px 16px',
                  cursor: tp.isLocked ? 'not-allowed' : 'pointer',
                  opacity: tp.isLocked ? 0.6 : 1,
                  background: active ? 'var(--brand-primary-soft)' : 'transparent',
                  border: 'none',
                  borderLeft: `2px solid ${active ? 'var(--brand-primary)' : 'transparent'}`,
                  borderBottom: last ? 'none' : '1px solid var(--color-border-soft)',
                }}
              >
                <span style={{ marginTop: 2, flexShrink: 0, fontSize: 16, color: tp.isLocked ? 'var(--color-text-mute)' : tp.isCompleted ? 'var(--brand-primary)' : 'var(--brand-info)' }}>
                  {tp.isLocked ? <LockOutlined /> : tp.isCompleted ? <CheckCircleFilled /> : <ReadOutlined />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: active ? 'var(--brand-primary)' : 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {tp.orderNumber}. {tp.title}
                  </span>
                  <span style={{ display: 'block' }}>
                    <Progress percent={tp.progressPercent} showInfo={false} size="small" strokeColor="var(--brand-primary)" />
                  </span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--color-text-mute)', marginTop: 2 }}>{tp.progressPercent}%</span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <div style={{ flex: 1, minWidth: 0 }}>
        {!current ? (
          <Card size="small">
            <Flex align="center" justify="center" style={{ minHeight: 240 }}>
              <Empty description={t('qualification.learning.selectTopic')} />
            </Flex>
          </Card>
        ) : current.isLocked ? (
          <Card size="small">
            <Flex vertical align="center" justify="center" gap={12} style={{ minHeight: 240 }}>
              <LockOutlined style={{ fontSize: 40, color: 'var(--color-text-mute)' }} />
              <Text strong>{t('qualification.learning.topicLocked')}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>{t('qualification.learning.topicLockedHint')}</Text>
            </Flex>
          </Card>
        ) : (
          <TopicContent
            course={course}
            topic={current}
            isLast={topics[topics.length - 1]?.id === current.id}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        )}
      </div>
    </Flex>
  );
}

function TopicContent({
  course,
  topic,
  isLast,
  activeTab,
  onTabChange,
}: {
  course: MyCourse;
  topic: TopicProgress;
  isLast: boolean;
  activeTab: MaterialTab;
  onTabChange: (t: MaterialTab) => void;
}) {
  const { t } = useTranslation();
  const advance = useAdvanceTopic();

  const [finalRunning, setFinalRunning] = useState(false);
  const [leaveTabOpen, setLeaveTabOpen] = useState(false);
  const finishRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    setFinalRunning(false);
  }, [topic.id]);

  const requestTab = (tab: MaterialTab) => {
    if (finalRunning && tab !== activeTab) setLeaveTabOpen(true);
    else onTabChange(tab);
  };

  const tabAvailable = (tab: MaterialTab) => topic.isCompleted || topic.status >= TAB_STAGE[tab];

  const goNext = (tab: MaterialTab) => {
    const nextIdx = ALL_TABS.indexOf(tab) + 1;
    const nextTab = ALL_TABS[nextIdx] ?? tab;
    if (topic.status === TAB_STAGE[tab] && topic.status < 5) {
      advance.mutate(
        { course: course.id, topic: topic.id },
        { onSuccess: () => onTabChange(nextTab) },
      );
    } else {
      onTabChange(nextTab);
    }
  };

  return (
    <Flex vertical gap={12}>
      <Card size="small" styles={{ body: { padding: 6 } }}>
        <Flex gap={4} style={{ overflowX: 'auto' }}>
          {ALL_TABS.map((tab) => {
            const avail = tabAvailable(tab);
            const on = tab === activeTab;
            return (
              <button
                key={tab}
                type="button"
                disabled={!avail}
                onClick={() => requestTab(tab)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  cursor: avail ? 'pointer' : 'not-allowed',
                  color: on ? 'var(--brand-primary)' : avail ? 'var(--color-text)' : 'var(--color-text-mute)',
                  background: on ? 'var(--brand-primary-soft)' : 'transparent',
                }}
              >
                {!avail ? <LockOutlined style={{ fontSize: 11 }} /> : null}
                {t(`qualification.learning.tab.${tab}`)}
              </button>
            );
          })}
        </Flex>
      </Card>

      {activeTab === 'lecture' ? (
        <FileMaterial course={course.id} topic={topic.id} kind="lecture" onNext={() => goNext('lecture')} nextLoading={advance.isPending} />
      ) : activeTab === 'practice' ? (
        <FileMaterial course={course.id} topic={topic.id} kind="practice" onNext={() => goNext('practice')} nextLoading={advance.isPending} />
      ) : activeTab === 'video' ? (
        <VideoMaterial course={course.id} topic={topic.id} onNext={() => goNext('video')} nextLoading={advance.isPending} gate={topic.status === TAB_STAGE.video} />
      ) : activeTab === 'scenario' ? (
        <ScenarioMaterial
          course={course.id}
          topic={topic.id}
          onSubmit={() =>
            new Promise<void>((resolve, reject) => {
              if (topic.status === TAB_STAGE.scenario && topic.status < 5) {
                advance.mutate(
                  { course: course.id, topic: topic.id },
                  { onSuccess: () => resolve(), onError: () => reject(new Error('advance-failed')) },
                );
              } else {
                resolve();
              }
            })
          }
          onNext={() => onTabChange('final')}
          submitting={advance.isPending}
        />
      ) : (
        <FinalTestTab course={course} topic={topic} isLast={isLast} onRunningChange={setFinalRunning} finishRef={finishRef} />
      )}

      <Modal
        centered
        open={leaveTabOpen}
        footer={null}
        onCancel={() => setLeaveTabOpen(false)}
        width={430}
      >
        <Flex vertical align="center" gap={14} style={{ padding: '8px 4px 0' }}>
          <span style={{ width: 66, height: 66, borderRadius: '50%', background: 'color-mix(in srgb, var(--brand-warning) 16%, #fff)', color: 'rgb(234, 179, 8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
            <WarningFilled />
          </span>
          <Text strong style={{ fontSize: 17 }}>{t('qualification.learning.leaveTitle')}</Text>
          <Text type="secondary" style={{ textAlign: 'center', fontSize: 14 }}>
            {t('qualification.learning.leaveBody')}
          </Text>
          <Flex gap={10} style={{ width: '100%', marginTop: 6 }}>
            <Button block size="large" onClick={() => setLeaveTabOpen(false)}>
              {t('qualification.learning.leaveStay')}
            </Button>
            <Button
              block
              size="large"
              danger
              type="primary"
              onClick={() => {
                setLeaveTabOpen(false);
                finishRef.current?.();
              }}
            >
              {t('qualification.learning.leaveConfirm')}
            </Button>
          </Flex>
        </Flex>
      </Modal>
    </Flex>
  );
}

function ContentCard({ children }: { children: React.ReactNode }) {
  return (
    <Card size="small" styles={{ body: { padding: 20 } }}>
      {children}
    </Card>
  );
}
function NextButton({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  const { t } = useTranslation();
  return (
    <Flex justify="flex-end" style={{ marginTop: 16 }}>
      <Button type="primary" loading={loading} onClick={onClick}>
        {t('qualification.learning.next')} <RightOutlined />
      </Button>
    </Flex>
  );
}
function FileCardLink({ title, url, tone }: { title: string; url: string; tone: 'info' | 'ok' }) {
  const { t } = useTranslation();
  const c = tone === 'info'
    ? { bg: 'color-mix(in srgb, var(--brand-info) 12%, #fff)', fg: 'var(--brand-info)' }
    : { bg: 'var(--brand-primary-soft)', fg: 'var(--brand-primary)' };
  const disabled = !url;
  return (
    <a
      href={url || undefined}
      target="_blank"
      rel="noopener noreferrer"
      download
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        border: '1px solid var(--color-border-soft)',
        borderRadius: 'var(--radius-lg)',
        pointerEvents: disabled ? 'none' : 'auto',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: c.bg, color: c.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
        <FileTextOutlined />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 500 }}>{title}</span>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--color-text-mute)' }}>
          {disabled ? t('qualification.learning.noFile') : t('qualification.learning.pdfFile')}
        </span>
      </span>
      {!disabled ? <DownloadOutlined style={{ color: c.fg }} /> : null}
    </a>
  );
}

function FileMaterial({
  course,
  topic,
  kind,
  onNext,
  nextLoading,
}: {
  course: string;
  topic: string;
  kind: 'lecture' | 'practice';
  onNext: () => void;
  nextLoading: boolean;
}) {
  const { t } = useTranslation();
  const lectures = useLectures(course, kind === 'lecture' ? topic : '');
  const practicals = usePracticals(course, kind === 'practice' ? topic : '');
  const q = kind === 'lecture' ? lectures : practicals;
  const items = q.data ?? [];
  return (
    <ContentCard>
      <Flex align="center" gap={8} style={{ marginBottom: 14 }}>
        <FileTextOutlined style={{ color: 'var(--brand-info)' }} />
        <Text strong>{t(`qualification.learning.tab.${kind}`)}</Text>
      </Flex>
      {q.isLoading ? (
        <Flex align="center" justify="center" style={{ minHeight: 120 }}><Spin /></Flex>
      ) : items.length === 0 ? (
        <Empty description={t('qualification.learning.noMaterial')} />
      ) : (
        <Flex vertical gap={10}>
          {items.map((m) => (
            <FileCardLink key={m.id} title={m.title} url={m.fileUrl} tone="info" />
          ))}
        </Flex>
      )}
      <NextButton onClick={onNext} loading={nextLoading} />
    </ContentCard>
  );
}

function VideoMaterial({
  course,
  topic,
  onNext,
  nextLoading,
  gate,
}: {
  course: string;
  topic: string;
  onNext: () => void;
  nextLoading: boolean;
  gate: boolean;
}) {
  const { t } = useTranslation();
  const q = useVideos(course, topic);
  const items = q.data ?? [];
  const first = items[0];
  const url = first?.videoUrl ?? '';
  const [watched, setWatched] = useState(false);
  const blocked = gate && !!url && !watched;
  return (
    <ContentCard>
      <Flex align="center" gap={8} style={{ marginBottom: 14 }}>
        <PlayCircleOutlined style={{ color: 'var(--brand-info)' }} />
        <Text strong>{first?.title ?? t('qualification.learning.tab.video')}</Text>
      </Flex>
      {q.isLoading ? (
        <Flex align="center" justify="center" style={{ minHeight: 160 }}><Spin /></Flex>
      ) : !url ? (
        <Empty description={t('qualification.learning.videoUnavailable')} />
      ) : (
        <VideoPlayer url={url} title={first?.title} onWatchedChange={setWatched} disableSeek={gate} />
      )}
      <Flex align="center" justify="flex-end" gap={12} style={{ marginTop: 16 }}>
        {blocked ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('qualification.learning.watchToProceed')}
          </Text>
        ) : null}
        <Button type="primary" loading={nextLoading} disabled={blocked} onClick={onNext}>
          {t('qualification.learning.next')} <RightOutlined />
        </Button>
      </Flex>
    </ContentCard>
  );
}

function ScenarioMaterial({
  course,
  topic,
  onSubmit,
  onNext,
  submitting,
}: {
  course: string;
  topic: string;
  onSubmit: () => Promise<void>;
  onNext: () => void;
  submitting: boolean;
}) {
  const { t } = useTranslation();
  const q = useScenarios(course, topic);
  const first = q.data?.[0];
  const [answer, setAnswer] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const submitScenario = useSubmitScenario();

  const handleSubmit = () => {
    submitScenario
      .mutateAsync({ course, topic, answer, file })
      .then(() => onSubmit())
      .then(() => setSubmitted(true))
      .catch(() => {
      });
  };

  const handleSkip = () => {
    onSubmit()
      .then(() => onNext())
      .catch(() => {
      });
  };

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return f && f.type.startsWith('image/') ? URL.createObjectURL(f) : null;
    });
  };
  const clearFile = () => {
    setFile(null);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileRef.current) fileRef.current.value = '';
  };
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  return (
    <ContentCard>
      {q.isLoading ? (
        <Flex align="center" justify="center" style={{ minHeight: 120 }}><Spin /></Flex>
      ) : !first?.text ? (
        <>
          <Flex vertical align="center" gap={12} style={{ padding: '28px 0 4px' }}>
            <span
              style={{
                width: 68,
                height: 68,
                borderRadius: '50%',
                background: 'var(--color-fill-tertiary, #f1f5f9)',
                color: 'var(--color-text-quaternary, #94a3b8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 30,
              }}
            >
              <SolutionOutlined />
            </span>
            <Text type="secondary" style={{ fontSize: 14 }}>
              {t('qualification.learning.noScenario')}
            </Text>
          </Flex>
          <Flex justify="flex-end" style={{ marginTop: 8 }}>
            <Button type="primary" loading={submitting} onClick={handleSkip}>
              {t('qualification.learning.next')} <RightOutlined />
            </Button>
          </Flex>
        </>
      ) : submitted ? (
        <>
          <Flex align="center" gap={8} style={{ marginBottom: 14 }}>
            <CheckCircleFilled style={{ color: 'var(--brand-primary)' }} />
            <Text strong>{t('qualification.learning.answerSubmitted')}</Text>
          </Flex>
          <div style={{ padding: 14, borderRadius: 'var(--radius-lg)', background: 'var(--color-fill-tertiary, #f8fafc)', border: '1px solid var(--color-border)' }}>
            <Text style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-soft)', marginBottom: 4 }}>
              {t('qualification.learning.yourAnswer')}
            </Text>
            <Text style={{ whiteSpace: 'pre-wrap' }}>{answer}</Text>
            {file ? (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
                <Text style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-soft)', marginBottom: 6 }}>
                  {t('qualification.learning.attachedFileLabel')}
                </Text>
                {preview ? (
                  <img src={preview} alt={file.name} style={{ maxHeight: 200, maxWidth: '100%', borderRadius: 'var(--radius-md)', display: 'block' }} />
                ) : (
                  <Flex align="center" gap={8} style={{ padding: '8px 12px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                    <FileTextOutlined style={{ color: 'var(--color-text-soft)' }} />
                    <Text style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</Text>
                    <Text style={{ fontSize: 12, color: 'var(--color-text-quaternary, #94a3b8)', whiteSpace: 'nowrap' }}>{(file.size / 1024).toFixed(0)} KB</Text>
                  </Flex>
                )}
              </div>
            ) : null}
          </div>
          <Flex justify="flex-end" style={{ marginTop: 16 }}>
            <Button type="primary" onClick={onNext}>
              {t('qualification.learning.next')} <RightOutlined />
            </Button>
          </Flex>
        </>
      ) : (
        <>
          <Text strong style={{ display: 'block', marginBottom: 14 }}>
            {first?.title ?? t('qualification.learning.tab.scenario')}
          </Text>
          <div style={{ padding: 14, borderRadius: 'var(--radius-lg)', background: 'color-mix(in srgb, var(--brand-warning) 12%, #fff)', border: '1px solid color-mix(in srgb, var(--brand-warning) 30%, #fff)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, color: '#a16207', marginBottom: 4 }}>
              {t('qualification.learning.scenarioLabel')}
            </div>
            <Text style={{ whiteSpace: 'pre-wrap' }}>{first.text}</Text>
          </div>

          <div style={{ marginTop: 14 }}>
            <Text style={{ fontSize: 13, color: 'var(--color-text-soft)' }}>{t('qualification.learning.yourAnswer')}</Text>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={t('qualification.learning.answerPlaceholder')}
              rows={5}
              style={{ width: '100%', marginTop: 6, padding: '10px 12px', fontSize: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', resize: 'vertical', outline: 'none' }}
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <Text style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-soft)' }}>
              {t('qualification.learning.attachLabel')}
            </Text>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              onChange={pickFile}
              style={{ display: 'none' }}
            />
            {!file ? (
              <label
                onClick={() => fileRef.current?.click()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginTop: 6,
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-lg)',
                  border: '2px dashed var(--color-border)',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-fill-tertiary, #f1f5f9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-text-soft)',
                    fontSize: 16,
                  }}
                >
                  <PaperClipOutlined />
                </span>
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <Text style={{ fontSize: 14, fontWeight: 500 }}>{t('qualification.learning.attachSelect')}</Text>
                  <Text style={{ fontSize: 12, color: 'var(--color-text-quaternary, #94a3b8)' }}>
                    {t('qualification.learning.attachTypes')}
                  </Text>
                </span>
              </label>
            ) : (
              <div
                style={{
                  marginTop: 6,
                  padding: 12,
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {preview ? (
                  <img
                    src={preview}
                    alt={file.name}
                    style={{ maxHeight: 180, maxWidth: '100%', borderRadius: 'var(--radius-md)', marginBottom: 10, display: 'block' }}
                  />
                ) : null}
                <Flex align="center" gap={8}>
                  <span style={{ color: 'var(--brand-primary)', fontSize: 16, display: 'flex' }}>
                    {preview ? <FileImageOutlined /> : <FileTextOutlined />}
                  </span>
                  <Text style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: 'var(--color-text-quaternary, #94a3b8)', whiteSpace: 'nowrap' }}>
                    {(file.size / 1024).toFixed(0)} KB
                  </Text>
                  <Button type="text" size="small" icon={<CloseOutlined />} onClick={clearFile} />
                </Flex>
                <Button type="link" size="small" style={{ padding: 0, height: 'auto', marginTop: 6 }} onClick={() => fileRef.current?.click()}>
                  {t('qualification.learning.attachChange')}
                </Button>
              </div>
            )}
          </div>

          <Flex justify="flex-end" style={{ marginTop: 16 }}>
            <Button type="primary" loading={submitting || submitScenario.isPending} disabled={answer.trim().length < 10} onClick={handleSubmit}>
              {t('qualification.learning.submitAnswer')}
            </Button>
          </Flex>
        </>
      )}
    </ContentCard>
  );
}

function FinalTestTab({
  course,
  topic,
  isLast,
  onRunningChange,
  finishRef,
}: {
  course: MyCourse;
  topic: TopicProgress;
  isLast: boolean;
  onRunningChange?: (running: boolean) => void;
  finishRef?: React.MutableRefObject<(() => void) | null>;
}) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const startFinal = useStartFinal();
  const resumeFinal = useResumeFinal();
  const finishFinal = useFinishFinal();
  const qc = useQueryClient();
  const [test, setTest] = useState<ActiveTest | null>(null);
  const [result, setResult] = useState<FinalResult | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let alive = true;
    setChecking(true);
    resumeFinal.mutateAsync({ course: course.id, topic: topic.id }).then((active) => {
      if (alive && active && active.questions.length) setTest(active);
      if (alive) setChecking(false);
    });
    return () => {
      alive = false;
    };
  }, [topic.id]);

  const availableAt = topic.finalTestAvailableAt ? new Date(topic.finalTestAvailableAt).getTime() : 0;
  const gated = availableAt > Date.now();

  const begin = async () => {
    try {
      const active = await startFinal.mutateAsync({ course: course.id, topic: topic.id });
      setTest(active);
    } catch (e) {
      const active = await resumeFinal.mutateAsync({ course: course.id, topic: topic.id });
      if (active && active.questions.length) {
        setTest(active);
      } else {
        try {
          const r = await finishFinal.mutateAsync({ course: course.id, topic: topic.id });
          setResult(r);
        } catch {
          message.error(getApiErrorMessage(e) || t('qualification.learning.startError'));
        }
      }
    }
  };

  const onFinish = async () => {
    try {
      const r = await finishFinal.mutateAsync({ course: course.id, topic: topic.id });
      setTest(null);
      setResult(r);
    } catch (e) {
      message.error(getApiErrorMessage(e) || t('qualification.learning.errorGeneric'));
    }
  };

  useEffect(() => {
    onRunningChange?.(!!test);
  }, [test]);
  useEffect(() => {
    return () => onRunningChange?.(false);
  }, []);
  if (finishRef) finishRef.current = onFinish;

  if (test) {
    return (
      <TestRunner
        title={t('qualification.learning.finalTitle')}
        test={test}
        endpointKind="final"
        onFinish={onFinish}
        finishing={finishFinal.isPending}
      />
    );
  }

  if (checking && !result) {
    return (
      <ContentCard>
        <Flex align="center" justify="center" style={{ minHeight: 160 }}><Spin /></Flex>
      </ContentCard>
    );
  }

  if (topic.isCompleted && !result) {
    return (
      <ContentCard>
        <Flex vertical align="center" gap={18} style={{ padding: '44px 16px' }}>
          <span
            style={{
              width: 92,
              height: 92,
              borderRadius: '50%',
              background: 'var(--brand-primary-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'var(--brand-primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 30,
                boxShadow: '0 10px 24px color-mix(in srgb, var(--brand-primary) 42%, transparent)',
              }}
            >
              <CheckOutlined />
            </span>
          </span>
          <Flex vertical align="center" gap={6}>
            <Text strong style={{ fontSize: 18, color: 'var(--brand-primary)' }}>
              {t('qualification.learning.finalPassed')}
            </Text>
            <Text type="secondary" style={{ fontSize: 13, textAlign: 'center', maxWidth: 340 }}>
              {isLast ? t('qualification.learning.finalPassedLastHint') : t('qualification.learning.finalPassedHint')}
            </Text>
          </Flex>
        </Flex>
      </ContentCard>
    );
  }

  return (
    <ContentCard>
      {gated ? (
        <Flex vertical align="center" gap={10} style={{ padding: '32px 0' }}>
          <ClockCircleOutlined style={{ fontSize: 40, color: 'var(--brand-warning)' }} />
          <Text strong>{t('qualification.learning.finalLockedByDuration')}</Text>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('qualification.learning.finalAvailableAt', { time: fmtTime(topic.finalTestAvailableAt) })}
          </Text>
        </Flex>
      ) : (
        <Flex vertical align="center" gap={14} style={{ padding: '32px 0' }}>
          <Text type="secondary" style={{ textAlign: 'center' }}>
            {t('qualification.learning.finalIntro', { p: topic.passPercentage })}
          </Text>
          <Button type="primary" loading={startFinal.isPending || resumeFinal.isPending} onClick={begin}>
            {t('qualification.learning.startTest')}
          </Button>
        </Flex>
      )}

      <FinalResultModal
        result={result}
        onClose={() => {
          setResult(null);
          qc.invalidateQueries({ queryKey: ['qual-learning', 'my', course.id] });
        }}
      />
    </ContentCard>
  );
}

function FinalResultModal({ result, onClose }: { result: FinalResult | null; onClose: () => void }) {
  const { t } = useTranslation();
  const passed = !!result?.isPassed;
  const total = result?.totalQuestions ?? 0;
  const correct = result?.totalCorrects ?? 0;
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const accent = passed ? 'var(--brand-primary)' : 'var(--brand-error)';
  return (
    <Modal centered open={!!result} onCancel={onClose} footer={null} title={t('qualification.learning.finalTitle')} width={400}>
      {result ? (
        <Flex vertical align="center" gap={14} style={{ padding: '8px 0' }}>
          <div style={{ width: 100, height: 100, borderRadius: '50%', border: `4px solid ${accent}`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700 }}>
            {pct}%
          </div>
          <Text strong style={{ color: accent, textAlign: 'center' }}>
            {passed ? t('qualification.learning.finalPassed') : t('qualification.learning.finalFailed')}
          </Text>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('qualification.learning.finalScore', { c: correct, n: total })}
          </Text>
          <Button type="primary" block onClick={onClose}>
            {t('qualification.learning.close')}
          </Button>
        </Flex>
      ) : null}
    </Modal>
  );
}

const OPT_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function TestRunner({
  title,
  test,
  endpointKind,
  onFinish,
  finishing,
}: {
  title: string;
  test: ActiveTest;
  endpointKind: 'entrance' | 'final';
  onFinish: () => void;
  finishing: boolean;
}) {
  const { t } = useTranslation();
  const fullscreen = endpointKind === 'entrance';
  const selectEntrance = useSelectEntranceOption();
  const selectFinal = useSelectFinalOption();
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState<Record<string, string[]>>(() => {
    const m: Record<string, string[]> = {};
    test.questions.forEach((q) => {
      m[q.id] = q.options.filter((o) => o.isSelected).map((o) => o.id);
    });
    return m;
  });
  const [timeLeft, setTimeLeft] = useState(test.remainingTime);

  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
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

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  useEffect(() => {
    const pushSentinel = () =>
      window.history.pushState(window.history.state, '', window.location.href);
    pushSentinel();
    const onPop = () => {
      pushSentinel();
      setLeaveOpen(true);
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);

  const q = test.questions[idx];
  const total = test.questions.length;

  const pick = (questionId: string, optionId: string, testType: TestType) => {
    setSel((prev) => {
      const cur = prev[questionId] ?? [];
      const next = testType === 1 ? [optionId] : cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId];
      return { ...prev, [questionId]: next };
    });
    const payload = { resultId: test.resultId, questionId, optionId };
    if (endpointKind === 'entrance') selectEntrance.mutate(payload);
    else selectFinal.mutate(payload);
  };

  if (!q) return null;
  const answered = Object.values(sel).filter((a) => a.length > 0).length;
  const danger = timeLeft < 60;

  return (
    <div
      style={
        fullscreen
          ? { position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--color-bg-elevate)', overflowY: 'auto', padding: '24px 16px' }
          : {}
      }
    >
    <Flex vertical gap={16} style={{ maxWidth: fullscreen ? 960 : undefined, width: '100%', margin: fullscreen ? '0 auto' : undefined }}>
      <Card size="small" styles={{ body: { padding: '12px 20px' } }}>
        <Flex align="center" justify="space-between" gap={12} wrap>
          <Flex align="center" gap={8} style={{ minWidth: 0 }}>
            <Text strong style={{ fontSize: 15 }}>{title}</Text>
            <Text type="secondary" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
              · {t('qualification.learning.answeredCount', { a: answered, n: total })}
            </Text>
          </Flex>
          <Flex align="center" gap={8} style={{ padding: '5px 14px', borderRadius: 'var(--radius-pill)', background: danger ? 'color-mix(in srgb, var(--brand-error) 12%, #fff)' : 'var(--color-bg-elevate)' }}>
            <ClockCircleOutlined style={{ color: danger ? 'var(--brand-error)' : 'var(--color-text-soft)' }} />
            <Text strong style={{ fontVariantNumeric: 'tabular-nums', color: danger ? 'var(--brand-error)' : 'var(--color-text)' }}>{mmss(timeLeft)}</Text>
          </Flex>
          <Button type="primary" onClick={() => setFinishOpen(true)}>
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
    </Flex>

      <Modal
        centered
        open={finishOpen}
        zIndex={1100}
        footer={null}
        onCancel={() => setFinishOpen(false)}
        width={420}
      >
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
            <Button block size="large" onClick={() => setFinishOpen(false)}>
              {t('qualification.learning.cancel')}
            </Button>
            <Button
              block
              size="large"
              type="primary"
              loading={finishing}
              onClick={() => {
                setFinishOpen(false);
                onFinish();
              }}
            >
              {t('qualification.learning.finish')}
            </Button>
          </Flex>
        </Flex>
      </Modal>

      <Modal
        centered
        open={leaveOpen}
        zIndex={1100}
        footer={null}
        onCancel={() => setLeaveOpen(false)}
        width={430}
      >
        <Flex vertical align="center" gap={14} style={{ padding: '8px 4px 0' }}>
          <span style={{ width: 66, height: 66, borderRadius: '50%', background: 'color-mix(in srgb, var(--brand-warning) 16%, #fff)', color: 'rgb(234, 179, 8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
            <WarningFilled />
          </span>
          <Text strong style={{ fontSize: 17 }}>{t('qualification.learning.leaveTitle')}</Text>
          <Text type="secondary" style={{ textAlign: 'center', fontSize: 14 }}>
            {t('qualification.learning.leaveBody')}
          </Text>
          <Flex gap={10} style={{ width: '100%', marginTop: 6 }}>
            <Button block size="large" onClick={() => setLeaveOpen(false)}>
              {t('qualification.learning.leaveStay')}
            </Button>
            <Button
              block
              size="large"
              danger
              type="primary"
              loading={finishing}
              onClick={() => {
                setLeaveOpen(false);
                onFinish();
              }}
            >
              {t('qualification.learning.leaveConfirm')}
            </Button>
          </Flex>
        </Flex>
      </Modal>
    </div>
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
