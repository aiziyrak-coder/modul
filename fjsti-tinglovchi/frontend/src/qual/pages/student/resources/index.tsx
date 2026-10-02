import { useEffect, useState } from 'react';
import { DownloadOutlined, ExportOutlined, RightOutlined } from '@ant-design/icons';
import { Empty, Spin, Typography } from 'antd';
import { PageContainer, Card, Flex } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useMyCourses } from '../../../api/my-course-api';
import { useSourcesByCourse } from '../../../api/source-api';
import { usePaymentLock } from '../../../api/learning-api';
import { PaymentLocked } from '../../../components/payment-locked';
import type { MyCourse } from '../../../model/my-course.types';
import type { Source } from '../../../model/source.types';

const { Text } = Typography;

const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';

const GREEN_SOFT = 'var(--brand-primary-soft)';
const GREEN_BOX = 'color-mix(in srgb, var(--brand-primary) 15%, #fff)';
const GREEN_BORDER = 'color-mix(in srgb, var(--brand-primary) 32%, #fff)';
const BLUE_BOX = 'color-mix(in srgb, var(--brand-info) 12%, #fff)';
const BLUE_BORDER = 'color-mix(in srgb, var(--brand-info) 32%, #fff)';

function GraduationCapIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
      <path d="M22 10v6" />
      <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
    </svg>
  );
}

function BookOpenIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

export default function StudentResourcesPage() {
  const { t } = useTranslation();
  const { data: courses = [], isLoading } = useMyCourses();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (courses.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !courses.some((c) => c.id === selectedId)) {
      setSelectedId(courses[0]!.id);
    }
  }, [courses, selectedId]);

  const selected = courses.find((c) => c.id === selectedId) ?? null;

  return (
    <PageContainer title={t('qualification.studentResources.nav')}>
      <style>{`
        .ql-course-item:hover:not(.is-active){background:var(--color-bg-elevate);}
        .ql-res-row:hover{background:var(--color-bg-elevate);}
      `}</style>
      <Flex gap={16} align="flex-start">
        <CoursesPane
          courses={courses}
          loading={isLoading}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <ResourcesPane course={selected} hasCourses={courses.length > 0} />
      </Flex>
      <div aria-hidden style={{ height: 'var(--space-8, 40px)', flexShrink: 0 }} />
    </PageContainer>
  );
}

