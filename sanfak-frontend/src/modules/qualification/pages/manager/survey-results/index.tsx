import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import dayjs from 'dayjs';
import { EyeOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Select, Tag, Tooltip, Typography } from 'antd';
import { PageContainer, DataTable, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { TableGap } from '../../../components/table-gap';
import { ScrollBox } from '../../../components/scroll-box';
import { useCourseOptions } from '../../../api/course-api';
import { useSurveySubmissions } from '../../../api/survey-api';
import { SURVEY_TYPE } from '../../../model/survey.types';
import type { SurveySubmission } from '../../../model/survey.types';

const { Text } = Typography;
const LIMIT = 12;

const fmt = (s?: string | null) => (s ? dayjs(s).format('DD.MM.YYYY HH:mm') : '—');

export default function ManagerSurveyResultsPage() {
  const { t } = useTranslation();
  const showModal = useModalStore((s) => s.showModal);

  const [course, setCourse] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);

  const { data, isFetching } = useSurveySubmissions(page, pageSize, course);
  const { data: courseOptions = [] } = useCourseOptions();

  const rows = data?.items ?? [];
  const total = data?.meta.total ?? 0;

  const openAnswers = (row: SurveySubmission) =>
    showModal({
      title: row.listenerName || t('qualification.survey.listener'),
      body: () => <AnswerList row={row} t={t} />,
      maxWidth: '680px',
    });

  const columns: ColumnDef<SurveySubmission, unknown>[] = [
    {
      header: t('qualification.survey.listener'),
      accessorKey: 'listenerName',
      cell: ({ row }) => <Text strong>{row.original.listenerName || '—'}</Text>,
    },
    {
      header: t('qualification.survey.course'),
      accessorKey: 'courseName',
      cell: ({ row }) => <Text>{row.original.courseName || '—'}</Text>,
    },
    {
      header: t('qualification.survey.answersCol'),
      size: 120,
      cell: ({ row }) => <Tag>{row.original.answers.length}</Tag>,
    },
    {
      header: t('qualification.survey.submittedAt'),
      size: 170,
      cell: ({ row }) => <Text>{fmt(row.original.submittedAt)}</Text>,
    },
    {
      header: t('actions'),
      id: 'actions',
      size: 90,
      meta: { align: 'center' as const },
      cell: ({ row }) => (
        <Flex justify="center">
          <Tooltip title={t('qualification.survey.viewAnswers')}>
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              aria-label={t('qualification.survey.viewAnswers')}
              onClick={() => openAnswers(row.original)}
            />
          </Tooltip>
        </Flex>
      ),
    },
  ];

  return (
    <PageContainer title={t('qualification.survey.resultsNav')}>
      <Card size="small" style={{ marginBottom: 'var(--space-4)' }}>
        <Flex align="center" gap={12} wrap>
          <Text strong>{t('qualification.survey.course')}</Text>
          <Select
            showSearch
            allowClear
            value={course}
            onChange={(v) => {
              setCourse(v);
              setPage(1);
            }}
            options={courseOptions}
            optionFilterProp="label"
            placeholder={t('qualification.survey.filterCourse')}
            style={{ minWidth: 380, height: 38 }}
          />
          <div style={{ flex: 1 }} />
          <Text type="secondary">{t('qualification.survey.respondents', { n: total })}</Text>
        </Flex>
      </Card>

      <TableGap>
        <DataTable<SurveySubmission>
          data={rows}
          columns={columns}
          loading={isFetching}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          onRowClick={openAnswers}
        />
      </TableGap>
    </PageContainer>
  );
}

function AnswerList({
  row,
  t,
}: {
  row: SurveySubmission;
  t: (k: string, o?: Record<string, unknown>) => string;
}) {
  const meta = useMemo(
    () => [row.courseName, fmt(row.submittedAt)].filter(Boolean).join(' · '),
    [row],
  );

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <Text type="secondary">{meta}</Text>
      </div>

      <ScrollBox $maxHeight="62vh">
        <Flex vertical gap={14} style={{ paddingRight: 4 }}>
          {row.answers.map((a, i) => (
            <div
              key={i}
              style={{
                paddingBottom: 12,
                borderBottom:
                  i === row.answers.length - 1 ? 'none' : '1px solid var(--color-border-soft)',
              }}
            >
              <div style={{ marginBottom: 6 }}>
                <Text strong>
                  {i + 1}. {a.question}
                </Text>
              </div>
              {a.type === SURVEY_TYPE.CHOICE ? (
                <Tag color="blue">{a.optionText || '—'}</Tag>
              ) : a.type === SURVEY_TYPE.RATING ? (
                <Text strong style={{ fontSize: 16 }}>
                  {a.rating ?? '—'} <Text type="secondary">/ 5</Text>
                </Text>
              ) : (
                <Text>{a.text || '—'}</Text>
              )}
            </div>
          ))}
          {row.answers.length === 0 ? (
            <Text type="secondary">{t('qualification.survey.noAnswers')}</Text>
          ) : null}
        </Flex>
      </ScrollBox>
    </div>
  );
}
