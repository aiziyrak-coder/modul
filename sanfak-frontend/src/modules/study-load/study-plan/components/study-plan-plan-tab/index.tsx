import { useCallback, useMemo, useRef, useState } from 'react';
import {
  App,
  Button,
  Empty,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { StudyPlanPlan } from '../../api/detail-api';
import {
  useLinkStudyPlanScience,
  useRemoveElectiveRow,
  useUpdateStudyPlanScience,
  type UpdateStudyPlanSciencePayload,
} from '../../api/detail-api';
import { useSciences } from '../../api/references';
import { Can } from '@/app/session';
import { getApiErrorMessage } from '@/shared/api';
import ElectiveRowModal, {
  type ElectiveRowModalBlock,
} from '../elective-row-modal';
import {
  computeBlockFreeQuota,
  hasFreeQuota,
  isElectiveBlock,
  type BlockFreeQuota,
} from '../../model/elective-block';
import { useTranslation } from '@/shared/lib/i18n';

const { Text } = Typography;

interface PlanRow {
  key: string;
  rowType: 'block' | 'science';
  _id?: string;
  parentId?: string;
  blockCode?: string;
  scienceId?: string | null;
  kind?: 'subject' | 'practice' | 'sectionHeader' | 'aggregate' | 'electiveSlot';
  serialNumber?: string | null;
  code?: string | null;
  title?: string | null;
  totalCredit?: number;
  particles?: Record<string, number>;
  semesters?: Record<string, number>;
  alternatives?: { title: string | null }[];
}

function buildRows(plan: StudyPlanPlan): PlanRow[] {
  const rows: PlanRow[] = [];
  for (const blk of plan.blocks) {
    rows.push({
      key: `blk-${blk.id}`,
      rowType: 'block',
      _id: blk.id,
      blockCode: blk.blockCode,
      code: blk.blockCode ?? blk.code,
      title: blk.title,
      totalCredit: blk.totalCredit,
      particles: {},
      semesters: {},
    });
    for (const sci of blk.sciences) {
      const pMap: Record<string, number> = {};
      for (const p of sci.particle) {
        pMap[p.slug] = p.value;
      }
      const semMap: Record<string, number> = {};
      for (const [semKey, semVal] of Object.entries(sci.semesters)) {
        semMap[semKey] = semVal.hour;
      }
      rows.push({
        key: `sci-${sci.id}`,
        rowType: 'science',
        _id: sci.id,
        parentId: blk.id,
        blockCode: blk.blockCode ?? blk.code ?? undefined,
        scienceId: sci.scienceId,
        kind: sci.kind,
        serialNumber: sci.serialNumber,
        code: sci.code,
        title: sci.title,
        totalCredit: sci.totalCredit,
        particles: pMap,
        semesters: semMap,
        alternatives: sci.alternatives,
      });
    }
  }
  return rows;
}

interface EditableCellProps {
  value: string | number | undefined;
  rowId: string;
  field: string;
  type: 'text' | 'number';
  editingRowId: string | null;
  editingValues: Record<string, Record<string, string | number>>;
  onChange: (rowId: string, field: string, val: string | number) => void;
}

function EditableCell({
  value,
  rowId,
  field,
  type,
  editingRowId,
  editingValues,
  onChange,
}: EditableCellProps) {
  if (editingRowId !== rowId) {
    return (
      <Text style={{ fontSize: 12 }}>
        {value !== undefined && value !== null && value !== '' ? String(value) : '—'}
      </Text>
    );
  }
  const current = editingValues[rowId]?.[field] ?? value ?? '';

  if (type === 'number') {
    return (
      <InputNumber
        size="small"
        value={Number(current)}
        style={{ width: 70, fontSize: 12 }}
        onChange={(v) => onChange(rowId, field, v ?? 0)}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <Input
      size="small"
      value={String(current)}
      style={{ width: 100, fontSize: 12 }}
      onChange={(e) => onChange(rowId, field, e.target.value)}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

interface IProps {
  isLoading: boolean;
  isError: boolean;
  data: StudyPlanPlan | undefined;
}

function getSemKey(audienceIdx: number): string {
  return String(audienceIdx + 1);
}

const StudyPlanPlanTab = ({ isLoading, isError, data }: IProps) => {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const planId = data?.id;
  const updateMutation = useUpdateStudyPlanScience(planId);

  const linkMutation = useLinkStudyPlanScience(planId);
  const sciencesQuery = useSciences();
  const [linkRow, setLinkRow] = useState<PlanRow | null>(null);
  const [linkScienceId, setLinkScienceId] = useState<string | undefined>(undefined);

  const removeElectiveMutation = useRemoveElectiveRow(planId);
  const [electiveModalBlock, setElectiveModalBlock] = useState<ElectiveRowModalBlock | null>(
    null,
  );

  const electiveBlockInfo = useMemo(() => {
    const map = new Map<
      string,
      { elective: boolean; freeQuota: BlockFreeQuota; title: string | null }
    >();
    for (const blk of data?.blocks ?? []) {
      map.set(blk.blockCode, {
        elective: isElectiveBlock(blk),
        freeQuota: computeBlockFreeQuota(blk),
        title: blk.title,
      });
    }
    return map;
  }, [data]);

  const handleRemoveElectiveRow = useCallback(
    async (row: PlanRow) => {
      if (!row._id) return;
      try {
        const result = await removeElectiveMutation.mutateAsync(row._id);
        message.success(t('studyLoad.studyPlan.planTab.electiveRowRemoved'));
        if (result.warning) message.warning(result.warning);
      } catch (err) {
        message.error(
          getApiErrorMessage(err, t('studyLoad.studyPlan.planTab.electiveRowRemoveError')),
        );
      }
    },
    [removeElectiveMutation, message, t],
  );

  const editingRowIdRef = useRef<string | null>(null);
  const editingValuesRef = useRef<Record<string, Record<string, string | number>>>({});
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<Record<string, Record<string, string | number>>>({});

  const handleEditStart = useCallback((row: PlanRow) => {
    if (row.rowType === 'block') return;
    const init: Record<string, string | number> = {
      code: row.code ?? '',
      serialNumber: row.serialNumber ?? '',
      totalCredit: row.totalCredit ?? 0,
      ...row.particles,
    };
    for (const [semKey, semHour] of Object.entries(row.semesters ?? {})) {
      init[`sem_${semKey}`] = semHour;
    }
    editingRowIdRef.current = row.key;
    editingValuesRef.current = { [row.key]: init };
    setEditingRowId(row.key);
    setEditingValues({ [row.key]: init });
  }, []);

  const handleEditCancel = useCallback(() => {
    editingRowIdRef.current = null;
    editingValuesRef.current = {};
    setEditingRowId(null);
    setEditingValues({});
  }, []);

  const handleFieldChange = useCallback(
    (rowId: string, field: string, val: string | number) => {
      const updated = {
        ...editingValuesRef.current,
        [rowId]: { ...(editingValuesRef.current[rowId] ?? {}), [field]: val },
      };
      editingValuesRef.current = updated;
      setEditingValues({ ...updated });
    },
    [],
  );

  const handleSave = useCallback(
    async (row: PlanRow) => {
      if (!planId || !row._id) return;
      const vals = editingValuesRef.current[row.key] ?? {};
      const particleLabels = data?.particleLabels ?? [];
      const distribution = data?.distribution ?? { audience: [], semester: [] };

      const smesterPayload: Record<string, number | string> = {};
      for (let ai = 0; ai < distribution.audience.length; ai++) {
        const semKey = getSemKey(ai);
        const fieldKey = `sem_${semKey}`;
        const rawVal = vals[fieldKey] !== undefined ? vals[fieldKey] : (row.semesters?.[semKey] ?? 0);
        smesterPayload[semKey] = typeof rawVal === 'string' ? Number(rawVal) : rawVal;
      }

      const payload: UpdateStudyPlanSciencePayload = {
        _id: row._id,
        parentId: row.parentId,
        title: row.title ?? '',
        code: vals.code !== undefined ? String(vals.code) : (row.code ?? ''),
        serialNumber: vals.serialNumber !== undefined ? String(vals.serialNumber) : (row.serialNumber ?? ''),
        totalCredit: vals.totalCredit !== undefined ? Number(vals.totalCredit) : (row.totalCredit ?? 0),
        particle: particleLabels.map((pl) => {
          const rawVal = vals[pl.slug] !== undefined ? vals[pl.slug] : (row.particles?.[pl.slug] ?? 0);
          const val: string | number = rawVal !== undefined ? rawVal : 0;
          return { _id: pl.slug, [pl.slug]: val };
        }),
        smester: smesterPayload,
      };
      try {
        await updateMutation.mutateAsync(payload);
        message.success(t('studyLoad.studyPlan.composition.saved'));
        handleEditCancel();
      } catch {
        message.error(t('studyLoad.studyPlan.composition.saveError'));
      }
    },
    [planId, data, updateMutation, message, handleEditCancel, t],
  );

  const rows = useMemo(() => (data ? buildRows(data) : []), [data]);

  const particleColumns: ColumnsType<PlanRow> = useMemo(
    () =>
      (data?.particleLabels ?? []).map((pl) => ({
        title: pl.title ?? pl.slug,
        key: `p_${pl.slug}`,
        width: 80,
        align: 'center' as const,
        onHeaderCell: () => ({
          style: { textAlign: 'center' as const, background: '#ECF3FF', color: '#121926' },
        }),
        render: (_: unknown, row: PlanRow) => {
          if (row.rowType === 'block') {
            const val = row.particles?.[pl.slug];
            return val !== undefined ? <Text style={{ fontSize: 12 }}>{val}</Text> : null;
          }
          return (
            <EditableCell
              value={row.particles?.[pl.slug]}
              rowId={row.key}
              field={pl.slug}
              type="number"
              editingRowId={editingRowId}
              editingValues={editingValues}
              onChange={handleFieldChange}
            />
          );
        },
      })),
    [data?.particleLabels, editingRowId, editingValues, handleFieldChange],
  );

  const semesterColumns = useMemo((): ColumnsType<PlanRow> => {
    const distribution = data?.distribution ?? { audience: [], semester: [] };
    if (!distribution.audience.length) return [];

    const headerBg = '#E8F8EB';
    const subHeaderBg = '#EEF2F6';

    return [
      {
        title: t('studyLoad.studyPlan.planTab.semesterGroupHeading'),
        key: 'sem_group',
        onHeaderCell: () => ({
          style: {
            textAlign: 'center' as const,
            background: headerBg,
            color: '#121926',
          },
        }),
        children: distribution.audience.map((audienceNum, ai) => {
          const semKey = getSemKey(ai);
          return {
            title: String(audienceNum),
            key: `sem_aud_${audienceNum}`,
            onHeaderCell: () => ({
              style: {
                textAlign: 'center' as const,
                background: headerBg,
                color: '#121926',
                minWidth: 75,
              },
            }),
            children: [
              {
                title: String(distribution.semester[0] ?? ai + 1),
                key: `sem_cell_${semKey}`,
                width: 80,
                align: 'center' as const,
                onHeaderCell: () => ({
                  style: { textAlign: 'center' as const, background: subHeaderBg },
                }),
                render: (_: unknown, row: PlanRow) => {
                  if (row.rowType === 'block') return null;
                  return (
                    <EditableCell
                      value={row.semesters?.[semKey] ?? 0}
                      rowId={row.key}
                      field={`sem_${semKey}`}
                      type="number"
                      editingRowId={editingRowId}
                      editingValues={editingValues}
                      onChange={handleFieldChange}
                    />
                  );
                },
              },
            ],
          };
        }),
      },
    ] as ColumnsType<PlanRow>;
  }, [data?.distribution, editingRowId, editingValues, handleFieldChange, t]);

  const columns: ColumnsType<PlanRow> = useMemo(
    () => [
      {
        title: t('studyLoad.studyPlan.planTab.columnSerialNumber'),
        key: 'serialNumber',
        width: 48,
        onHeaderCell: () => ({
          style: { textAlign: 'center' as const, background: '#ECF3FF', color: '#121926' },
        }),
        render: (_: unknown, row: PlanRow) => {
          if (row.rowType === 'block') return null;
          return (
            <EditableCell
              value={row.serialNumber ?? ''}
              rowId={row.key}
              field="serialNumber"
              type="text"
              editingRowId={editingRowId}
              editingValues={editingValues}
              onChange={handleFieldChange}
            />
          );
        },
      },
      {
        title: t('studyLoad.studyPlan.planTab.columnCode'),
        key: 'code',
        width: 177,
        onHeaderCell: () => ({
          style: { textAlign: 'left' as const, background: '#ECF3FF', color: '#121926' },
        }),
        render: (_: unknown, row: PlanRow) => {
          if (row.rowType === 'block') {
            return <Text strong style={{ fontSize: 12 }}>{row.code ?? ''}</Text>;
          }
          if (editingRowId === row.key) {
            return (
              <EditableCell
                value={row.code ?? ''}
                rowId={row.key}
                field="code"
                type="text"
                editingRowId={editingRowId}
                editingValues={editingValues}
                onChange={handleFieldChange}
              />
            );
          }
          return (
            <Space size={4}>
              <Text style={{ fontSize: 12 }}>{row.code ?? '—'}</Text>
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
        key: 'title',
        onHeaderCell: () => ({
          style: { textAlign: 'left' as const, background: '#ECF3FF', color: '#121926' },
        }),
        render: (_: unknown, row: PlanRow) => {
          if (row.rowType === 'block') {
            const info = row.blockCode ? electiveBlockInfo.get(row.blockCode) : undefined;
            if (!info?.elective) {
              return <Text strong style={{ fontSize: 12 }}>{row.title ?? ''}</Text>;
            }
            const quotaEntries = Object.entries(info.freeQuota);
            const enabled = hasFreeQuota(info.freeQuota);
            return (
              <Space direction="vertical" size={2}>
                <Space size={8}>
                  <Text strong style={{ fontSize: 12 }}>
                    {row.title ?? ''}
                  </Text>
                  <Can perform="studyPlan:update">
                    <Tooltip
                      title={
                        enabled
                          ? undefined
                          : t('studyLoad.studyPlan.planTab.noFreeQuotaTooltip')
                      }
                    >
                      <span>
                        <Button
                          type="link"
                          size="small"
                          icon={<PlusOutlined style={{ fontSize: 11 }} />}
                          disabled={!enabled}
                          onClick={() =>
                            setElectiveModalBlock({
                              blockCode: row.blockCode ?? '',
                              title: row.title ?? null,
                              freeQuota: info.freeQuota,
                            })
                          }
                        >
                          {t('studyLoad.studyPlan.electiveRow.modalTitle')}
                        </Button>
                      </span>
                    </Tooltip>
                  </Can>
                </Space>
                {quotaEntries.length > 0 ? (
                  <Text type="secondary" style={{ fontSize: 10, fontWeight: 400 }}>
                    {t('studyLoad.studyPlan.planTab.quotaLabel')}{' '}
                    {quotaEntries
                      .map(([sem, q]) =>
                        t('studyLoad.studyPlan.planTab.quotaEntry', {
                          sem,
                          hour: q.hour,
                          credit: q.credit,
                        }),
                      )
                      .join(', ')}
                  </Text>
                ) : null}
              </Space>
            );
          }
          const isStructural = row.kind === 'sectionHeader' || row.kind === 'aggregate';
          if (isStructural) {
            return (
              <Text strong style={{ fontSize: 12, color: '#4B5565' }}>
                {row.title ?? ''}
              </Text>
            );
          }
          const alternativeTitles = (row.alternatives ?? [])
            .map((a) => a.title)
            .filter((t): t is string => Boolean(t));
          return (
            <Space direction="vertical" size={0}>
              <Space size={4} wrap>
                <Text style={{ fontSize: 12 }}>
                  {row.title !== undefined && row.title !== null && row.title !== ''
                    ? row.title
                    : '—'}
                </Text>
                {row.kind === 'electiveSlot' ? (
                  <Tag color="processing" style={{ fontSize: 10, lineHeight: '16px', margin: 0 }}>
                    {t('studyLoad.studyPlan.planTab.electiveSlotTag')}
                  </Tag>
                ) : null}
                {!row.scienceId &&
                row.kind !== 'practice' &&
                row.kind !== 'electiveSlot' ? (
                  <Tag color="warning" style={{ fontSize: 10, lineHeight: '16px', margin: 0 }}>
                    {t('studyLoad.studyPlan.planTab.unlinkedTag')}
                  </Tag>
                ) : null}
              </Space>
              {alternativeTitles.length > 0 ? (
                <Text type="secondary" style={{ fontSize: 10 }}>
                  {t('studyLoad.studyPlan.planTab.alternativesLabel')} {alternativeTitles.join(', ')}
                </Text>
              ) : null}
            </Space>
          );
        },
      },
      ...particleColumns,
      ...semesterColumns,
      {
        title: t('studyLoad.studyPlan.planTab.columnCredit'),
        key: 'totalCredit',
        width: 70,
        align: 'center' as const,
        onHeaderCell: () => ({
          style: { textAlign: 'center' as const, background: '#ECF3FF', color: '#121926' },
        }),
        render: (_: unknown, row: PlanRow) => {
          if (row.rowType === 'block') {
            return row.totalCredit !== undefined ? (
              <Text style={{ fontSize: 12 }}>{row.totalCredit}</Text>
            ) : null;
          }
          return (
            <EditableCell
              value={row.totalCredit}
              rowId={row.key}
              field="totalCredit"
              type="number"
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
            background: '#ECF3FF',
            color: '#121926',
          },
        }),
        onCell: () => ({ style: { textAlign: 'center' as const } }),
        render: (_: unknown, row: PlanRow) => {
          if (row.rowType === 'block') return null;
          if (editingRowId === row.key) {
            return (
              <Space size={4}>
                <Button
                  type="text"
                  size="small"
                  icon={<CheckOutlined />}
                  style={{ color: 'var(--brand-primary)' }}
                  loading={updateMutation.isPending}
                  onClick={() => handleSave(row)}
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
          const blockInfo = row.blockCode ? electiveBlockInfo.get(row.blockCode) : undefined;
          const isDeletableElectiveRow =
            Boolean(blockInfo?.elective) &&
            (row.kind === 'subject' || row.kind === 'electiveSlot');
          const isRemovingThisRow =
            removeElectiveMutation.isPending && removeElectiveMutation.variables === row._id;
          return (
            <Space size={2}>
              {!row.scienceId && (row.kind ?? 'subject') === 'subject' ? (
                <Tooltip title={t('studyLoad.studyPlan.planTab.linkTooltip')}>
                  <Button
                    type="text"
                    size="small"
                    icon={<LinkOutlined />}
                    style={{ color: 'var(--color-warning, #d48806)' }}
                    onClick={() => {
                      setLinkRow(row);
                      setLinkScienceId(undefined);
                    }}
                  />
                </Tooltip>
              ) : null}
              {isDeletableElectiveRow ? (
                <Can perform="studyPlan:update">
                  <Popconfirm
                    title={t('studyLoad.studyPlan.planTab.removeRowTitle')}
                    description={t('studyLoad.studyPlan.planTab.removeRowDescription')}
                    okText={t('studyLoad.common.delete')}
                    cancelText={t('studyLoad.common.cancel')}
                    onConfirm={() => void handleRemoveElectiveRow(row)}
                  >
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      style={{ color: 'var(--brand-error)' }}
                      loading={isRemovingThisRow}
                    />
                  </Popconfirm>
                </Can>
              ) : null}
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                style={{ color: 'var(--color-text-soft)' }}
                onClick={() => handleEditStart(row)}
              />
            </Space>
          );
        },
      },
    ],
    [
      particleColumns,
      semesterColumns,
      editingRowId,
      editingValues,
      handleFieldChange,
      handleEditStart,
      handleSave,
      handleEditCancel,
      updateMutation.isPending,
      electiveBlockInfo,
      handleRemoveElectiveRow,
      removeElectiveMutation.isPending,
      removeElectiveMutation.variables,
      message,
      t,
    ],
  );

  if (isLoading) {
    return <Skeleton active paragraph={{ rows: 10 }} />;
  }

  if (isError || !data) {
    return (
      <Empty
        description={t('studyLoad.studyPlan.planTab.loadError')}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  if (data.blocks.length === 0) {
    return (
      <Empty
        description={t('studyLoad.studyPlan.planTab.noSciences')}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <>
      <Table<PlanRow>
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
        rowClassName={(row) =>
          row.rowType === 'block' ? 'sp-plan-row-block' : ''
        }
      />
      <style>{`
        .sp-plan-row-block td {
          background: var(--color-bg-table-head, #EEF2F6) !important;
          font-weight: 600;
        }
      `}</style>

      <Modal
        open={!!linkRow}
        title={t('studyLoad.studyPlan.planTab.linkModalTitle')}
        okText={t('studyLoad.studyPlan.planTab.linkModalOk')}
        cancelText={t('studyLoad.common.cancel')}
        confirmLoading={linkMutation.isPending}
        okButtonProps={{ disabled: !linkScienceId }}
        onCancel={() => setLinkRow(null)}
        onOk={async () => {
          if (!linkRow?.blockCode || !linkRow?.code || !linkScienceId) return;
          try {
            await linkMutation.mutateAsync({
              blockCode: linkRow.blockCode,
              scienceCode: linkRow.code,
              scienceId: linkScienceId,
            });
            message.success(t('studyLoad.studyPlan.planTab.linkSuccess'));
            setLinkRow(null);
          } catch {
            message.error(t('studyLoad.studyPlan.planTab.linkError'));
          }
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary">{t('studyLoad.studyPlan.planTab.linkModalScienceLabel')}</Text>
          <Text strong>
            {linkRow?.title}
            {linkRow?.code ? ` (${linkRow.code})` : ''}
          </Text>
        </div>
        <Select
          showSearch
          style={{ width: '100%' }}
          placeholder={t('studyLoad.studyPlan.electiveRow.sciencePlaceholder')}
          loading={sciencesQuery.isLoading}
          value={linkScienceId}
          onChange={(v) => setLinkScienceId(v)}
          optionFilterProp="label"
          options={(sciencesQuery.data ?? []).map((s) => ({
            value: s.id,
            label: s.code ? `${s.code} — ${s.title}` : s.title,
          }))}
          notFoundContent={
            sciencesQuery.isLoading
              ? t('studyLoad.studyPlan.electiveRow.loadingOption')
              : t('studyLoad.studyPlan.electiveRow.emptyCatalog')
          }
        />
      </Modal>

      <ElectiveRowModal
        open={!!electiveModalBlock}
        block={electiveModalBlock}
        planId={planId}
        onClose={() => setElectiveModalBlock(null)}
      />
    </>
  );
};

export default StudyPlanPlanTab;
