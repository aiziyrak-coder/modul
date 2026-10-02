import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DownloadOutlined, EyeOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Button, Flex, Tag, Tooltip, Typography } from 'antd';
import { PageContainer, DataTable, Filters, useModalStore } from '@/shared/ui';
import { TableGap } from '../table-gap';
import { FilterWidth } from './styles';
import { useTranslation } from '@/shared/lib/i18n';
import { useEntranceResultsPaginated, useExitResultsPaginated } from '../../api/test-result-api';
import { useCourseOptions } from '../../api/course-api';
import { EDU_FORM } from '../../model/course.types';
import type { EduForm } from '../../model/course.types';
import type { TestResultDetail } from '../../model/test-result.types';
import { downloadExcel } from '../../lib/excel';
import TestResultDetailModal from '../test-result-detail-modal';

const { Text } = Typography;
const LIMIT = 12;

export default function TestResultsView({ kind }: { kind: 'entrance' | 'exit' }) {
  const isExit = kind === 'exit';
  const ns = isExit ? 'qualification.exitTest' : 'qualification.entranceTest';
  const { t } = useTranslation();
  const showModal = useModalStore((s) => s.showModal);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);
  const [course, setCourse] = useState<string | undefined>(undefined);
  const [form, setForm] = useState<string | undefined>(undefined);

  const filter = {
    page,
    limit: pageSize,
    course: course || undefined,
    form: form ? Number(form) : undefined,
  };
  const entrance = useEntranceResultsPaginated(filter, !isExit);
  const exit = useExitResultsPaginated(filter, isExit);
  const { data, isFetching } = isExit ? exit : entrance;
  const { data: courseOptions = [] } = useCourseOptions();

  const total = data?.meta.total ?? 0;

  const openDetail = (row: TestResultDetail) =>
    showModal({
      title: t(`${ns}.detailTitle`),
      body: () => <TestResultDetailModal result={row} />,
      maxWidth: '780px',
    });

  const formText = (f?: EduForm) =>
    f === EDU_FORM.ONLINE
      ? t('qualification.courses.form.online')
      : f === EDU_FORM.OFFLINE
        ? t('qualification.courses.form.offline')
        : '—';

  const exportTable = () => {
    const items = data?.items ?? [];
    const rows = items.map((r, i) => {
      const row: Record<string, string | number> = {
        '#': i + 1,
        [t(`${ns}.col.name`)]: r.listenerName,
        [t(`${ns}.col.course`)]: r.courseTitle ?? '—',
        [t(`${ns}.col.form`)]: formText(r.form),
        [t(`${ns}.col.score`)]: `${r.score}%`,
      };
      if (isExit) {
        row[t(`${ns}.col.result`)] = r.passed
          ? t('qualification.exitTest.passed')
          : t('qualification.exitTest.failed');
        row[t('qualification.exitTest.col.document')] = r.passed
          ? t('qualification.exitTest.certificate')
          : t('qualification.exitTest.statement');
        row[t('qualification.exitTest.col.docStatus')] = docStatusText(r.document, t);
      } else {
        row[t(`${ns}.col.result`)] = `${r.correctCount}/${r.totalCount}`;
      }
      return row;
    });
    downloadExcel(rows, t(`${ns}.title`), 'Natijalar', [5, 28, 30, 12, 10, 14, 16]);
  };

  const formTag = (f?: EduForm) =>
    f === EDU_FORM.ONLINE ? (
      <Tag color="blue">{t('qualification.courses.form.online')}</Tag>
    ) : f === EDU_FORM.OFFLINE ? (
      <Tag color="gold">{t('qualification.courses.form.offline')}</Tag>
    ) : (
      <span style={{ color: 'var(--color-text-mute, #9aa3b2)' }}>—</span>
    );

  const columns: ColumnDef<TestResultDetail, unknown>[] = [
    {
      header: '#',
      id: 'idx',
      size: 56,
      cell: ({ row }) => (
        <span style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {(page - 1) * pageSize + row.index + 1}
        </span>
      ),
    },
    {
      header: t(`${ns}.col.name`),
      accessorKey: 'listenerName',
      cell: ({ row }) => <strong>{row.original.listenerName}</strong>,
    },
    {
      header: t(`${ns}.col.course`),
      id: 'course',
      cell: ({ row }) => row.original.courseTitle ?? '—',
    },
    {
      header: t(`${ns}.col.form`),
      id: 'form',
      size: 120,
      cell: ({ row }) => formTag(row.original.form),
    },
    {
      header: t(`${ns}.col.score`),
      id: 'score',
      size: 90,
      cell: ({ row }) => `${row.original.score}%`,
    },
    {
      header: t(`${ns}.col.result`),
      id: 'result',
      size: 130,
      cell: ({ row }) =>
        isExit ? (
          <Tag color={row.original.passed ? 'green' : 'red'}>
            {row.original.passed
              ? t('qualification.exitTest.passed')
              : t('qualification.exitTest.failed')}
          </Tag>
        ) : (
          `${row.original.correctCount}/${row.original.totalCount}`
        ),
    },
    ...(isExit
      ? [
          {
            header: t('qualification.exitTest.col.document'),
            id: 'document',
            size: 210,
            cell: ({ row }) => <DocumentCell row={row.original} t={t} />,
          } as ColumnDef<TestResultDetail, unknown>,
        ]
      : []),
    {
      header: t('actions'),
      id: 'actions',
      size: 90,
      meta: { align: 'center' as const },
      cell: ({ row }) => (
        <Tooltip title={t(`${ns}.view`)}>
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => openDetail(row.original)}
          />
        </Tooltip>
      ),
    },
  ];

  const formOptions = [
    { value: String(EDU_FORM.ONLINE), label: t('qualification.courses.form.online') },
    { value: String(EDU_FORM.OFFLINE), label: t('qualification.courses.form.offline') },
  ];

  return (
    <PageContainer title={t(`${ns}.title`)}>
      <FilterWidth>
      <Filters
        hideSearch
        onSearch={() => undefined}
        selects={[
          {
            key: 'course',
            placeholder: `${ns}.filterCourse`,
            value: course,
            options: courseOptions,
            onChange: (v) => {
              setCourse(v);
              setPage(1);
            },
          },
          {
            key: 'form',
            placeholder: `${ns}.filterForm`,
            value: form,
            options: formOptions,
            onChange: (v) => {
              setForm(v);
              setPage(1);
            },
          },
        ]}
        extra={
          <Flex align="center" gap={12}>
            <Text type="secondary">{t(`${ns}.count`, { count: total })}</Text>
            <Button
              icon={<DownloadOutlined />}
              onClick={exportTable}
              disabled={(data?.items?.length ?? 0) === 0}
            >
              {t('qualification.test.exportExcel')}
            </Button>
          </Flex>
        }
      />
      </FilterWidth>

      <TableGap>
        <DataTable<TestResultDetail>
          data={data?.items ?? []}
          columns={columns}
          loading={isFetching}
          page={page}
          pageSize={pageSize}
          total={data?.meta.total}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      </TableGap>
    </PageContainer>
  );
}

