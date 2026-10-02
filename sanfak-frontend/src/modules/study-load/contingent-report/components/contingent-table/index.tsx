import { useMemo } from 'react';
import { Button, InputNumber, Table, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';
import {
  PREFILL_FIELDS,
  type ContingentNumField,
  type ContingentNumbers,
  type ContingentRow,
} from '../../model/types';
import { groupRows, rowErrors, rowKey, sumNumbers } from '../../model/invariants';

const { Text } = Typography;

interface IProps {
  rows: ContingentRow[];
  editable?: boolean;
  onChange?: (rows: ContingentRow[]) => void;
  facultyTitle?: string;
  loading?: boolean;
}

type Line =
  | { kind: 'row'; key: string; row: ContingentRow; label: string; span: number }
  | { kind: 'total'; key: string; label: string; numbers: ContingentNumbers; tone: 'block' | 'faculty' };

const CATEGORY_LABEL_KEY: Record<ContingentRow['category'], string> = {
  milliy: 'studyLoad.contingentReport.category.milliy',
  mdh: 'studyLoad.contingentReport.category.mdh',
  xorijiy: 'studyLoad.contingentReport.category.xorijiy',
  xorijiy_gibrid: 'studyLoad.contingentReport.category.xorijiy_gibrid',
};

const TONE_BG: Record<'block' | 'faculty', string> = {
  block: 'var(--color-bg-layout, #F5F7FB)',
  faculty: 'var(--color-fill-secondary, #EEF2F7)',
};

const ContingentTable = ({ rows, editable = false, onChange, facultyTitle, loading }: IProps) => {
  const { t } = useTranslation();
  const k = (s: string) => t(`studyLoad.contingentReport.col.${s}`);

  const lines = useMemo<Line[]>(() => {
    const out: Line[] = [];
    for (const b of groupRows(rows)) {
      const cat = t(CATEGORY_LABEL_KEY[b.category]);
      const label = `${b.directionCode ? `${b.directionCode}-` : ''}${b.directionTitle} (${cat})`;
      b.rows.forEach((r, i) => {
        out.push({ kind: 'row', key: rowKey(r), row: r, label, span: i === 0 ? b.rows.length : 0 });
      });
      out.push({ kind: 'total', key: `${b.key}|total`, label: t('studyLoad.contingentReport.totalRow'), numbers: b.total, tone: 'block' });
    }
    if (rows.length) {
      out.push({
        kind: 'total',
        key: 'faculty-total',
        label: t('studyLoad.contingentReport.facultyTotalRow', { faculty: facultyTitle ?? '' }),
        numbers: sumNumbers(rows),
        tone: 'faculty',
      });
    }
    return out;
  }, [rows, facultyTitle, t]);

  const update = (target: ContingentRow, field: ContingentNumField, value: number) => {
    if (!onChange) return;
    const key = rowKey(target);
    onChange(rows.map((r) => (rowKey(r) === key ? { ...r, [field]: value } : r)));
  };

  const remove = (target: ContingentRow) => {
    if (!onChange) return;
    const key = rowKey(target);
    onChange(rows.filter((r) => rowKey(r) !== key));
  };

  const numCell = (line: Line, field: ContingentNumField) => {
    if (line.kind === 'total') return <Text strong>{line.numbers[field]}</Text>;
    const r = line.row;
    if (editable) {
      return (
        <InputNumber
          size="small"
          min={0}
          precision={0}
          value={r[field]}
          style={{ width: 64 }}
          onChange={(v) => update(r, field, typeof v === 'number' ? v : 0)}
          aria-label={`${r.directionTitle} ${r.course} ${field}`}
        />
      );
    }
    const isPrefill = (PREFILL_FIELDS as readonly string[]).includes(field);
    const fromGroups = isPrefill && r.source[field as (typeof PREFILL_FIELDS)[number]] === 'groups';
    return fromGroups ? (
      <Tooltip title={t('studyLoad.contingentReport.source.groups')}>
        <span style={{ borderBottom: '1px dotted var(--brand-primary)', cursor: 'help' }}>{r[field]}</span>
      </Tooltip>
    ) : (
      <span>{r[field]}</span>
    );
  };

  const numColumn = (field: ContingentNumField, title: string, width = 78) => ({
    title,
    key: field,
    width,
    align: 'center' as const,
    render: (_: unknown, line: Line) => numCell(line, field),
  });

  const columns: ColumnsType<Line> = [
    {
      title: k('direction'),
      key: 'direction',
      width: 260,
      fixed: 'left',
      onCell: (line) =>
        line.kind === 'row' ? { rowSpan: line.span } : { colSpan: 2, style: { background: TONE_BG[line.tone] } },
      render: (_: unknown, line) =>
        line.kind === 'row' ? <Text style={{ fontSize: 12 }}>{line.label}</Text> : <Text strong>{line.label}</Text>,
    },
    {
      title: k('course'),
      key: 'course',
      width: 64,
      align: 'center',
      fixed: 'left',
      onCell: (line) => (line.kind === 'total' ? { colSpan: 0 } : {}),
      render: (_: unknown, line) => {
        if (line.kind !== 'row') return null;
        const errors = rowErrors(line.row);
        if (!errors.length) return line.row.course;
        return (
          <Tooltip title={errors.map((e) => t(e)).join('; ')}>
            <Text type="danger" strong>
              {line.row.course} !
            </Text>
          </Tooltip>
        );
      },
    },
    numColumn('total', k('total')),
    numColumn('boys', k('boys')),
    numColumn('girls', k('girls')),
    numColumn('grant', k('grant')),
    numColumn('contract', k('contract')),
    {
      title: k('grant'),
      children: [numColumn('grantBoys', k('boys')), numColumn('grantGirls', k('girls'))],
    },
    {
      title: k('contract'),
      children: [numColumn('contractBoys', k('boys')), numColumn('contractGirls', k('girls'))],
    },
    numColumn('groupCount', k('groupCount')),
    numColumn('streamCount', k('streamCount')),
    numColumn('mobilityOut', k('mobilityOut'), 96),
    numColumn('mobilityIn', k('mobilityIn'), 96),
  ];

  if (editable) {
    columns.push({
      title: '',
      key: 'actions',
      width: 44,
      align: 'center',
      render: (_: unknown, line) =>
        line.kind === 'row' ? (
          <Tooltip title={t('studyLoad.contingentReport.removeRow')}>
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              aria-label={t('studyLoad.contingentReport.removeRow')}
              onClick={() => remove(line.row)}
            />
          </Tooltip>
        ) : null,
    });
  }

  return (
    <Table<Line>
      rowKey="key"
      size="small"
      bordered
      loading={loading}
      columns={columns}
      dataSource={lines}
      pagination={false}
      scroll={{ x: 1400 }}
      onRow={(line) => (line.kind === 'total' ? { style: { background: TONE_BG[line.tone] } } : {})}
      locale={{ emptyText: t('studyLoad.contingentReport.emptyRows') }}
    />
  );
};

export default ContingentTable;
