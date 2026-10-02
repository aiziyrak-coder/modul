import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeftOutlined,
  BookOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleFilled,
  CloseCircleOutlined,
  DownOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  LoginOutlined,
  LogoutOutlined,
  PictureOutlined,
  ReadOutlined,
  UpOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Card, Empty, Flex, Modal, Skeleton, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { PageContainer } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useStudentDetail } from '../../../../api/monitoring-api';
import type {
  StudentDetailTopic,
  StudentTestCard,
  TopicTestAnswer,
  TopicTestOption,
} from '../../../../model/monitoring.types';
import { downloadExcelAoa } from '../../../../lib/excel';
import ExcelExportButton from '../../../../components/excel-export-button';

const { Text, Title } = Typography;
type Tr = (k: string, o?: Record<string, unknown>) => string;

const backTo = (pathname: string) =>
  pathname.includes('/reports/')
    ? '/qualification/manager/reports'
    : '/qualification/manager/monitoring/students';

const scoreColor = (p: number) =>
  p >= 80 ? 'var(--brand-primary)' : p >= 60 ? 'var(--brand-warning)' : 'var(--brand-error)';

const scoreTag = (p: number) => (p >= 80 ? 'green' : p >= 60 ? 'gold' : 'red');

const fmtDate = (iso: string | null | undefined, withTime = false) =>
  iso ? dayjs(iso).format(withTime ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD') : '—';

const panelBtnStyle = (active: boolean, color: string): CSSProperties =>
  active
    ? { borderRadius: 'var(--radius-md)', background: color, borderColor: color, color: '#fff', fontWeight: 500 }
    : {
        borderRadius: 'var(--radius-md)',
        background: `color-mix(in srgb, ${color} 8%, #fff)`,
        borderColor: `color-mix(in srgb, ${color} 35%, #fff)`,
        color,
        fontWeight: 500,
      };

function ScoreBadge({ percent }: { percent: number }) {
  return (
    <Tag color={scoreTag(percent)} style={{ fontWeight: 700, margin: 0, borderRadius: 'var(--radius-md)' }}>
      {percent}%
    </Tag>
  );
}

function optionStyle(o: TopicTestOption): CSSProperties {
  if (o.isCorrect) {
    return {
      background: 'color-mix(in srgb, var(--brand-primary) 10%, #fff)',
      border: '1px solid var(--brand-primary)',
    };
  }
  if (o.isSelected) {
    return {
      background: 'color-mix(in srgb, var(--brand-error) 10%, #fff)',
      border: '1px solid var(--brand-error)',
    };
  }
  return {
    background: 'var(--color-fill-tertiary, #f8fafc)',
    border: '1px solid var(--color-border-soft, #eef2f6)',
  };
}

function TestAnswersPanel({ answers, t }: { answers: TopicTestAnswer[]; t: Tr }) {
  const correctCount = answers.filter((a) => a.isCorrect).length;
  const pct = answers.length ? Math.round((correctCount / answers.length) * 100) : 0;
  return (
    <Flex vertical gap={12}>
      <Flex
        align="center"
        gap={8}
        wrap
        style={{
          padding: '8px 12px',
          background: 'var(--color-fill-tertiary, #f8fafc)',
          border: '1px solid var(--color-border-soft, #eef2f6)',
          borderRadius: 10,
        }}
      >
        <Text type="secondary" style={{ fontWeight: 600 }}>
          {t('qualification.studentDetail.panelResult')}:
        </Text>
        <Text strong style={{ color: 'var(--brand-primary)' }}>
          {correctCount} {t('qualification.studentDetail.correctWord')}
        </Text>
        <Text type="secondary">/</Text>
        <Text strong style={{ color: 'var(--brand-error)' }}>
          {answers.length - correctCount} {t('qualification.studentDetail.wrongWord')}
        </Text>
        <Text strong style={{ marginLeft: 'auto', color: scoreColor(pct) }}>
          {pct}%
        </Text>
      </Flex>

      {answers.map((a, i) => (
        <div
          key={i}
          style={{ border: '1px solid var(--color-border-soft, #eef2f6)', borderRadius: 10, padding: 12 }}
        >
          <Flex align="flex-start" gap={8}>
            {a.isCorrect ? (
              <CheckCircleFilled style={{ color: 'var(--brand-primary)', marginTop: 3 }} />
            ) : (
              <CloseCircleFilled style={{ color: 'var(--brand-error)', marginTop: 3 }} />
            )}
            <Text strong>
              <Text type="secondary" style={{ marginRight: 4 }}>
                {i + 1}.
              </Text>
              {a.question}
            </Text>
          </Flex>
          <Flex vertical gap={6} style={{ marginTop: 8, paddingLeft: 24 }}>
            {a.options.map((o, j) => (
              <Flex
                key={j}
                align="center"
                gap={8}
                style={{ padding: '6px 10px', borderRadius: 8, ...optionStyle(o) }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                    color: '#fff',
                    background: o.isCorrect
                      ? 'var(--brand-primary)'
                      : o.isSelected
                        ? 'var(--brand-error)'
                        : 'var(--color-text-mute, #9aa3b2)',
                  }}
                >
                  {String.fromCharCode(65 + j)}
                </span>
                <Text style={{ fontSize: 13, flex: 1 }}>{o.text}</Text>
                {o.isCorrect ? (
                  <CheckCircleOutlined style={{ color: 'var(--brand-primary)' }} />
                ) : o.isSelected ? (
                  <CloseCircleOutlined style={{ color: 'var(--brand-error)' }} />
                ) : null}
              </Flex>
            ))}
          </Flex>
        </div>
      ))}
    </Flex>
  );
}