function docStatusText(
  doc: TestResultDetail['document'],
  t: (k: string) => string,
): string {
  if (!doc) return t('qualification.exitTest.docNone');
  if (doc.status === 3) return t('qualification.exitTest.docRejected');
  if (doc.status === 2) return t('qualification.exitTest.docApproved');
  return t('qualification.exitTest.docPending');
}

function DocumentCell({
  row,
  t,
}: {
  row: TestResultDetail;
  t: (k: string) => string;
}) {
  const doc = row.document;
  const kindLabel = (doc ? doc.kind === 1 : row.passed)
    ? t('qualification.exitTest.certificate')
    : t('qualification.exitTest.statement');

  if (!doc) {
    return (
      <Flex vertical gap={4}>
        <Text type="secondary">{kindLabel}</Text>
        <Tag>{t('qualification.exitTest.docNone')}</Tag>
      </Flex>
    );
  }

  return (
    <Flex vertical gap={4} align="flex-start">
      <Text type="secondary">{kindLabel}</Text>
      {doc.status === 2 ? (
        doc.fileUrl ? (
          <Button
            size="small"
            type="primary"
            icon={<DownloadOutlined />}
            href={doc.fileUrl}
            target="_blank"
          >
            {t('qualification.exitTest.docDownload')}
          </Button>
        ) : (
          <Tag color="success">{t('qualification.exitTest.docApproved')}</Tag>
        )
      ) : doc.status === 3 ? (
        <Flex align="center" gap={6}>
          <Tooltip
            color="var(--brand-error)"
            title={doc.rejectReason || t('qualification.exitTest.docNoReason')}
          >
            <InfoCircleOutlined style={{ color: 'var(--brand-error)', cursor: 'help' }} />
          </Tooltip>
          <Tag color="error">{t('qualification.exitTest.docRejected')}</Tag>
        </Flex>
      ) : (
        <Tag color="warning">{t('qualification.exitTest.docPending')}</Tag>
      )}
    </Flex>
  );
}
