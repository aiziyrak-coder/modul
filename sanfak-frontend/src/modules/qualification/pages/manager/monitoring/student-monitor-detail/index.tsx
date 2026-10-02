import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeftOutlined,
  BookOutlined,
  CommentOutlined,
  FileImageOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  MessageOutlined,
  ProfileOutlined,
  ReadOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Card, Empty, Flex, Modal, Skeleton, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { PageContainer } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useStudentDetail } from '../../../../api/monitoring-api';
import type { StudentDetailTopic, StudentTestCard } from '../../../../model/monitoring.types';
import { downloadExcelSheets } from '../../../../lib/excel';
import { ScrollBox } from '../../../../components/scroll-box';
import ExcelExportButton from '../../../../components/excel-export-button';

const { Text, Title } = Typography;
type Tr = (k: string, o?: Record<string, unknown>) => string;

const scoreColor = (p: number) =>
  p >= 80 ? 'var(--brand-primary)' : p >= 60 ? 'var(--brand-warning)' : 'var(--brand-error)';
const scoreTag = (p: number) => (p >= 80 ? 'green' : p >= 60 ? 'gold' : 'red');
const fmtDate = (iso: string | null | undefined) => (iso ? dayjs(iso).format('YYYY-MM-DD') : '—');

const IMG_EXT = /\.(jpe?g|png|gif|webp|svg|bmp|avif)(\?.*)?$/i;

function ScoreBadge({ percent }: { percent: number }) {
  return (
    <Tag color={scoreTag(percent)} style={{ fontWeight: 700, margin: 0, borderRadius: 'var(--radius-md)' }}>
      {percent}%
    </Tag>
  );
}

function SectionHeader({ icon, title, accent }: { icon: ReactNode; title: string; accent: string }) {
  return (
    <Flex align="center" gap={8} style={{ marginBottom: 10 }}>
      <span style={{ color: accent, display: 'inline-flex', fontSize: 16 }}>{icon}</span>
      <Text strong style={{ fontSize: 15 }}>
        {title}
      </Text>
    </Flex>
  );
}

function ScenarioCell({
  text,
  icon,
  color,
  onOpen,
}: {
  text: string | null;
  icon: ReactNode;
  color: string;
  onOpen: () => void;
}) {
  if (!text) return <Text type="secondary">—</Text>;
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        maxWidth: 180,
        padding: 0,
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span style={{ color, display: 'inline-flex', flexShrink: 0 }}>{icon}</span>
      <Text style={{ color, maxWidth: 150 }} ellipsis>
        {text}
      </Text>
    </button>
  );
}

function AttachmentCell({ url, onZoom, t }: { url: string | null; onZoom: (u: string) => void; t: Tr }) {
  if (!url)
    return (
      <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
        <FileImageOutlined style={{ marginRight: 4 }} />
        {t('qualification.studentDetail.noFile')}
      </Text>
    );

  if (IMG_EXT.test(url))
    return (
      <button
        type="button"
        onClick={() => onZoom(url)}
        style={{
          padding: 0,
          border: '1px solid var(--color-border-soft, #eef2f6)',
          borderRadius: 8,
          overflow: 'hidden',
          cursor: 'pointer',
          background: 'none',
          display: 'block',
        }}
      >
        <img src={url} alt="" style={{ width: 64, height: 44, objectFit: 'cover', display: 'block' }} />
      </button>
    );

  const ext = (url.split('?')[0]?.split('.').pop() ?? '').toLowerCase();
  const isPdf = ext === 'pdf';
  const isWord = ext === 'doc' || ext === 'docx';
  const icon = isPdf ? (
    <FilePdfOutlined style={{ color: 'var(--brand-error)' }} />
  ) : isWord ? (
    <FileWordOutlined style={{ color: 'var(--color-info, #2f80ed)' }} />
  ) : (
    <FileOutlined style={{ color: 'var(--color-text-mute, #9aa3b2)' }} />
  );
  const label = isPdf ? 'PDF' : isWord ? 'Word' : t('qualification.studentDetail.colScenarioFile');

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: 'var(--color-info, #2f80ed)',
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {label}
    </a>
  );
}

function StatusTag({ status, t }: { status: StudentDetailTopic['status']; t: Tr }) {
  if (status === 'completed')
    return (
      <Tag color="green" style={{ margin: 0, borderRadius: 'var(--radius-md)' }}>
        {t('qualification.studentDetail.statusCompleted')}
      </Tag>
    );
  if (status === 'in_progress')
    return (
      <Tag color="gold" style={{ margin: 0, borderRadius: 'var(--radius-md)' }}>
        {t('qualification.studentDetail.statusInProgress')}
      </Tag>
    );
  return (
    <Tag style={{ margin: 0, borderRadius: 'var(--radius-md)' }}>
      {t('qualification.studentDetail.statusNotStarted')}
    </Tag>
  );
}