function CaseStudyPanel({ topic, t }: { topic: StudentDetailTopic; t: Tr }) {
  const [imgOpen, setImgOpen] = useState(false);
  return (
    <Flex vertical gap={12}>
      <div
        style={{
          background: 'color-mix(in srgb, var(--color-info, #2f80ed) 7%, #fff)',
          border: '1px solid color-mix(in srgb, var(--color-info, #2f80ed) 30%, #fff)',
          borderRadius: 10,
          padding: 12,
        }}
      >
        <Text
          type="secondary"
          style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}
        >
          {t('qualification.studentDetail.caseQuestion')}
        </Text>
        <Text style={{ fontSize: 13 }}>{topic.scenarioQuestion}</Text>
      </div>

      <div style={{ border: '1px solid var(--color-border-soft, #eef2f6)', borderRadius: 10, padding: 12 }}>
        <Text
          type="secondary"
          style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}
        >
          {t('qualification.studentDetail.caseAnswer')}
        </Text>
        <Text style={{ fontSize: 13 }}>
          {topic.scenarioAnswer ?? <Text type="secondary">—</Text>}
        </Text>
      </div>

      {topic.scenarioImage ? (
        <Flex vertical gap={6}>
          <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
            <PictureOutlined style={{ marginRight: 6 }} />
            {t('qualification.studentDetail.attachedImage')}
          </Text>
          <button
            type="button"
            onClick={() => setImgOpen(true)}
            style={{
              padding: 0,
              border: '2px solid var(--color-border-soft, #eef2f6)',
              borderRadius: 12,
              overflow: 'hidden',
              cursor: 'pointer',
              maxWidth: 360,
              background: 'none',
            }}
          >
            <img
              src={topic.scenarioImage}
              alt=""
              style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }}
            />
            <div
              style={{
                fontSize: 12,
                textAlign: 'center',
                padding: '6px 0',
                background: 'var(--color-fill-tertiary, #f8fafc)',
                color: 'var(--color-text-mute, #9aa3b2)',
              }}
            >
              {t('qualification.studentDetail.clickToEnlarge')}
            </div>
          </button>
          <Modal
            open={imgOpen}
            title={t('qualification.studentDetail.attachedImage')}
            footer={null}
            onCancel={() => setImgOpen(false)}
            width={720}
            centered
          >
            <Flex justify="center">
              <img
                src={topic.scenarioImage}
                alt=""
                style={{ maxWidth: '100%', maxHeight: '72vh', borderRadius: 10, objectFit: 'contain' }}
              />
            </Flex>
          </Modal>
        </Flex>
      ) : (
        <Text type="secondary" italic style={{ fontSize: 13 }}>
          <PictureOutlined style={{ marginRight: 6 }} />
          {t('qualification.studentDetail.noImage')}
        </Text>
      )}
    </Flex>
  );
}

