import { useMemo } from 'react';
import {
  App,
  Button,
  Empty,
  Skeleton,
  Space,
  Table,
  Tooltip,
  Typography,
} from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type {
  SciencesData,
  ScienceBlock,
  ScienceItem,
} from '../../api/working-schedule-process-api';
import { useTranslation } from '@/shared/lib/i18n';
import type { TFunction } from 'i18next';

const { Text, Title } = Typography;

interface SubjectsTabProps {
  isLoading: boolean;
  isError: boolean;
  data: SciencesData | undefined;
}

interface TableRow {
  key: string;
  rowType: 'science' | 'blockTotal' | 'grandTotal';
  serialNumber?: string | null;
  code?: string | null;
  title?: string | null;
  totalCredit?: number | null;
}

function buildRows(
  t: TFunction,
  block: ScienceBlock,
  isLast: boolean,
  grandTotalCredit: number,
): TableRow[] {
  const rows: TableRow[] = block.sciences.map((sci: ScienceItem) => ({
    key: `sci-${sci.id}`,
    rowType: 'science',
    serialNumber: sci.serialNumber,
    code: sci.code,
    title: sci.title,
    totalCredit: sci.totalCredit,
  }));

  rows.push({
    key: `block-total-${block.id}`,
    rowType: 'blockTotal',
    title: t('studyLoad.workingSchedule.subjects.blockTotalLabel', {
      name: block.title ?? block.blockCode ?? '',
    }),
    totalCredit: block.jamiKreditlar,
  });

  if (isLast) {
    rows.push({
      key: 'grand-total',
      rowType: 'grandTotal',
      title: t('studyLoad.workingSchedule.subjects.grandTotalLabel'),
      totalCredit: grandTotalCredit,
    });
  }

  return rows;
}

const SubjectsTab = ({ isLoading, isError, data }: SubjectsTabProps) => {
  const { message } = App.useApp();
  const { t } = useTranslation();

  const columns: ColumnsType<TableRow> = useMemo(
    () => [
      {
        title: t('studyLoad.studyPlan.planTab.columnSerialNumber'),
        dataIndex: 'serialNumber',
        key: 'serialNumber',
        width: 43,
        render: (_: unknown, row: TableRow) =>
          row.rowType === 'science' ? (
            <Text style={{ fontSize: 13 }}>{row.serialNumber ?? ''}</Text>
          ) : null,
      },
      {
        title: t('studyLoad.studyPlan.planTab.columnCode'),
        dataIndex: 'code',
        key: 'code',
        width: 177,
        render: (_: unknown, row: TableRow) => {
          if (row.rowType !== 'science') return null;
          return (
            <Space size={4}>
              <Text style={{ fontSize: 13 }}>{row.code ?? '—'}</Text>
              {row.code ? (
                <Tooltip title={t('studyLoad.studyPlan.planTab.copyTooltip')}>
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined style={{ fontSize: 11 }} />}
                    style={{ color: 'var(--color-text-soft)', padding: '0 2px' }}
                    onClick={() => {
                      void navigator.clipboard.writeText(row.code ?? '');
                      void message.success(t('studyLoad.studyPlan.planTab.codeCopied'));
                    }}
                  />
                </Tooltip>
              ) : null}
            </Space>
          );
        },
      },
      {
        title: t('studyLoad.studyPlan.planTab.columnScienceName'),
        dataIndex: 'title',
        key: 'title',
        render: (_: unknown, row: TableRow) => {
          if (row.rowType === 'science') {
            return (
              <Text style={{ fontSize: 13, fontWeight: 500 }}>
                {row.title ?? '—'}
              </Text>
            );
          }
          return (
            <Text
              strong={row.rowType === 'grandTotal'}
              style={{
                fontSize: 13,
                color:
                  row.rowType === 'grandTotal'
                    ? 'var(--color-text)'
                    : 'var(--color-text-soft)',
                textAlign: 'right',
                display: 'block',
              }}
            >
              {row.title ?? ''}
            </Text>
          );
        },
      },
      {
        title: t('studyLoad.studyPlan.planTab.columnCredit'),
        dataIndex: 'totalCredit',
        key: 'totalCredit',
        width: 93,
        align: 'center' as const,
        render: (_: unknown, row: TableRow) =>
          row.totalCredit !== undefined && row.totalCredit !== null ? (
            <Text style={{ fontSize: 13 }}>{row.totalCredit}</Text>
          ) : null,
      },
    ],
    [message, t],
  );

  if (isLoading) {
    return <Skeleton active paragraph={{ rows: 8 }} />;
  }
  if (isError || !data) {
    return (
      <Empty
        description={t('studyLoad.workingSchedule.subjects.loadError')}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }
  if (data.blocks.length === 0) {
    return (
      <Empty
        description={t('studyLoad.workingSchedule.subjects.empty')}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {data.blocks.map((block: ScienceBlock, idx: number) => {
        const isLast = idx === data.blocks.length - 1;
        const rows = buildRows(t, block, isLast, data.grandTotalCredit);

        return (
          <div key={block.id}>
            {block.title ? (
              <Title
                level={5}
                style={{ margin: '0 0 var(--space-3) 0', color: 'var(--color-text)' }}
              >
                {block.title}
              </Title>
            ) : null}
            <Table<TableRow>
              dataSource={rows}
              columns={columns}
              rowKey="key"
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
              style={{
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                border: '1px solid var(--color-border)',
              }}
              rowClassName={(row) => {
                if (row.rowType === 'grandTotal') return 'subj-row-grand';
                if (row.rowType === 'blockTotal') return 'subj-row-block-total';
                return '';
              }}
            />
          </div>
        );
      })}

      <style>{`
        .subj-row-block-total td { background: var(--color-bg-layout, #F8FAFC) !important; }
        .subj-row-grand td { background: var(--color-bg-table-head, #EEF2F6) !important; font-weight: 600; }
      `}</style>
    </div>
  );
};

export default SubjectsTab;
