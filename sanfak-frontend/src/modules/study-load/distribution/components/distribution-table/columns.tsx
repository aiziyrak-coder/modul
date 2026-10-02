import type { ReactNode } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button, InputNumber, Space, Tag, Tooltip, Typography } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { Can } from '@/app/session';
import type { WithSubRows } from '@/shared/ui';
import { formatJustificationTooltip } from '../../lib/suitability';
import { classTypeSlugsLabel } from '../../../lib/class-type-slugs';
import type { DistRow } from './rows';

const { Text } = Typography;

const GROUP_COLORS = {
  semester: { color: '#EF6820', background: '#FEF6EE' },
  lecture: { color: '#34C18C', background: '#EBF9F3' },
  clinical: { color: '#F04438', background: '#FEF3F2' },
  lab: { color: '#11B6B6', background: '#EFFFFF' },
  practical: { color: '#2E90FA', background: '#EFF8FF' },
} as const;

const centered = { textAlign: 'center' as const };

function roHeader(t: ColumnActions['t'], text: string) {
  return () => (
    <Tooltip title={t('studyLoad.distribution.table.readOnlyHint')}>
      <span style={{ borderBottom: '1px dotted currentColor', cursor: 'help' }}>{text}</span>
    </Tooltip>
  );
}

type Row = WithSubRows<DistRow>;
type Col = ColumnDef<Row, unknown>;

function numCell(key: keyof DistRow): Col['cell'] {
  return ({ row }) => {
    const val = row.original[key] as number | string;
    if (row.original.kind === 'teacher') return null;
    return val !== '' && val !== 0 ? (
      <Text style={{ fontSize: 12 }}>{val}</Text>
    ) : (
      <Text style={{ fontSize: 12, color: 'var(--color-text-muted, #999)' }}>—</Text>
    );
  };
}

function num(t: ColumnActions['t'], id: keyof DistRow, header: string, minWidth = 72): Col {
  return {
    id: id as string,
    header: roHeader(t, header),
    meta: { rowSpan: 2, headerStyle: { ...centered, minWidth }, bodyStyle: centered },
    cell: numCell(id),
  };
}

function subNum(t: ColumnActions['t'], id: keyof DistRow, header: string): Col {
  return {
    id: id as string,
    header: roHeader(t, header),
    meta: { headerStyle: centered, bodyStyle: centered },
    cell: numCell(id),
  };
}

function lessonGroup(
  t: ColumnActions['t'],
  id: string,
  header: string,
  tone: keyof typeof GROUP_COLORS,
  streamKey: keyof DistRow,
  totalKey: keyof DistRow,
): Col {
  return {
    id,
    header,
    meta: {
      headerStyle: { ...centered, ...GROUP_COLORS[tone], fontWeight: 600 },
    },
    columns: [
      subNum(t, streamKey, t('studyLoad.distribution.table.perStream')),
      subNum(t, totalKey, t('studyLoad.distribution.table.total')),
    ],
  } as Col;
}

export interface ColumnActions {
  t: (key: string, options?: Record<string, unknown>) => string;
  onRemoveBlock?: (teacherEntryId: string, blockId: string, scienceName: string | null) => void;
  onSaveHours?: (teacherEntryId: string, blockId: string, totalHour: number) => Promise<unknown>;
  canAct: boolean;
  editLockReason?: string;
  renderElectiveAction?: (row: DistRow) => ReactNode;
  editingBlockId: string | null;
  draftHour: number | null;
  savingHour: boolean;
  startEdit: (blockId: string, current: number | string) => void;
  cancelEdit: () => void;
  commitEdit: (row: DistRow) => void;
  setDraftHour: (v: number) => void;
}