function TestResultCard({
  title,
  icon,
  card,
  notTaken,
  t,
}: {
  title: string;
  icon: ReactNode;
  card: StudentTestCard | null;
  notTaken: string;
  t: Tr;
}) {
  return (
    <Card size="small" styles={{ body: { padding: 16 } }}>
      <Flex justify="space-between" align="center" style={{ marginBottom: card ? 12 : 0 }}>
        <Flex align="center" gap={8}>
          {icon}
          <Text strong style={{ fontSize: 13 }}>
            {title}
          </Text>
        </Flex>
        {card && card.isPassed !== undefined ? (
          <Tag color={card.isPassed ? 'green' : 'red'} style={{ margin: 0 }}>
            {card.isPassed ? t('qualification.studentDetail.passed') : t('qualification.studentDetail.failed')}
          </Tag>
        ) : null}
      </Flex>
      {card ? (
        <Flex align="center" gap={32} wrap>
          {card.date ? (
            <Flex align="center" gap={6}>
              <CalendarOutlined style={{ color: 'var(--color-text-mute, #9aa3b2)' }} />
              <div>
                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                  {t('qualification.studentDetail.dateLabel')}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: 500 }}>{fmtDate(card.date)}</Text>
              </div>
            </Flex>
          ) : null}
          <div>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>
              {t('qualification.studentDetail.ballLabel')}
            </Text>
            <ScoreBadge percent={card.percent} />
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
              {t('qualification.studentDetail.natijaLabel')}
            </Text>
            <Text strong style={{ fontSize: 13 }}>
              {card.correct}/{card.total}
            </Text>
          </div>
        </Flex>
      ) : (
        <Flex align="center" gap={8}>
          <ClockCircleOutlined style={{ color: 'var(--color-text-mute, #9aa3b2)' }} />
          <Text type="secondary" italic style={{ fontSize: 13 }}>
            {notTaken}
          </Text>
        </Flex>
      )}
    </Card>
  );
}

function StatusIcon({ status }: { status: StudentDetailTopic['status'] }) {
  if (status === 'completed') return <CheckCircleFilled style={{ color: 'var(--brand-primary)' }} />;
  if (status === 'in_progress') return <ClockCircleOutlined style={{ color: 'var(--brand-warning)' }} />;
  return <ExclamationCircleOutlined style={{ color: 'var(--color-text-mute, #9aa3b2)' }} />;
}