export default function StudentMonitorDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id = '' } = useParams<{ id: string }>();
  const { data, isLoading } = useStudentDetail(id);

  const [textModal, setTextModal] = useState<{ title: string; text: string } | null>(null);
  const [zoomImg, setZoomImg] = useState<string | null>(null);

  const onExport = () => {
    if (!data) return;
    const et = data.entranceTest;
    const statusLabel = (s: StudentDetailTopic['status']) =>
      t(
        s === 'completed'
          ? 'qualification.studentDetail.statusCompleted'
          : s === 'in_progress'
            ? 'qualification.studentDetail.statusInProgress'
            : 'qualification.studentDetail.statusNotStarted',
      );

    downloadExcelSheets(
      [
        {
          name: t('qualification.studentDetail.entranceTest'),
          rows: [
            {
              [t('qualification.studentDetail.dateLabel')]: et ? fmtDate(et.date) : '—',
              [t('qualification.studentDetail.colSolved')]: et ? et.correct : '—',
              [t('qualification.studentDetail.colTotalQ')]: et ? et.total : '—',
              [t('qualification.studentDetail.xlBallPct')]: et ? `${et.percent}%` : '—',
            },
          ],
          colWidths: [14, 16, 14, 10],
        },
        {
          name: t('qualification.studentDetail.xlSheetTopics'),
          rows: data.topics.map((r, i) => ({
            '#': i + 1,
            [t('qualification.studentDetail.colTopic')]: `${r.orderNumber}. ${r.title}`,
            [t('qualification.studentDetail.colScenarioQ')]: r.scenarioQuestion ?? '—',
            [t('qualification.studentDetail.colScenarioA')]: r.scenarioAnswer ?? '—',
            [t('qualification.studentDetail.correct')]:
              r.correct == null ? '—' : `${r.correct} / ${r.total}`,
            [t('qualification.studentDetail.xlBallPct')]: r.percent == null ? '—' : `${r.percent}%`,
            [t('qualification.studentDetail.colStatus')]: statusLabel(r.status),
          })),
          colWidths: [5, 30, 32, 32, 12, 10, 14],
        },
      ],
      `${data.listenerName.replace(/\s+/g, '_')}_natijalari.xlsx`,
    );
  };

  const entranceColumns: TableColumnsType<StudentTestCard> = [
    {
      title: t('qualification.studentDetail.dateLabel'),
      key: 'date',
      render: (_, r) => <Text style={{ fontWeight: 500 }}>{fmtDate(r.date)}</Text>,
    },
    {
      title: t('qualification.studentDetail.colSolved'),
      key: 'correct',
      render: (_, r) => (
        <Text strong style={{ color: 'var(--brand-primary)' }}>
          {r.correct}
        </Text>
      ),
    },
    {
      title: t('qualification.studentDetail.colTotalQ'),
      key: 'total',
      render: (_, r) => <Text type="secondary">{r.total}</Text>,
    },
    {
      title: t('qualification.studentDetail.xlBallPct'),
      key: 'percent',
      align: 'right',
      render: (_, r) => <ScoreBadge percent={r.percent} />,
    },
  ];

  const topicColumns: TableColumnsType<StudentDetailTopic> = [
    {
      title: '#',
      key: 'idx',
      width: 48,
      render: (_, __, i) => <Text type="secondary">{i + 1}</Text>,
    },
    {
      title: t('qualification.studentDetail.colTopic'),
      key: 'topic',
      render: (_, r) => (
        <Text strong style={{ fontSize: 13 }}>
          {r.title}
        </Text>
      ),
    },
    {
      title: t('qualification.studentDetail.colScenarioQ'),
      key: 'sq',
      render: (_, r) => (
        <ScenarioCell
          text={r.scenarioQuestion}
          icon={<MessageOutlined />}
          color="var(--color-info, #2f80ed)"
          onOpen={() =>
            setTextModal({
              title: `${t('qualification.studentDetail.colScenarioQ')} — ${r.title}`,
              text: r.scenarioQuestion ?? '',
            })
          }
        />
      ),
    },
    {
      title: t('qualification.studentDetail.colScenarioA'),
      key: 'sa',
      render: (_, r) => (
        <ScenarioCell
          text={r.scenarioAnswer}
          icon={<CommentOutlined />}
          color="var(--brand-primary)"
          onOpen={() =>
            setTextModal({
              title: `${t('qualification.studentDetail.colScenarioA')} — ${r.title}`,
              text: r.scenarioAnswer ?? '',
            })
          }
        />
      ),
    },
    {
      title: t('qualification.studentDetail.colImage'),
      key: 'img',
      width: 110,
      render: (_, r) => <AttachmentCell url={r.scenarioImage} onZoom={setZoomImg} t={t} />,
    },
    {
      title: t('qualification.studentDetail.correct'),
      key: 'correct',
      width: 110,
      render: (_, r) =>
        r.correct == null ? (
          <Text type="secondary">—</Text>
        ) : (
          <Text>
            <Text strong style={{ color: scoreColor(r.percent ?? 0) }}>
              {r.correct}
            </Text>
            <Text type="secondary"> / {r.total}</Text>
          </Text>
        ),
    },
    {
      title: t('qualification.studentDetail.xlBallPct'),
      key: 'percent',
      width: 90,
      render: (_, r) =>
        r.percent == null ? (
          <Text type="secondary">—</Text>
        ) : (
          <Text strong style={{ color: scoreColor(r.percent) }}>
            {r.percent}%
          </Text>
        ),
    },
    {
      title: t('qualification.studentDetail.colStatus'),
      key: 'status',
      width: 130,
      render: (_, r) => <StatusTag status={r.status} t={t} />,
    },
  ];

  return (
    <PageContainer title={t('qualification.studentDetail.title')}>
      <Flex align="center" gap={8} style={{ marginBottom: 16 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/qualification/manager/monitoring/students')}
        >
          {t('qualification.monitoring.studentsNav')}
        </Button>
        <Text type="secondary">/</Text>
        <Text strong>{data?.listenerName ?? '...'}</Text>
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
                style={{
                  background: 'color-mix(in srgb, var(--brand-primary) 15%, #fff)',
                  color: 'var(--brand-primary)',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 200 }}>
                <Title level={5} style={{ margin: 0 }}>
                  {data.listenerName}
                </Title>
                <Text type="secondary">{data.courseName}</Text>
              </div>
              <Flex align="center" gap={24} wrap>
                <div style={{ textAlign: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                    {t('qualification.studentDetail.cardDone')}
                  </Text>
                  <Text strong style={{ fontSize: 15 }}>
                    {data.passedTopics}/{data.totalTopics}
                  </Text>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>
                    {t('qualification.studentDetail.cardOverall')}
                  </Text>
                  <ScoreBadge percent={data.percent} />
                </div>
                <ExcelExportButton onClick={onExport} />
              </Flex>
            </Flex>
          </Card>

          <div>
            <SectionHeader
              icon={<BookOutlined />}
              title={t('qualification.studentDetail.entranceResult')}
              accent="var(--color-info, #2f80ed)"
            />
            <Card styles={{ body: { padding: 0 } }}>
              <Table<StudentTestCard>
                columns={entranceColumns}
                dataSource={data.entranceTest ? [data.entranceTest] : []}
                rowKey={() => 'entrance'}
                pagination={false}
                size="middle"
                locale={{
                  emptyText: (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={t('qualification.studentDetail.notTaken')}
                    />
                  ),
                }}
              />
            </Card>
          </div>

          <div>
            <SectionHeader
              icon={<ProfileOutlined />}
              title={t('qualification.studentDetail.topicsTitle')}
              accent="var(--color-purple, #7c3aed)"
            />
            <Card styles={{ body: { padding: 0 } }}>
              <Table<StudentDetailTopic>
                columns={topicColumns}
                dataSource={data.topics}
                rowKey="topicId"
                pagination={false}
                size="middle"
                scroll={{ x: 'max-content' }}
                locale={{ emptyText: <Empty description={t('qualification.studentDetail.notFound')} /> }}
              />
            </Card>
          </div>
        </Flex>
      )}

      <Modal
        open={!!textModal}
        title={textModal?.title ?? ''}
        footer={null}
        onCancel={() => setTextModal(null)}
        width={560}
        centered
      >
        <ScrollBox $maxHeight="70vh">
          <Text style={{ whiteSpace: 'pre-wrap' }}>{textModal?.text}</Text>
        </ScrollBox>
      </Modal>

      <Modal
        open={!!zoomImg}
        title={t('qualification.studentDetail.attachedImage')}
        footer={null}
        onCancel={() => setZoomImg(null)}
        width={720}
        centered
      >
        <Flex justify="center">
          <img
            src={zoomImg ?? ''}
            alt=""
            style={{ maxWidth: '100%', maxHeight: '72vh', borderRadius: 10, objectFit: 'contain' }}
          />
        </Flex>
      </Modal>

      <div aria-hidden style={{ height: 'var(--space-8, 40px)', flexShrink: 0 }} />
    </PageContainer>
  );
}
