import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Empty,
  Input,
  Skeleton,
  Space,
  Table,
  Typography,
} from 'antd';
import { Can } from '@/app/session';
import { CheckOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from '@/shared/lib/i18n';
import {
  useWorkingScheduleComposition,
  useUpdateComposition,
  useUpdateCompositionTitle,
} from '../../api/working-schedule-process-api';
import type { CompositionKey } from '../../api/working-schedule-process-api';

const { Text } = Typography;

interface TableRow extends CompositionKey {
  rowType: 'data' | 'group';
  background?: string;
}

interface EditableCellProps {
  value: string | number;
  rowId: string;
  field: 'week' | 'semester';
  editingRowId: string | null;
  editingValues: Record<string, Record<string, string | number>>;
  onChange: (rowId: string, field: string, val: string | number) => void;
}

function EditableCell({
  value,
  rowId,
  field,
  editingRowId,
  editingValues,
  onChange,
}: EditableCellProps) {
  if (editingRowId !== rowId) {
    return (
      <Text style={{ fontSize: 13 }}>
        {value !== undefined && value !== null && value !== '' ? String(value) : '—'}
      </Text>
    );
  }
  const current = editingValues[rowId]?.[field] ?? value;
  return (
    <Input
      size="small"
      value={String(current)}
      style={{ width: field === 'week' ? 80 : 120, fontSize: 13 }}
      onChange={(e) => onChange(rowId, field, e.target.value)}
    />
  );
}

interface CompositionTabProps {
  id: string | undefined;
  editable: boolean;
}

const CompositionTab = ({ id, editable }: CompositionTabProps) => {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useWorkingScheduleComposition(
    id,
  );
  const updateMutation = useUpdateComposition();
  const titleMutation = useUpdateCompositionTitle();
  const { message } = App.useApp();

  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<
    Record<string, Record<string, string | number>>
  >({});

  const [commentOpen, setCommentOpen] = useState(false);
  const [commentValue, setCommentValue] = useState('');

  const commentInitial = data?.title ?? '';

  const handleEditStart = useCallback(
    (row: CompositionKey) => {
      setEditingRowId(row._id);
      setEditingValues({
        [row._id]: { week: row.week, semester: row.semester ?? '' },
      });
    },
    [],
  );

  const handleEditCancel = useCallback(() => {
    setEditingRowId(null);
    setEditingValues({});
  }, []);

  const handleFieldChange = useCallback(
    (rowId: string, field: string, val: string | number) => {
      setEditingValues((prev) => ({
        ...prev,
        [rowId]: { ...prev[rowId], [field]: val },
      }));
    },
    [],
  );

  const handleEditSave = useCallback(
    async (row: CompositionKey) => {
      if (!id) return;
      const vals = editingValues[row._id] ?? {};
      try {
        await updateMutation.mutateAsync({
          id,
          keys: [
            {
              _id: row._id,
              week: vals.week !== undefined ? vals.week : row.week,
              semester:
                vals.semester !== undefined
                  ? String(vals.semester)
                  : (row.semester ?? undefined),
            },
          ],
        });
        message.success(t('studyLoad.studyPlan.composition.saved'));
      } catch {
        message.error(t('studyLoad.studyPlan.composition.saveError'));
      } finally {
        setEditingRowId(null);
        setEditingValues({});
      }
    },
    [id, editingValues, updateMutation, message, t],
  );

  const handleCommentSave = useCallback(async () => {
    if (!id) return;
    try {
      await titleMutation.mutateAsync({ id, title: commentValue });
      message.success(t('studyLoad.studyPlan.composition.textSaved'));
      setCommentOpen(false);
    } catch {
      message.error(t('studyLoad.studyPlan.composition.saveError'));
    }
  }, [id, commentValue, titleMutation, message, t]);

  const tableRows = useMemo((): TableRow[] => {
    if (!data?.keys?.length) return [];
    const keys = data.keys;
    const main = keys.slice(0, -1).map((k): TableRow => ({ ...k, rowType: 'data' }));
    const last = keys[keys.length - 1] as CompositionKey;
    const sum = main.reduce((acc, r) => acc + (Number(r.week) || 0), 0);
    const groupRow: TableRow = {
      _id: last._id,
      key: last.key,
      title: last.title,
      week: sum,
      semester: '',
      rowType: 'group',
      background: '#EEF2F6',
    };
    return [...main, groupRow];
  }, [data]);

  const weekMismatch = useMemo(() => {
    const keys = data?.keys;
    if (!keys?.length || keys.length < 2) return null;

    const expected = Number(keys[keys.length - 1]?.week);
    if (!Number.isFinite(expected)) return null;

    const actual = keys
      .slice(0, -1)
      .reduce((acc, k) => acc + (Number(k.week) || 0), 0);

    return actual === expected ? null : { actual, expected };
  }, [data]);

  const columns: ColumnsType<TableRow> = useMemo(
    () => [
      {
        title: t('studyLoad.studyPlan.composition.columnTitle'),
        dataIndex: 'title',
        key: 'title',
        onHeaderCell: () => ({
          style: {
            textAlign: 'left' as const,
            color: '#697586',
            background: '#EEF2F6',
          },
        }),
        render: (_: unknown, row: TableRow) => (
          <Text style={{ fontSize: 13 }}>{row.title}</Text>
        ),
      },
      {
        title: t('studyLoad.studyPlan.composition.columnWeeks'),
        dataIndex: 'week',
        key: 'week',
        width: 150,
        onHeaderCell: () => ({
          style: {
            textAlign: 'center' as const,
            color: '#697586',
            background: '#EEF2F6',
          },
        }),
        onCell: () => ({ style: { textAlign: 'center' as const } }),
        render: (_: unknown, row: TableRow) => {
          if (row.rowType === 'group') {
            return <Text style={{ fontSize: 13 }}>{row.week}</Text>;
          }
          return (
            <EditableCell
              value={row.week}
              rowId={row._id}
              field="week"
              editingRowId={editingRowId}
              editingValues={editingValues}
              onChange={handleFieldChange}
            />
          );
        },
      },
      {
        title: t('studyLoad.distribution.table.semester'),
        dataIndex: 'semester',
        key: 'semester',
        width: 160,
        onHeaderCell: () => ({
          style: {
            textAlign: 'center' as const,
            color: '#697586',
            background: '#EEF2F6',
          },
        }),
        onCell: () => ({ style: { textAlign: 'center' as const } }),
        render: (_: unknown, row: TableRow) => {
          if (row.rowType === 'group') return null;
          return (
            <EditableCell
              value={row.semester ?? ''}
              rowId={row._id}
              field="semester"
              editingRowId={editingRowId}
              editingValues={editingValues}
              onChange={handleFieldChange}
            />
          );
        },
      },
      {
        title: t('studyLoad.distribution.column.actions'),
        key: 'actions',
        width: 90,
        onHeaderCell: () => ({
          style: {
            textAlign: 'center' as const,
            color: '#697586',
            background: '#EEF2F6',
          },
        }),
        onCell: () => ({ style: { textAlign: 'center' as const } }),
        render: (_: unknown, row: TableRow) => {
          if (row.rowType === 'group') return null;
          if (editingRowId === row._id) {
            return (
              <Space size={4}>
                <Button
                  type="text"
                  size="small"
                  icon={<CheckOutlined />}
                  style={{ color: 'var(--brand-primary)' }}
                  loading={updateMutation.isPending}
                  onClick={() => handleEditSave(row)}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={handleEditCancel}
                />
              </Space>
            );
          }
          if (!editable) return null;
          return (
            <Can perform="workingSchedule:update">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                style={{ color: 'var(--color-text-soft)' }}
                onClick={() => handleEditStart(row)}
              />
            </Can>
          );
        },
      },
    ],
    [
      editable,
      editingRowId,
      editingValues,
      handleFieldChange,
      handleEditStart,
      handleEditSave,
      handleEditCancel,
      updateMutation.isPending,
      t,
    ],
  );

  if (isLoading) {
    return <Skeleton active paragraph={{ rows: 8 }} />;
  }

  if (isError || !data) {
    return (
      <Empty
        description={t('studyLoad.workingSchedule.composition.loadError')}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  if (data.keys.length === 0) {
    return (
      <Empty
        description={t('studyLoad.studyPlan.composition.empty')}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {weekMismatch ? (
        <Alert
          type="warning"
          showIcon
          message={t('studyLoad.workingSchedule.weekMismatch.title')}
          description={t('studyLoad.workingSchedule.weekMismatch.text', {
            actual: weekMismatch.actual,
            expected: weekMismatch.expected,
            diff: Math.abs(weekMismatch.actual - weekMismatch.expected),
          })}
        />
      ) : null}

      <Table<TableRow>
        dataSource={tableRows}
        columns={columns}
        rowKey="_id"
        pagination={false}
        size="small"
        scroll={{ x: 'max-content' }}
        style={{
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
        }}
        rowClassName={(row) =>
          row.rowType === 'group' ? 'comp-row-group' : ''
        }
      />

      <div
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-4)',
          background: 'var(--color-bg-container, #fff)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-3)',
          }}
        >
          <Text strong style={{ fontSize: 14 }}>
            {t('studyLoad.studyPlan.composition.commentHeading')}
          </Text>
          {!commentOpen ? (
            editable ? (
              <Can perform="workingSchedule:update">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  style={{ color: 'var(--color-text-soft)' }}
                  onClick={() => {
                    setCommentValue(commentInitial);
                    setCommentOpen(true);
                  }}
                />
              </Can>
            ) : null
          ) : (
            <Space size={4}>
              <Button
                type="text"
                size="small"
                icon={<CheckOutlined />}
                style={{ color: 'var(--brand-primary)' }}
                loading={titleMutation.isPending}
                onClick={handleCommentSave}
              />
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={() => setCommentOpen(false)}
              />
            </Space>
          )}
        </div>

        {commentOpen ? (
          <Input.TextArea
            value={commentValue}
            onChange={(e) => setCommentValue(e.target.value)}
            rows={4}
            style={{ resize: 'vertical' }}
            placeholder={t('studyLoad.studyPlan.composition.commentPlaceholder')}
          />
        ) : (
          <div style={{ color: 'var(--color-text)', fontSize: 13, lineHeight: 1.6 }}>
            {commentInitial ? (
              commentInitial
            ) : (
              <Text type="secondary">{t('studyLoad.common.noData')}</Text>
            )}
          </div>
        )}
      </div>

      <style>{`
        .comp-row-group td {
          background: #EEF2F6 !important;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
};

export default CompositionTab;