function TopicCard({ topic, t }: { topic: StudentDetailTopic; t: Tr }) {
  const [open, setOpen] = useState<'test' | 'case' | null>(null);
  const toggle = (p: 'test' | 'case') => setOpen((prev) => (prev === p ? null : p));

  const accent =
    topic.status === 'completed'
      ? 'var(--brand-primary)'
      : topic.status === 'in_progress'
        ? 'var(--brand-warning)'
        : 'var(--color-border, #cbd5e1)';
  const headerBg =
    topic.status === 'completed'
      ? 'color-mix(in srgb, var(--brand-primary) 7%, #fff)'
      : topic.status === 'in_progress'
        ? 'color-mix(in srgb, var(--brand-warning) 8%, #fff)'
        : 'var(--color-fill-tertiary, #f8fafc)';

  return (
    <div
      style={{
        border: `1px solid color-mix(in srgb, ${accent} 35%, #fff)`,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <Flex align="center" gap={12} style={{ padding: '12px 16px', background: headerBg }}>
        <StatusIcon status={topic.status} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text strong style={{ display: 'block' }}>
            {topic.orderNumber}. {topic.title}
          </Text>
          {topic.submittedAt ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              {fmtDate(topic.submittedAt, true)}
            </Text>
          ) : null}
        </div>
        {topic.status === 'in_progress' ? (
          <Tag color="gold" style={{ margin: 0 }}>
            {t('qualification.studentDetail.statusInProgress')}
          </Tag>
        ) : null}
        {topic.status === 'not_started' ? (
          <Text type="secondary" italic style={{ fontSize: 12 }}>
            {t('qualification.studentDetail.notStartedYet')}
          </Text>
        ) : null}
        {topic.percent !== null ? <ScoreBadge percent={topic.percent} /> : null}
      </Flex>

      {topic.status === 'completed' ? (
        <Flex
          gap={8}
          wrap
          style={{ padding: '10px 16px', borderTop: '1px solid var(--color-border-soft, #eef2f6)', background: '#fff' }}
        >
          <Button
            size="small"
            icon={<BookOutlined />}
            onClick={() => toggle('test')}
            style={panelBtnStyle(open === 'test', 'var(--brand-primary)')}
          >
            {t('qualification.studentDetail.testResults')} ({topic.correct}/{topic.total}){' '}
            {open === 'test' ? <UpOutlined /> : <DownOutlined />}
          </Button>
          {topic.scenarioQuestion ? (
            <Button
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => toggle('case')}
              style={panelBtnStyle(open === 'case', 'var(--color-info, #2f80ed)')}
            >
              {t('qualification.studentDetail.caseStudy')} {open === 'case' ? <UpOutlined /> : <DownOutlined />}
            </Button>
          ) : null}
        </Flex>
      ) : null}

      {open ? (
        <div style={{ borderTop: '1px solid var(--color-border-soft, #eef2f6)', background: '#fff', padding: 16 }}>
          {open === 'test' ? <TestAnswersPanel answers={topic.testAnswers} t={t} /> : <CaseStudyPanel topic={topic} t={t} />}
        </div>
      ) : null}
    </div>
  );
}

