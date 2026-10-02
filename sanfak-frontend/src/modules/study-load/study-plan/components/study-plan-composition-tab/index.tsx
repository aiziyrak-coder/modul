import { useCallback, useMemo, useState } from 'react';
import {
  App,
  Button,
  Empty,
  Input,
  Space,
  Table,
  Typography,
} from 'antd';
import { CheckOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { LpProcessKey } from '../../model/detail-types';
import {
  useUpdateSpecialPart,
  useUpdateSpecialPartTitle,
} from '../../api/detail-api';
import { useTranslation } from '@/shared/lib/i18n';

const { Text } = Typography;

interface TableRow extends LpProcessKey {
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
        {value !== undefined && value !== null && value !== ''
          ? String(value)
          : '—'}
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

interface IProps {
  id: string;
  keys: LpProcessKey[];
  title: string | null;
}

const StudyPlanCompositionTab = ({ id, keys, title: initialTitle }: IProps) => {
  const updateMutation = useUpdateSpecialPart();
  const titleMutation = useUpdateSpecialPartTitle();
  const { message } = App.useApp();
  const { t } = useTranslation();

  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<
    Record<string, Record<string, string | number>>
  >({});

  const [commentOpen, setCommentOpen] = useState(false);
  const [commentValue, setCommentValue] = useState(initialTitle ?? '');

  const tableRows = useMemo((): TableRow[] => {
    if (!keys.length) return [];
    const main = keys.slice(0, -1).map((k): TableRow => ({ ...k, rowType: 'data' }));
    const last = keys[keys.length - 1] as LpProcessKey | undefined;
    if (!last) return main;
    const groupRow: TableRow = {
      id: last.id,
      key: last.key,
      title: last.title,
      week: last.week,
      semester: '',
      rowType: 'group',
      background: '#EEF2F6',
    };
    return [...main, groupRow];
  }, [keys]);

  const handleEditStart = useCallback((row: LpProcessKey) => {
    setEditingRowId(row.id);
    setEditingValues({ [row.id]: { semester: row.semester ?? '' } });
  }, []);

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
    async (row: LpProcessKey) => {
      const vals = editingValues[row.id] ?? {};
      try {
        await updateMutation.mutateAsync({
          id,
          keys: [
            {
              _id: row.id,
              week: row.week,
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
    try {
      await titleMutation.mutateAsync({ id, title: commentValue });
      message.success(t('studyLoad.studyPlan.composition.textSaved'));
      setCommentOpen(false);
    } catch {
      message.error(t('studyLoad.studyPlan.composition.saveError'));
    }
  }, [id, commentValue, titleMutation, message, t]);

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
        render: (_: unknown, row: TableRow) => (
          <Text style={{ fontSize: 13 }}>
            {row.week !== undefined && row.week !== null && row.week !== ''
              ? String(row.week)
              : '—'}
          </Text>
        ),
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
              rowId={row.id}
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
          if (editingRowId === row.id) {
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
          return (
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              style={{ color: 'var(--color-text-soft)' }}
              onClick={() => handleEditStart(row)}
            />
          );
        },
      },
    ],
    [
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

  if (!keys.length) {
    return (
      <Empty
        description={t('studyLoad.studyPlan.composition.empty')}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <Table<TableRow>
        dataSource={tableRows}
        columns={columns}
        rowKey="id"
        pagination={false}
        size="small"
        scroll={{ x: 'max-content' }}
        style={{
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
        }}
        rowClassName={(row) =>
          row.rowType === 'group' ? 'sp-comp-row-group' : ''
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
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              style={{ color: 'var(--color-text-soft)' }}
              onClick={() => {
                setCommentValue(initialTitle ?? '');
                setCommentOpen(true);
              }}
            />
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
          <div
            style={{ color: 'var(--color-text)', fontSize: 13, lineHeight: 1.6 }}
          >
            {initialTitle ? (
              initialTitle
            ) : (
              <Text type="secondary">{t('studyLoad.common.noData')}</Text>
            )}
          </div>
        )}
      </div>

      <style>{`
        .sp-comp-row-group td {
          background: #EEF2F6 !important;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
};

export default StudyPlanCompositionTab;