function CoursesPane({
  courses,
  loading,
  selectedId,
  onSelect,
}: {
  courses: MyCourse[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <Card
      size="small"
      title={t('qualification.studentResources.myCourses')}
      style={{ width: 264, flexShrink: 0, overflow: 'hidden' }}
      styles={{
        header: { minHeight: 46, padding: '0 16px', fontSize: 14, fontWeight: 600 },
        body: { padding: 0 },
      }}
    >
      {loading ? (
        <Flex align="center" justify="center" style={{ minHeight: 160 }}>
          <Spin />
        </Flex>
      ) : courses.length === 0 ? (
        <Flex vertical align="center" justify="center" gap={8} style={{ minHeight: 160, padding: '24px 16px' }}>
          <span style={{ color: 'var(--color-text-mute)' }}>
            <GraduationCapIcon size={30} />
          </span>
          <Text style={{ fontSize: 13, fontWeight: 500, textAlign: 'center' }}>
            {t('qualification.studentResources.coursesEmpty')}
          </Text>
          <Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>
            {t('qualification.studentResources.coursesEmptyHint')}
          </Text>
        </Flex>
      ) : (
        <div>
          {courses.map((c, idx) => {
            const active = c.id === selectedId;
            const last = idx === courses.length - 1;
            return (
              <button
                key={c.id}
                type="button"
                className={`ql-course-item${active ? ' is-active' : ''}`}
                onClick={() => onSelect(c.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  textAlign: 'left',
                  cursor: 'pointer',
                  padding: '12px 16px',
                  background: active ? GREEN_SOFT : 'transparent',
                  border: 'none',
                  borderLeft: `2px solid ${active ? 'var(--brand-primary)' : 'transparent'}`,
                  borderBottom: last ? 'none' : '1px solid var(--color-border-soft)',
                  transition: 'background .15s',
                }}
              >
                <span
                  style={{
                    width: 32,
                    height: 32,
                    flexShrink: 0,
                    borderRadius: 'var(--radius-md)',
                    background: active ? GREEN_BOX : 'var(--color-bg-elevate)',
                    color: active ? 'var(--brand-primary)' : 'var(--color-text-mute)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <GraduationCapIcon size={16} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      fontSize: 13,
                      fontWeight: 500,
                      lineHeight: 1.35,
                      color: active ? 'var(--brand-primary)' : 'var(--color-text)',
                    }}
                  >
                    {c.title}
                  </span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--color-text-mute)', marginTop: 2 }}>
                    {t('qualification.studentResources.creditHours', { h: c.creditHours })}
                  </span>
                </span>
                {active ? <RightOutlined style={{ fontSize: 12, color: 'var(--brand-primary)' }} /> : null}
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function ResourcesPane({ course, hasCourses }: { course: MyCourse | null; hasCourses: boolean }) {
  const { t } = useTranslation();
  const { data: sources = [], isLoading } = useSourcesByCourse(course?.id);
  const { lock } = usePaymentLock(course?.id);

  const title = (
    <Flex align="center" gap={10} style={{ minWidth: 0 }}>
      <Text ellipsis={{ tooltip: course?.title }} style={{ fontSize: 14, fontWeight: 600 }}>
        {course ? course.title : t('qualification.studentResources.nav')}
      </Text>
      {course && sources.length > 0 ? (
        <Text type="secondary" style={{ fontSize: 12, fontWeight: 400, whiteSpace: 'nowrap' }}>
          {t('qualification.studentResources.sourcesCount', { count: sources.length })}
        </Text>
      ) : null}
    </Flex>
  );

  if (course && lock && lock.locked) return <PaymentLocked lock={lock} />;

  return (
    <Card
      size="small"
      title={title}
      style={{ flex: 1, minWidth: 0 }}
      styles={{
        header: { minHeight: 46, padding: '0 16px' },
        body: { padding: 0 },
      }}
    >
      {!course ? (
        <Empty
          description={
            hasCourses
              ? t('qualification.studentResources.noCourseSelected')
              : t('qualification.studentResources.coursesEmpty')
          }
          style={{ padding: '48px 16px' }}
        />
      ) : isLoading ? (
        <Flex align="center" justify="center" style={{ minHeight: 200 }}>
          <Spin />
        </Flex>
      ) : sources.length === 0 ? (
        <Empty
          description={t('qualification.studentResources.sourcesEmpty')}
          style={{ padding: '48px 16px' }}
        />
      ) : (
        <div>
          {sources.map((s, idx) => (
            <ResourceRow key={s.id} source={s} index={idx + 1} last={idx === sources.length - 1} />
          ))}
        </div>
      )}
    </Card>
  );
}

function ResourceRow({ source, index, last }: { source: Source; index: number; last: boolean }) {
  const { t } = useTranslation();
  return (
    <div
      className="ql-res-row"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16,
        padding: '16px',
        borderBottom: last ? 'none' : '1px solid var(--color-border-soft)',
        transition: 'background .15s',
      }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          flexShrink: 0,
          marginTop: 2,
          borderRadius: 'var(--radius-md)',
          background: GREEN_BOX,
          color: 'var(--brand-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <BookOpenIcon size={16} />
      </span>

      <Flex align="flex-start" justify="space-between" gap={12} style={{ flex: 1, minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <Text style={{ fontSize: 14, fontWeight: 500 }} ellipsis={{ tooltip: source.title }}>
            {index}. {source.title}
          </Text>
          <div style={{ fontSize: 12, color: 'var(--color-text-mute)', marginTop: 2 }}>
            {fmtDate(source.createdAt)}
          </div>
        </div>

        <Flex align="center" gap={8} style={{ flexShrink: 0 }}>
          {source.link ? (
            <a
              href={source.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 'var(--radius-md)',
                color: 'var(--brand-info)',
                background: BLUE_BOX,
                border: `1px solid ${BLUE_BORDER}`,
              }}
            >
              <ExportOutlined />
              {t('qualification.studentResources.link')}
            </a>
          ) : null}
          {source.fileUrl && source.fileUrl !== '#' ? (
            <a
              href={source.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={source.fileName}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 'var(--radius-md)',
                color: 'var(--brand-primary)',
                background: 'var(--brand-primary-soft)',
                border: `1px solid ${GREEN_BORDER}`,
              }}
            >
              <DownloadOutlined />
              {t('qualification.studentResources.download')}
            </a>
          ) : null}
        </Flex>
      </Flex>
    </div>
  );
}