export default function StudentDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { id = '' } = useParams<{ id: string }>();
  const { data, isLoading } = useStudentDetail(id);

  const onExport = () => {
    if (!data) return;
    const et = data.entranceTest;
    const xt = data.exitTest;
    const statusLabel = (s: StudentDetailTopic['status']) =>
      t(
        s === 'completed'
          ? 'qualification.studentDetail.statusCompleted'
          : s === 'in_progress'
            ? 'qualification.studentDetail.statusInProgress'
            : 'qualification.studentDetail.statusNotStarted',
      );

    const general: Array<Array<string | number>> = [
      [t('qualification.studentDetail.xlFio'), data.listenerName],
      [t('qualification.monitoring.colCourse'), data.courseName],
      [],
      [t('qualification.studentDetail.entranceTest')],
      [
        t('qualification.studentDetail.xlDate'),
        t('qualification.studentDetail.xlBallPct'),
        t('qualification.studentDetail.xlCorrect'),
        t('qualification.studentDetail.xlTotal'),
      ],
      et
        ? [fmtDate(et.date), `${et.percent}%`, et.correct, et.total]
        : ['—', '—', '—', '—'],
      [],
      [t('qualification.studentDetail.exitTest')],
      [
        t('qualification.studentDetail.xlDate'),
        t('qualification.studentDetail.xlBallPct'),
        t('qualification.studentDetail.xlCorrect'),
        t('qualification.studentDetail.xlTotal'),
        t('qualification.studentDetail.colStatus'),
      ],
      xt
        ? [
            fmtDate(xt.date),
            `${xt.percent}%`,
            xt.correct,
            xt.total,
            xt.isPassed
              ? t('qualification.studentDetail.passed')
              : t('qualification.studentDetail.failed'),
          ]
        : [t('qualification.studentDetail.notTaken'), '', '', '', ''],
    ];

    const topics: Array<Array<string | number>> = [
      [
        '#',
        t('qualification.studentDetail.colTopic'),
        t('qualification.studentDetail.colStatus'),
        t('qualification.studentDetail.xlBallPct'),
        t('qualification.studentDetail.xlSubmittedAt'),
      ],
      ...data.topics.map((r, i) => [
        i + 1,
        `${r.orderNumber}. ${r.title}`,
        statusLabel(r.status),
        r.percent == null ? '—' : `${r.percent}%`,
        r.submittedAt ? fmtDate(r.submittedAt, true) : '—',
      ]),
    ];

    downloadExcelAoa(
      [
        { name: t('qualification.studentDetail.xlSheetGeneral'), aoa: general, colWidths: [18, 24, 12, 10, 12] },
        { name: t('qualification.studentDetail.xlSheetTopics'), aoa: topics, colWidths: [5, 34, 14, 12, 20] },
      ],
      `${data.listenerName.replace(/\s+/g, '_')}_hisobot.xlsx`,
    );
  };

  return (
    <PageContainer title={t('qualification.studentDetail.title')}>
      <Flex align="center" gap={8} style={{ marginBottom: 16 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(backTo(location.pathname))}>
          {location.pathname.includes('/reports/')
            ? t('qualification.reports.nav')
            : t('qualification.monitoring.studentsNav')}
        </Button>
        <Text type="secondary">/</Text>
        <Text strong style={{ flex: 1 }}>
          {data?.listenerName ?? '...'}
        </Text>
        {data ? (
          <ExcelExportButton onClick={onExport} />
        ) : null}
      </Flex>

      {isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : !data ? (
        <Empty description={t('qualification.studentDetail.notFound')} style={{ padding: '48px 0' }} />
      ) : (
        <Flex vertical gap={16}>
          <Card styles={{ body: { padding: 20 } }}>
            <Flex align="center" gap={16} wrap>
              <Avatar
                size={48}
                icon={<ReadOutlined />}
                style={{ background: 'color-mix(in srgb, var(--brand-primary) 15%, #fff)', color: 'var(--brand-primary)', flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 200 }}>
                <Title level={5} style={{ margin: 0 }}>
                  {data.listenerName}
                </Title>
                <Text type="secondary">{data.courseName}</Text>
              </div>
              <Flex align="center" gap={24}>
                <div style={{ textAlign: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                    {t('qualification.studentDetail.mavzular')}
                  </Text>
                  <Text strong style={{ fontSize: 15 }}>
                    {data.passedTopics}/{data.totalTopics}
                  </Text>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>
                    {t('qualification.studentDetail.bajarilish')}
                  </Text>
                  <ScoreBadge percent={data.percent} />
                </div>
              </Flex>
            </Flex>
          </Card>

          <TestResultCard
            title={t('qualification.studentDetail.entranceResult')}
            icon={<LoginOutlined style={{ color: 'var(--color-text-mute, #9aa3b2)' }} />}
            card={data.entranceTest}
            notTaken={t('qualification.studentDetail.notTaken')}
            t={t}
          />

          <div>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>
              {t('qualification.studentDetail.topicsTitle')}
            </Text>
            <Flex vertical gap={12}>
              {data.topics.map((topic) => (
                <TopicCard key={topic.topicId} topic={topic} t={t} />
              ))}
            </Flex>
          </div>

          <TestResultCard
            title={t('qualification.studentDetail.exitResult')}
            icon={<LogoutOutlined style={{ color: 'var(--color-text-mute, #9aa3b2)' }} />}
            card={data.exitTest}
            notTaken={t('qualification.studentDetail.exitNotTakenMsg')}
            t={t}
          />
        </Flex>
      )}
      <div aria-hidden style={{ height: 'var(--space-8, 40px)', flexShrink: 0 }} />
    </PageContainer>
  );
}