export function buildColumns(a: ColumnActions): Col[] {
  const showActions = a.canAct && Boolean(a.onRemoveBlock || a.onSaveHours);
  const { t } = a;

  return [
    {
      id: 'scienceName',
      header: t('studyLoad.distribution.table.scienceName'),
      meta: { rowSpan: 2, headerStyle: { minWidth: 220 } },
      cell: ({ row }) => {
        if (row.original.kind === 'teacher') return null;
        const isSummary = row.original.kind === 'summary';
        const showSuitabilityIcon =
          row.original.kind === 'block' && row.original.blockSuitability === 'crossDepartment';
        const declared = Boolean(row.original.blockJustification?.basis);
        return (
          <Space size={4}>
            <Text
              strong={isSummary}
              style={{ fontSize: 12, color: isSummary ? '#121926' : undefined }}
            >
              {row.original.scienceName ?? '—'}
            </Text>
            {row.original.classTypeSlugs && row.original.classTypeSlugs.length > 0 ? (
              <Tag color="blue" style={{ marginInlineEnd: 0 }}>
                {classTypeSlugsLabel(a.t, row.original.classTypeSlugs)}
              </Tag>
            ) : null}
            {showSuitabilityIcon ? (
              <Tooltip title={formatJustificationTooltip(a.t, row.original.blockJustification)}>
                <InfoCircleOutlined
                  style={{
                    fontSize: 12,
                    color: declared ? '#1677ff' : 'var(--color-text-muted, #999)',
                    opacity: declared ? 1 : 0.55,
                  }}
                />
              </Tooltip>
            ) : null}
          </Space>
        );
      },
    },
    num(t, 'course', t('studyLoad.distribution.column.course'), 56),
    num(t, 'studentCount', t('studyLoad.distribution.table.studentCount'), 80),
    num(t, 'groupCount', t('studyLoad.distribution.table.groupCount')),
    num(t, 'streamCount', t('studyLoad.distribution.table.streamCount')),
    num(t, 'semester', t('studyLoad.distribution.table.semester'), 68),

    {
      id: 'semesterGroup',
      header: t('studyLoad.distribution.table.semesterGroup'),
      meta: { headerStyle: { ...centered, ...GROUP_COLORS.semester, fontWeight: 600 } },
      columns: [
        subNum(t, 'semTotalHour', t('studyLoad.distribution.table.totalHourSub')),
        subNum(t, 'auditoriumHour', t('studyLoad.distribution.table.auditoriumHour')),
      ],
    } as Col,

    lessonGroup(t, 'lectureGroup', t('studyLoad.distribution.table.lecture'), 'lecture', 'lectStream', 'lectTotal'),
    lessonGroup(t, 'clinicalGroup', t('studyLoad.distribution.table.clinical'), 'clinical', 'clinStream', 'clinTotal'),
    lessonGroup(t, 'labGroup', t('studyLoad.distribution.table.lab'), 'lab', 'labStream', 'labTotal'),
    lessonGroup(t, 'practicalGroup', t('studyLoad.distribution.table.practical'), 'practical', 'pratStream', 'pratTotal'),

    num(t, 'oraliq', t('studyLoad.distribution.table.oraliq'), 84),
    num(t, 'yakuniy', t('studyLoad.distribution.table.yakuniy'), 84),
    num(t, 'qoldirilgan', t('studyLoad.distribution.table.qoldirilgan'), 150),
    num(t, 'malakaviy', t('studyLoad.distribution.table.malakaviy'), 96),

    {
      id: 'totalHour',
      header: t('studyLoad.distribution.column.totalHour'),
      meta: { rowSpan: 2, headerStyle: centered, bodyStyle: centered },
      cell: ({ row }) => {
        const r = row.original;
        if (r.kind === 'teacher') return null;
        if (r.kind === 'block' && r.blockId && a.editingBlockId === r.blockId) {
          return (
            <InputNumber
              size="small"
              min={0}
              autoFocus
              value={a.draftHour ?? 0}
              onChange={(v) => a.setDraftHour(typeof v === 'number' ? v : 0)}
              onPressEnter={() => a.commitEdit(r)}
              style={{ width: 84 }}
            />
          );
        }
        return r.totalHour !== '' && r.totalHour !== 0 ? (
          <Text strong style={{ fontSize: 12 }}>
            {r.totalHour}
          </Text>
        ) : (
          <Text style={{ fontSize: 12, color: 'var(--color-text-muted, #999)' }}>—</Text>
        );
      },
    },

    ...(showActions
      ? ([
          {
            id: 'actions',
            header: t('studyLoad.distribution.column.actions'),
            meta: { rowSpan: 2, headerStyle: centered, bodyStyle: centered },
            cell: ({ row }) => {
              const r = row.original;
              if (r.kind !== 'block' || !r.blockId || !r.teacherEntryId) return null;
              const isEditing = a.editingBlockId === r.blockId;

              return (
                <Space size={0}>
                  {a.onSaveHours ? (
                    <Can perform="workloadDistribution:update">
                      {isEditing ? (
                        <>
                          <Button
                            size="small"
                            type="text"
                            icon={<CheckOutlined />}
                            loading={a.savingHour}
                            title={t('studyLoad.common.save')}
                            onClick={() => a.commitEdit(r)}
                          />
                          <Button
                            size="small"
                            type="text"
                            icon={<CloseOutlined />}
                            disabled={a.savingHour}
                            title={t('studyLoad.common.cancel')}
                            onClick={a.cancelEdit}
                          />
                        </>
                      ) : (
                        <Tooltip title={a.editLockReason}>
                          <span>
                            <Button
                              size="small"
                              type="text"
                              icon={<EditOutlined />}
                              title={
                                a.editLockReason
                                  ? undefined
                                  : t('studyLoad.distribution.table.editHoursTooltip')
                              }
                              disabled={Boolean(a.editingBlockId) || Boolean(a.editLockReason)}
                              onClick={() => a.startEdit(r.blockId!, r.totalHour)}
                            />
                          </span>
                        </Tooltip>
                      )}
                    </Can>
                  ) : null}

                  {a.renderElectiveAction && !isEditing
                    ? a.renderElectiveAction(r)
                    : null}

                  {a.onRemoveBlock && !isEditing ? (
                    <Can perform="workloadDistribution:delete">
                      <Tooltip
                        title={a.editLockReason ?? t('studyLoad.distribution.table.deleteBlockTooltip')}
                      >
                        <span>
                          <Button
                            size="small"
                            danger
                            type="text"
                            icon={<DeleteOutlined />}
                            disabled={Boolean(a.editLockReason)}
                            onClick={() =>
                              a.onRemoveBlock!(r.teacherEntryId!, r.blockId!, r.blockScienceName)
                            }
                          />
                        </span>
                      </Tooltip>
                    </Can>
                  ) : null}
                </Space>
              );
            },
          },
        ] as Col[])
      : []),
  ];
}
