import { useMemo, useState } from 'react';
import { CheckOutlined, DownloadOutlined, MinusOutlined } from '@ant-design/icons';
import { Progress } from 'antd';
import type { TableColumnsType } from 'antd';
import {
  Button,
  Empty,
  Flex,
  PageContainer,
  Select,
  Spin,
  Table,
  Typography,
} from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useCourseOptions } from '../../api/course-api';
import { useMasteryGrid, fetchMasteryGridAll, type MasteryRow } from '../../api/mastery-api';
import { EDU_FORM } from '../../model/course.types';
import { downloadExcel } from '../../lib/excel';
import QualPagination from '../qual-pagination';

const { Text } = Typography;
const LIMIT = 12;

const pctColor = (p: number) =>
  p >= 80 ? 'var(--brand-primary)' : p >= 60 ? 'var(--brand-warning)' : 'var(--brand-error)';

function Mark({ passed }: { passed: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        borderRadius: '50%',
        fontSize: 12,
        background: passed
          ? 'color-mix(in srgb, var(--brand-primary) 22%, #fff)'
          : 'var(--color-fill-quaternary, #f2f4f7)',
        color: passed ? 'var(--brand-primary, #37cb94)' : 'var(--color-text-mute, #9aa3b2)',
      }}
    >
      {passed ? <CheckOutlined /> : <MinusOutlined />}
    </span>
  );
}

export default function UzlashtirishView() {
  const { t } = useTranslation();
  const [course, setCourse] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);
  const [exporting, setExporting] = useState(false);

  const { data: courseOptions = [] } = useCourseOptions(EDU_FORM.ONLINE);
  const { data, isLoading, isFetching } = useMasteryGrid(course, page, pageSize);

  const topics = useMemo(() => data?.topics ?? [], [data]);
  const rows = data?.rows ?? [];
  const total = data?.meta.total ?? 0;

  const columns: TableColumnsType<MasteryRow> = useMemo(() => {
    const topicCols: TableColumnsType<MasteryRow> = topics.map((tp) => ({
      key: tp.id,
      align: 'center',
      title: (
        <div style={{ minWidth: 120, whiteSpace: 'nowrap', textAlign: 'center' }}>
          <div style={{ fontWeight: 600 }}>
            {tp.orderNumber}. {tp.title}
          </div>
          <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-soft, #697586)' }}>
            {t('qualification.mastery.duration', { h: tp.duration })}
          </div>
        </div>
      ),
      render: (_: unknown, r: MasteryRow) => <Mark passed={r.passedTopicIds.includes(tp.id)} />,
    }));

    return [
      {
        key: 'name',
        title: t('qualification.mastery.name'),
        dataIndex: 'listenerName',
        fixed: 'left',
        width: 220,
        render: (v: string) => <Text strong>{v}</Text>,
      },
      ...topicCols,
      {
        key: 'percent',
        title: t('qualification.mastery.percent'),
        fixed: 'right',
        width: 170,
        render: (_: unknown, r: MasteryRow) => (
          <Progress
            percent={r.percent}
            size="small"
            strokeColor={pctColor(r.percent)}
            format={(p) => `${p ?? 0}%`}
          />
        ),
      },
    ];
  }, [topics, t]);

  const exportGrid = async () => {
    if (!course) return;
    setExporting(true);
    try {
      const all = await fetchMasteryGridAll(course);
      const courseTitle = courseOptions.find((o) => o.value === course)?.label ?? '';
      const xrows = all.rows.map((r, i) => {
        const row: Record<string, string | number> = {
          '#': i + 1,
          [t('qualification.mastery.name')]: r.listenerName,
        };
        all.topics.forEach((tp) => {
          row[`${tp.orderNumber}. ${tp.title}`] = r.passedTopicIds.includes(tp.id) ? '✓' : '—';
        });
        row[t('qualification.mastery.percent')] = `${r.percent}%`;
        return row;
      });
      downloadExcel(
        xrows,
        `ozlashtirish_${courseTitle}`.replace(/\s+/g, '_').slice(0, 50),
        "O'zlashtirish",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <PageContainer title={t('qualification.mastery.title')}>
      <Flex align="center" justify="space-between" gap={12} wrap style={{ marginBottom: 'var(--space-4)' }}>
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder={t('qualification.mastery.selectCourse')}
          value={course}
          options={courseOptions}
          onChange={(v) => {
            setCourse(v);
            setPage(1);
          }}
          style={{ width: 320, height: 38 }}
        />
        <Button
          icon={<DownloadOutlined />}
          onClick={exportGrid}
          loading={exporting}
          disabled={!course || rows.length === 0}
        >
          {t('qualification.test.exportExcel')}
        </Button>
      </Flex>

      {!course ? (
        <Flex align="center" justify="center" style={{ flex: 1, minHeight: 240 }}>
          <Empty description={t('qualification.mastery.noCourse')} />
        </Flex>
      ) : isLoading ? (
        <Flex align="center" justify="center" style={{ flex: 1, minHeight: 240 }}>
          <Spin size="large" />
        </Flex>
      ) : rows.length === 0 ? (
        <Flex align="center" justify="center" style={{ flex: 1, minHeight: 240 }}>
          <Empty description={t('qualification.mastery.noData')} />
        </Flex>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
          <Table<MasteryRow>
            rowKey="listenerId"
            columns={columns}
            dataSource={rows}
            pagination={false}
            scroll={{ x: 'max-content' }}
          />
          <div
            style={{
              marginTop: 'auto',
              flexShrink: 0,
              background: 'var(--color-bg, #fff)',
              borderTop: '1px solid var(--color-border, #e3e8ef)',
              boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.04)',
              padding: 'var(--space-4, 16px) var(--space-5, 20px)',
              marginLeft: 'calc(-1 * var(--content-body-padding, 24px))',
              marginRight: 'calc(-1 * var(--content-body-padding, 24px))',
              marginBottom: 'calc(-1 * var(--content-body-padding, 24px))',
            }}
          >
            <QualPagination
              current={page}
              pageSize={pageSize}
              total={total}
              onChange={setPage}
              onPageSizeChange={(s) => {
                setPageSize(s);
                setPage(1);
              }}
            />
          </div>
          {isFetching ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'color-mix(in srgb, var(--color-bg, #fff) 60%, transparent)',
              }}
            >
              <Spin size="large" />
            </div>
          ) : null}
        </div>
      )}
    </PageContainer>
  );
}
