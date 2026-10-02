import { Fragment, useState } from 'react';
import { App, Button, InputNumber, Tooltip, Typography } from 'antd';
import { CheckOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons';
import { Can } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import type { WorkloadRow } from '../../model/detail-types';
import { useUpdateWorkloadBlock } from '../../api/workload-api';
import {
  INFO_COLS,
  STUDY_WORK_COLS,
  OTHER_WORK_COLS,
  buildUpdateBlockPayload,
  flattenWorkloadRow,
  groupRowsByDirection,
  groupRowsBySection,
  isEditableColKey,
  sumWorkloadRows,
  WORKLOAD_COLUMNS,
  WORKLOAD_TABLE_MIN_WIDTH,
  type EditableColKey,
} from './columns';
import { Table, TableScroll } from './style';

const { Text } = Typography;

interface IProps {
  workloadId: string;
  rows: WorkloadRow[];
  canEdit: boolean;
}

const ACTIONS_COL_WIDTH = 90;

const WorkloadTable = ({ workloadId, rows, canEdit }: IProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const updateBlock = useUpdateWorkloadBlock(workloadId);

  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Record<EditableColKey, number>>>({});

  const startEdit = (row: WorkloadRow) => {
    setEditingBlockId(row.blockId);
    setDraft({});
  };

  const cancelEdit = () => {
    setEditingBlockId(null);
    setDraft({});
  };

  const setValue = (key: EditableColKey, value: number) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const commitEdit = async (row: WorkloadRow) => {
    const payload = buildUpdateBlockPayload(row, draft);
    if (!payload) {
      cancelEdit();
      return;
    }
    try {
      await updateBlock.mutateAsync({ blockId: row.blockId, payload });
      message.success(t('studyLoad.workload.detail.blockUpdated'));
      cancelEdit();
    } catch (err) {
      message.error(getApiErrorMessage(err));
    }
  };

  const directionGroups = groupRowsByDirection(rows);
  const sectionGroupCount = directionGroups.reduce(
    (n, d) => n + groupRowsBySection(d.rows).length,
    0,
  );
  const grandTotal = sumWorkloadRows(rows);
  const minWidth = WORKLOAD_TABLE_MIN_WIDTH + (canEdit ? ACTIONS_COL_WIDTH : 0);
  const colCount = WORKLOAD_COLUMNS.length + (canEdit ? 1 : 0);

  const renderCell = (row: WorkloadRow, key: (typeof WORKLOAD_COLUMNS)[number]['key']) => {
    const flat = flattenWorkloadRow(row);
    const isEditingRow = editingBlockId === row.blockId;

    if (isEditableColKey(key) && isEditingRow) {
      const entryId = row[key].entryId;
      if (!entryId && key !== 'leadership') {
        return (
          <Tooltip title={t('studyLoad.workload.detail.noEntryTooltip')}>
            <Text type="secondary">{flat[key]}</Text>
          </Tooltip>
        );
      }
      const current = draft[key] ?? (flat[key] as number);
      return (
        <InputNumber
          size="small"
          min={0}
          value={current}
          onChange={(v) => setValue(key, typeof v === 'number' ? v : 0)}
          onPressEnter={() => void commitEdit(row)}
          style={{ width: '100%' }}
        />
      );
    }

    const value = flat[key];
    return value === 0 || value === '0' ? (
      <Text type="secondary">—</Text>
    ) : (
      <span>{value}</span>
    );
  };

  if (rows.length === 0) {
    return (
      <TableScroll>
        <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-soft)' }}>
          {t('studyLoad.workload.detail.noRows')}
        </div>
      </TableScroll>
    );
  }

  return (
    <TableScroll>
      <Table $minWidth={minWidth}>
        <thead>
          <tr className="group-row">
            {INFO_COLS.map((col) => (
              <th key={col.key} rowSpan={2} style={{ width: col.width, textAlign: 'left' }}>
                {t(col.labelKey)}
              </th>
            ))}
            <th colSpan={STUDY_WORK_COLS.length}>{t('studyLoad.workload.col.group.studyWork')}</th>
            <th colSpan={OTHER_WORK_COLS.length}>{t('studyLoad.workload.col.group.otherWork')}</th>
            <th rowSpan={2} style={{ width: 100 }}>
              {t('studyLoad.workload.col.total')}
            </th>
            {canEdit ? (
              <th rowSpan={2} style={{ width: ACTIONS_COL_WIDTH }}>
                {t('studyLoad.distribution.column.actions')}
              </th>
            ) : null}
          </tr>
          <tr>
            {STUDY_WORK_COLS.map((col) => (
              <th key={col.key} style={{ width: col.width }}>
                {t(col.labelKey)}
              </th>
            ))}
            {OTHER_WORK_COLS.map((col) => (
              <th key={col.key} style={{ width: col.width }}>
                {t(col.labelKey)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {directionGroups.map((dirGroup) => (
            <Fragment key={`direction-${dirGroup.direction}-${dirGroup.rows[0]!.blockId}`}>
              <tr className="direction-row">
                <td colSpan={colCount}>{dirGroup.direction}</td>
              </tr>
              {groupRowsBySection(dirGroup.rows).map((group) => {
                const sectionJami = sumWorkloadRows(group.rows);
                return (
                  <Fragment key={`section-${group.section}-${group.rows[0]!.blockId}`}>
                    <tr className="section-row">
                      <td colSpan={colCount}>{group.section}</td>
                    </tr>
                    {group.rows.map((row) => {
                      const isEditingRow = editingBlockId === row.blockId;
                      return (
                        <tr key={row.blockId}>
                          {WORKLOAD_COLUMNS.map((col) => (
                            <td
                              key={col.key}
                              className={
                                col.key === 'science'
                                  ? 'info-cell'
                                  : col.editable && isEditingRow
                                    ? 'editable-cell'
                                    : undefined
                              }
                            >
                              {renderCell(row, col.key)}
                            </td>
                          ))}
                          {canEdit ? (
                            <td>
                              <Can perform="workload:update">
                                {isEditingRow ? (
                                  <>
                                    <Button
                                      size="small"
                                      type="text"
                                      icon={<CheckOutlined />}
                                      loading={updateBlock.isPending}
                                      title={t('studyLoad.common.save')}
                                      onClick={() => void commitEdit(row)}
                                    />
                                    <Button
                                      size="small"
                                      type="text"
                                      icon={<CloseOutlined />}
                                      disabled={updateBlock.isPending}
                                      title={t('studyLoad.common.cancel')}
                                      onClick={cancelEdit}
                                    />
                                  </>
                                ) : (
                                  <Button
                                    size="small"
                                    type="text"
                                    icon={<EditOutlined />}
                                    disabled={Boolean(editingBlockId)}
                                    title={t('studyLoad.workload.detail.editTooltip')}
                                    onClick={() => startEdit(row)}
                                  />
                                )}
                              </Can>
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                    {sectionGroupCount > 1 ? (
                      <tr className="jami-row">
                        <td colSpan={INFO_COLS.length} style={{ textAlign: 'left' }}>
                          {t('studyLoad.workload.detail.totalRowLabel')}
                        </td>
                        {[
                          ...STUDY_WORK_COLS,
                          ...OTHER_WORK_COLS,
                          ...WORKLOAD_COLUMNS.filter((c) => c.group === 'total'),
                        ].map((col) => (
                          <td key={col.key}>{sectionJami[col.key] || '—'}</td>
                        ))}
                        {canEdit ? <td /> : null}
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </Fragment>
          ))}
          <tr className="jami-row grand">
            <td colSpan={INFO_COLS.length} style={{ textAlign: 'left' }}>
              {t('studyLoad.workload.detail.totalRowLabel')}
            </td>
            {[...STUDY_WORK_COLS, ...OTHER_WORK_COLS, ...WORKLOAD_COLUMNS.filter((c) => c.group === 'total')].map(
              (col) => (
                <td key={col.key}>{grandTotal[col.key] || '—'}</td>
              ),
            )}
            {canEdit ? <td /> : null}
          </tr>
        </tbody>
      </Table>
    </TableScroll>
  );
};

export default WorkloadTable;
