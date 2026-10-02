import { Button, Input, InputNumber, Table, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';
import type { ForeignRow } from '../../model/types';
import { foreignRowError } from '../../model/invariants';

const { Text } = Typography;

interface IProps {
  rows: ForeignRow[];
  editable?: boolean;
  onChange?: (rows: ForeignRow[]) => void;
}

type Line = { key: string; index: number; row: ForeignRow };

const ForeignTable = ({ rows, editable = false, onChange }: IProps) => {
  const { t } = useTranslation();
  const k = (s: string) => t(`studyLoad.contingentReport.col.${s}`);

  const lines: Line[] = rows.map((row, index) => ({ key: String(index), index, row }));
  const total = rows.reduce(
    (acc, r) => ({ total: acc.total + r.total, boys: acc.boys + r.boys, girls: acc.girls + r.girls }),
    { total: 0, boys: 0, girls: 0 },
  );

  const patch = (index: number, part: Partial<ForeignRow>) =>
    onChange?.(rows.map((r, i) => (i === index ? { ...r, ...part } : r)));

  const numCell = (line: Line, field: 'total' | 'boys' | 'girls') =>
    editable ? (
      <InputNumber
        size="small"
        min={0}
        precision={0}
        value={line.row[field]}
        style={{ width: 80 }}
        onChange={(v) => patch(line.index, { [field]: typeof v === 'number' ? v : 0 })}
        aria-label={`${line.row.country || t('studyLoad.contingentReport.col.country')} ${field}`}
      />
    ) : (
      line.row[field] || ''
    );

  const columns: ColumnsType<Line> = [
    {
      title: k('country'),
      key: 'country',
      render: (_: unknown, line) => {
        const err = foreignRowError(line.row);
        if (editable) {
          return (
            <Input
              size="small"
              value={line.row.country}
              status={err ? 'error' : undefined}
              placeholder={t('studyLoad.contingentReport.countryPlaceholder')}
              onChange={(e) => patch(line.index, { country: e.target.value })}
              aria-label={t('studyLoad.contingentReport.col.country')}
            />
          );
        }
        return err ? (
          <Tooltip title={t(err)}>
            <Text type="danger">{line.row.country} !</Text>
          </Tooltip>
        ) : (
          line.row.country
        );
      },
    },
    { title: k('total'), key: 'total', width: 120, align: 'center', render: (_: unknown, l) => numCell(l, 'total') },
    { title: k('boys'), key: 'boys', width: 120, align: 'center', render: (_: unknown, l) => numCell(l, 'boys') },
    { title: k('girls'), key: 'girls', width: 120, align: 'center', render: (_: unknown, l) => numCell(l, 'girls') },
  ];
  if (editable) {
    columns.push({
      title: '',
      key: 'actions',
      width: 44,
      align: 'center',
      render: (_: unknown, line) => (
        <Button
          type="text"
          size="small"
          danger
          icon={<DeleteOutlined />}
          aria-label={t('studyLoad.contingentReport.removeRow')}
          onClick={() => onChange?.(rows.filter((_, i) => i !== line.index))}
        />
      ),
    });
  }

  return (
    <div>
      <Table<Line>
        rowKey="key"
        size="small"
        bordered
        columns={columns}
        dataSource={lines}
        pagination={false}
        locale={{ emptyText: t('studyLoad.contingentReport.noForeign') }}
        summary={() =>
          rows.length ? (
            <Table.Summary.Row style={{ background: 'var(--color-bg-layout, #F5F7FB)' }}>
              <Table.Summary.Cell index={0}>
                <Text strong>{t('studyLoad.contingentReport.totalRow')}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="center">
                <Text strong>{total.total}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="center">
                <Text strong>{total.boys}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="center">
                <Text strong>{total.girls}</Text>
              </Table.Summary.Cell>
              {editable ? <Table.Summary.Cell index={4} /> : null}
            </Table.Summary.Row>
          ) : null
        }
      />
      {editable ? (
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          style={{ marginTop: 'var(--space-2)' }}
          onClick={() => onChange?.([...rows, { country: '', total: 0, boys: 0, girls: 0 }])}
        >
          {t('studyLoad.contingentReport.addCountry')}
        </Button>
      ) : null}
    </div>
  );
};

export default ForeignTable;
