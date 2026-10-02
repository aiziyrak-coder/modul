import { Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from '@/shared/lib/i18n';
import type { SummaryRow, SummaryTotals } from '../../model/types';

const { Text } = Typography;

interface IProps {
  rows: SummaryRow[];
  totals: SummaryTotals | null;
  loading?: boolean;
}

const numOrBlank = (n: number) => (n ? n : '');

const SummaryTable = ({ rows, totals, loading }: IProps) => {
  const { t } = useTranslation();
  const k = (s: string) => t(`studyLoad.summary.col.${s}`);

  const num = (title: string, get: (r: SummaryRow) => number, width = 64) => ({
    title,
    width,
    align: 'center' as const,
    render: (_: unknown, r: SummaryRow) => numOrBlank(get(r)),
  });

  const columns: ColumnsType<SummaryRow> = [
    { title: '№', dataIndex: 'no', width: 44, align: 'center', fixed: 'left' },
    { title: k('department'), dataIndex: 'department', width: 260, fixed: 'left' },
    { title: k('head'), dataIndex: 'head', width: 140 },
    num(k('total'), (r) => r.total, 80),
    {
      title: k('including'),
      children: [num(k('hourly'), (r) => r.hourly, 76), num(k('forDistribution'), (r) => r.forDistribution, 84)],
    },
    num(k('positions'), (r) => r.positions, 90),
    {
      title: k('including'),
      children: [
        {
          title: k('departmentHead'),
          children: [
            num(k('professor'), (r) => r.dh.professor),
            num(k('docent'), (r) => r.dh.docent),
            num(k('seniorTeacher'), (r) => r.dh.seniorTeacher),
          ],
        },
        {
          title: k('teachingStaff'),
          children: [
            num(k('professor'), (r) => r.ts.professor),
            num(k('docent'), (r) => r.ts.docent),
            num(k('seniorTeacher'), (r) => r.ts.seniorTeacher),
            num(k('assistant'), (r) => r.ts.assistant, 90),
          ],
        },
      ],
    },
    {
      title: k('support'),
      children: [
        num(k('supportTotal'), (r) => r.supportTotal),
        num(k('cabinetHead'), (r) => r.support.cabinetHead, 80),
        num(k('labHead'), () => 0, 80),
        num(k('laborant'), (r) => r.support.laborant),
        num(k('labWorker'), () => 0, 80),
        num(k('engineer'), () => 0, 80),
      ],
    },
  ];

  const totalCells = totals
    ? [
        totals.total,
        totals.hourly,
        totals.forDistribution,
        totals.positions,
        totals.dh.professor,
        totals.dh.docent,
        totals.dh.seniorTeacher,
        totals.ts.professor,
        totals.ts.docent,
        totals.ts.seniorTeacher,
        totals.ts.assistant,
        totals.supportTotal,
        totals.support.cabinetHead,
        0,
        totals.support.laborant,
        0,
        0,
      ]
    : null;

  return (
    <Table<SummaryRow>
      rowKey="no"
      size="small"
      bordered
      loading={loading}
      columns={columns}
      dataSource={rows}
      pagination={false}
      scroll={{ x: 1700 }}
      summary={() =>
        totalCells ? (
          <Table.Summary fixed>
            <Table.Summary.Row style={{ background: 'var(--color-bg-layout, #F5F7FB)' }}>
              <Table.Summary.Cell index={0} colSpan={3}>
                <Text strong>{t('studyLoad.summary.totalRow')}</Text>
              </Table.Summary.Cell>
              {totalCells.map((v, i) => (
                <Table.Summary.Cell key={i} index={i + 3} align="center">
                  <Text strong>{v}</Text>
                </Table.Summary.Cell>
              ))}
            </Table.Summary.Row>
          </Table.Summary>
        ) : null
      }
    />
  );
};

export default SummaryTable;
