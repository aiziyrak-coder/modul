import { Fragment, useState } from 'react';
import { App, Button, InputNumber } from 'antd';
import { CheckOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons';
import { Can } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import type { StaffPositions } from '../../model/detail-types';
import { useUpdateStaffPositions } from '../../api/workload-api';
import {
  STAFF_GROUPS,
  STAFF_ROWS,
  STAFF_TABLE_MIN_WIDTH,
  buildStaffPositionsPayload,
  itemKey,
  staffCellValue,
  sumStaffGroup,
  type StaffDraftMap,
  type StaffEditableField,
  type StaffRowKey,
} from './columns';
import { Table, TableScroll } from './style';

interface IProps {
  workloadId: string;
  staffPositions: StaffPositions;
  canEdit: boolean;
}

const ACTIONS_COL_WIDTH = 90;

const StaffPositionsTable = ({ workloadId, staffPositions, canEdit }: IProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const updateStaff = useUpdateStaffPositions(workloadId);

  const [editingRowKey, setEditingRowKey] = useState<StaffRowKey | null>(null);
  const [drafts, setDrafts] = useState<StaffDraftMap>({});

  const startEdit = (rowKey: StaffRowKey) => {
    setEditingRowKey(rowKey);
    setDrafts({});
  };

  const cancelEdit = () => {
    setEditingRowKey(null);
    setDrafts({});
  };

  const setCell = (category: string, slug: string, field: StaffEditableField, value: number) => {
    const key = itemKey(category, slug);
    setDrafts((prev) => {
      const current = prev[key] ?? {
        positions: staffCellValue(staffPositions.items, prev, category, slug, 'positions'),
        load: staffCellValue(staffPositions.items, prev, category, slug, 'load'),
        hourly: staffCellValue(staffPositions.items, prev, category, slug, 'hourly'),
      };
      return { ...prev, [key]: { ...current, [field]: value } };
    });
  };

  const commitEdit = async () => {
    const items = buildStaffPositionsPayload(staffPositions.items, drafts);
    try {
      await updateStaff.mutateAsync(items);
      message.success(t('studyLoad.workload.staff.saved'));
      cancelEdit();
    } catch (err) {
      message.error(getApiErrorMessage(err));
    }
  };

  const minWidth = STAFF_TABLE_MIN_WIDTH + (canEdit ? ACTIONS_COL_WIDTH : 0);

  return (
    <TableScroll>
      <Table $minWidth={minWidth}>
        <thead>
          <tr className="group-row">
            <th rowSpan={2} style={{ width: 140 }} />
            {STAFF_GROUPS.map((group) => (
              <th key={group.category} colSpan={group.cols.length + (group.hasTotal ? 1 : 0)}>
                {t(group.labelKey)}
              </th>
            ))}
            {canEdit ? (
              <th rowSpan={2} style={{ width: ACTIONS_COL_WIDTH }}>
                {t('studyLoad.distribution.column.actions')}
              </th>
            ) : null}
          </tr>
          <tr>
            {STAFF_GROUPS.map((group) => (
              <Fragment key={group.category}>
                {group.cols.map((col) => (
                  <th key={col.slug}>{t(col.labelKey)}</th>
                ))}
                {group.hasTotal ? <th>{t(group.totalLabelKey!)}</th> : null}
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {STAFF_ROWS.map((row) => {
            const isEditingRow = editingRowKey === row.key;
            const cellsEditable = canEdit && row.editable && isEditingRow;
            return (
              <tr key={row.key}>
                <td className="info-cell">{t(row.labelKey)}</td>
                {STAFF_GROUPS.map((group) => (
                  <Fragment key={group.category}>
                    {group.cols.map((col) => {
                      if (row.key === 'totalHours') {
                        const positions = staffCellValue(
                          staffPositions.items,
                          drafts,
                          group.category,
                          col.slug,
                          'positions',
                        );
                        const load = staffCellValue(staffPositions.items, drafts, group.category, col.slug, 'load');
                        const total = positions * load;
                        return <td key={col.slug}>{total || '—'}</td>;
                      }
                      const field = row.key;
                      const value = staffCellValue(staffPositions.items, drafts, group.category, col.slug, field);
                      if (cellsEditable) {
                        return (
                          <td key={col.slug} className="editable-cell">
                            <Can perform="workload:update">
                              <InputNumber
                                size="small"
                                min={0}
                                value={value}
                                aria-label={`${t(group.labelKey)} — ${t(col.labelKey)} — ${t(row.labelKey)}`}
                                onChange={(v) => setCell(group.category, col.slug, field, typeof v === 'number' ? v : 0)}
                                onPressEnter={() => void commitEdit()}
                                style={{ width: '100%' }}
                              />
                            </Can>
                          </td>
                        );
                      }
                      return <td key={col.slug}>{value || '—'}</td>;
                    })}
                    {group.hasTotal ? (
                      <td className="total-cell">
                        {sumStaffGroup(staffPositions.items, drafts, group, row.key) || '—'}
                      </td>
                    ) : null}
                  </Fragment>
                ))}
                {canEdit ? (
                  <td className="actions-cell">
                    {row.editable ? (
                      <Can perform="workload:update">
                        {isEditingRow ? (
                          <>
                            <Button
                              size="small"
                              type="text"
                              icon={<CheckOutlined />}
                              loading={updateStaff.isPending}
                              title={t('studyLoad.common.save')}
                              onClick={() => void commitEdit()}
                            />
                            <Button
                              size="small"
                              type="text"
                              icon={<CloseOutlined />}
                              disabled={updateStaff.isPending}
                              title={t('studyLoad.common.cancel')}
                              onClick={cancelEdit}
                            />
                          </>
                        ) : (
                          <Button
                            size="small"
                            type="text"
                            icon={<EditOutlined />}
                            disabled={Boolean(editingRowKey)}
                            title={t('studyLoad.workload.detail.editTooltip')}
                            onClick={() => startEdit(row.key)}
                          />
                        )}
                      </Can>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </Table>
    </TableScroll>
  );
};

export default StaffPositionsTable;
