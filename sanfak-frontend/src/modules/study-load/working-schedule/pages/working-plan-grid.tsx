import { useCallback, useMemo, useState } from 'react';
import { App, Button, Empty, InputNumber, Select, Space, Table, Tooltip, Typography } from 'antd';
import { Can } from '@/app/session';
import {
  AppstoreAddOutlined,
  CheckOutlined,
  CloseOutlined,
  CopyOutlined,
  EditOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import type {
  SemesterData,
  ParticleLabel,
  ParticleItem,
  ElectiveAlternative,
} from '../../working-plan/model/types';
import {
  useUpdateWorkingPlanScience,
  type UpdateWorkingPlanSciencePayload,
} from '../../working-plan/api/working-plan-api';
import { isElectiveBlock } from '../../working-plan/lib/elective-block';
import { useAssessmentTypesRef } from '../api/references-api';
import ElectiveSwapModal from '../../working-plan/components/elective-swap-modal';
import ElectiveAlternativesModal from '../../working-plan/components/elective-alternatives-modal';
import ScienceTitleCell, {
  ALT_LINE,
  visibleAlternatives,
} from '../../working-plan/components/science-title-cell';

const { Title, Text } = Typography;

const SWAP_PERMISSIONS = ['workingPlan:update', 'studyPlan:update'];

const ALTERNATIVES_PERMISSIONS = ['workingPlan:update', 'studyPlan:update'];

interface ScienceRowOrigin {
  parentId: string;
  scienceId: string;
  serialNumber: string | null;
  code: string | null;
  title: string | null;
  totalCredit: number;
  evaluationType: string | null;
  particleMap: Record<string, { _id: string; value: number }>;
  elective: boolean;
  scienceRef: string | null;
  isSlot: boolean;
  alternatives: ElectiveAlternative[];
}

interface PlanRow {
  key: string;
  rowType: 'science' | 'total' | 'practice' | 'grandTotal';
  origin?: ScienceRowOrigin;
  code?: string | null;
  title?: string | null;
  particles?: Record<string, number>;
}

type EditValues = Record<string, number>;

function buildParticleMap(
  particles: ParticleItem[],
): Record<string, { _id: string; value: number }> {
  const map: Record<string, { _id: string; value: number }> = {};
  for (const p of particles) {
    map[p.slug] = { _id: p.id, value: p.value };
  }
  return map;
}

function summaryParticleMap(particles: ParticleItem[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const p of particles) {
    map[p.slug] = p.value;
  }
  return map;
}

function buildRows(
  sem: SemesterData,
  semKey: string,
  t: (key: string) => string,
  yearTotals: Record<string, number> | null,
): PlanRow[] {
  const rows: PlanRow[] = [];

  for (const block of sem.blocks) {
    rows.push({
      key: `block-${semKey}-${block.id}`,
      rowType: 'total',
      code: block.title ?? block.blockCode,
      title: null,
      particles: {},
    });

    const elective = isElectiveBlock(block);

    for (const sci of block.sciences) {
      if (sci.rowType !== 'subject' && sci.rowType !== 'electiveSlot') continue;
      const isSlot = sci.rowType === 'electiveSlot';

      rows.push({
        key: `sci-${semKey}-${sci.id}`,
        rowType: 'science',
        code: sci.code,
        title: sci.title,
        origin: {
          parentId: block.id,
          scienceId: sci.id,
          serialNumber: sci.serialNumber,
          code: sci.code,
          title: sci.title,
          totalCredit: sci.totalCredit,
          evaluationType: sci.evaluationType,
          particleMap: buildParticleMap(sci.particle),
          elective: elective || isSlot,
          scienceRef: sci.scienceRef,
          isSlot,
          alternatives: sci.alternatives,
        },
        particles: summaryParticleMap(sci.particle),
      });
    }
  }

  if (sem.blocksTotal) {
    rows.push({
      key: `blocksTotal-${semKey}`,
      rowType: 'total',
      code: sem.blocksTotal.title ?? t('studyLoad.workingPlan.total'),
      particles: summaryParticleMap(sem.blocksTotal.particles),
    });
  }

  if (sem.practice) {
    rows.push({
      key: `practice-${semKey}`,
      rowType: 'practice',
      code: sem.practice.title ?? t('studyLoad.workingPlan.practice'),
      particles: {},
    });
  }

  if (sem.grandTotal) {
    rows.push({
      key: `grandTotal-${semKey}`,
      rowType: 'grandTotal',
      code: t('studyLoad.workingPlan.grandTotal'),
      particles: summaryParticleMap(sem.grandTotal.particles),
    });
  }

  if (yearTotals) {
    rows.push({
      key: 'yearTotal',
      rowType: 'grandTotal',
      code: t('studyLoad.workingPlan.yearTotal'),
      particles: yearTotals,
    });
  }

  return rows;
}

interface PlanGridProps {
  semesters: Record<string, SemesterData>;
  particleLabels: ParticleLabel[];
  workingPlanId: string | undefined;
  workingScheduleId: string | undefined;
  editable: boolean;
  semesterNumbers?: Record<string, string>;
}

const PlanGrid = ({
  semesters,
  particleLabels,
  workingPlanId,
  workingScheduleId,
  editable,
  semesterNumbers,
}: PlanGridProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const showModal = useModalStore((s) => s.showModal);

  const updateMutation = useUpdateWorkingPlanScience(workingScheduleId);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<EditValues>({});
  const [editEvaluationType, setEditEvaluationType] = useState<string | null | undefined>(
    undefined,
  );

  const { data: assessmentTypes = [] } = useAssessmentTypesRef();

  const semKeys = useMemo(
    () => Object.keys(semesters).sort((a, b) => Number(a) - Number(b)),
    [semesters],
  );

  const yearTotals = useMemo(() => {
    if (semKeys.length < 2) return null;
    const sums: Record<string, number> = {};
    for (const key of semKeys) {
      for (const p of semesters[key]?.grandTotal?.particles ?? []) {
        sums[p.slug] = (sums[p.slug] ?? 0) + p.value;
      }
    }
    return sums;
  }, [semKeys, semesters]);

  const assessmentOptions = useMemo(
    () => assessmentTypes.map((o) => ({ value: o.id, label: o.title })),
    [assessmentTypes],
  );

  const assessmentIdByTitle = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of assessmentTypes) map.set(o.title, o.id);
    return map;
  }, [assessmentTypes]);

  const handleStartEdit = useCallback((row: PlanRow) => {
    if (!row.origin) return;
    const initial: EditValues = {};
    for (const [slug, item] of Object.entries(row.origin.particleMap)) {
      initial[slug] = item.value;
    }
    setEditingKey(row.key);
    setEditValues(initial);
    setEditEvaluationType(undefined);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingKey(null);
    setEditValues({});
    setEditEvaluationType(undefined);
  }, []);

  const handleOpenSwap = useCallback(
    (row: PlanRow, semKey: string) => {
      const { origin } = row;
      if (!origin || !workingPlanId) {
        void message.error(t('studyLoad.workingPlan.missingOriginError'));
        return;
      }
      const fill = Boolean(origin.isSlot);
      const ModalBody = () => (
        <ElectiveSwapModal
          planDocId={workingPlanId}
          semKey={semKey}
          blockId={origin.parentId}
          scienceRowId={origin.scienceId}
          workingScheduleId={workingScheduleId}
          currentScienceId={origin.scienceRef}
          currentCode={origin.code}
          currentTitle={origin.title}
          fill={fill}
        />
      );
      showModal({
        title: fill
          ? t('studyLoad.workingPlan.electiveSlot.choose')
          : t('studyLoad.workingPlan.electiveSwap.title'),
        body: ModalBody,
        maxWidth: '560px',
      });
    },
    [showModal, workingPlanId, workingScheduleId, message, t],
  );

  const handleOpenAlternatives = useCallback(
    (row: PlanRow, semKey: string) => {
      const { origin } = row;
      if (!origin || !workingPlanId) {
        void message.error(t('studyLoad.workingPlan.missingOriginError'));
        return;
      }
      const ModalBody = () => (
        <ElectiveAlternativesModal
          planDocId={workingPlanId}
          semKey={semKey}
          blockId={origin.parentId}
          scienceRowId={origin.scienceId}
          workingScheduleId={workingScheduleId}
          mainScienceId={origin.scienceRef}
          mainCode={origin.code}
          mainTitle={origin.title}
          initialAlternatives={origin.alternatives}
        />
      );
      showModal({
        title: t('studyLoad.workingPlan.electiveAlternatives.title'),
        body: ModalBody,
        maxWidth: '560px',
      });
    },
    [showModal, workingPlanId, workingScheduleId, message, t],
  );

  const handleSaveEdit = useCallback(
    async (row: PlanRow, semKey: string) => {
      if (!row.origin || !workingPlanId) {
        void message.error(t('studyLoad.workingPlan.missingOriginError'));
        return;
      }
      const { origin } = row;

      const particle: UpdateWorkingPlanSciencePayload['particle'] =
        Object.entries(origin.particleMap).map(([slug, item]) => ({
          _id: item._id,
          [slug]: editValues[slug] ?? item.value,
        }));

      try {
        const res = await updateMutation.mutateAsync({
          planDocId: workingPlanId,
          semKey,
          parentId: origin.parentId,
          _id: origin.scienceId,
          particle,
          title: origin.title,
          code: origin.code,
          serialNumber: origin.serialNumber,
          totalCredit: origin.totalCredit,
          evaluationType: editEvaluationType,
        });
        if (res?.evaluationTypeWriteThrough?.persisted === false) {
          void message.warning(t('studyLoad.workingPlan.evaluationTypeWriteThroughWarning'));
        } else {
          void message.success(t('studyLoad.common.saved'));
        }
        setEditingKey(null);
        setEditValues({});
        setEditEvaluationType(undefined);
      } catch {
        void message.error(t('studyLoad.common.saveError'));
      }
    },
    [updateMutation, workingPlanId, editValues, editEvaluationType, message, t],
  );

  const buildColumns = useCallback(
    (semKey: string): ColumnsType<PlanRow> => [
      {
        title: t('studyLoad.workingPlan.column.code'),
        dataIndex: 'code',
        key: 'code',
        width: 177,
        render: (_: unknown, row: PlanRow) => {
          if (row.rowType === 'science') {
            const altCodes = visibleAlternatives(row.origin?.alternatives);
            return (
              <>
                <Space size={4}>
                  <Text style={{ fontSize: 13 }}>{row.code ?? '—'}</Text>
                  {row.code ? (
                    <Tooltip title={t('studyLoad.common.copy')}>
                      <Button
                        type="text"
                        size="small"
                        icon={<CopyOutlined style={{ fontSize: 11 }} />}
                        style={{ color: 'var(--color-text-soft)', padding: '0 2px' }}
                        onClick={() => {
                          void navigator.clipboard.writeText(row.code ?? '');
                          void message.success(t('studyLoad.workingPlan.codeCopied'));
                        }}
                      />
                    </Tooltip>
                  ) : null}
                </Space>

                {altCodes.length > 0 ? (
                  <div
                    style={{
                      marginTop: 'var(--space-1)',
                      paddingTop: 'var(--space-1)',
                      paddingInlineStart: 'var(--space-2)',
                      borderTop: '1px solid var(--color-border)',
                    }}
                  >
                    {altCodes.map((alt, i) => (
                      <div
                        key={alt.scienceId ?? `${alt.code ?? ''}-${i}`}
                        style={{ lineHeight: ALT_LINE.lineHeight }}
                      >
                        <Text style={{ fontSize: ALT_LINE.fontSize, color: ALT_LINE.color }}>
                          {`${ALT_LINE.marker}${alt.code ?? '—'}`}
                        </Text>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            );
          }
          return (
            <Text
              strong={row.rowType === 'total' || row.rowType === 'grandTotal'}
              style={{
                fontSize: 13,
                color:
                  row.rowType === 'grandTotal'
                    ? 'var(--color-text)'
                    : 'var(--color-text-soft)',
              }}
            >
              {row.code ?? ''}
            </Text>
          );
        },
      },
      {
        title: t('studyLoad.workingPlan.column.scienceName'),
        dataIndex: 'title',
        key: 'title',
        render: (_: unknown, row: PlanRow) => {
          if (row.rowType !== 'science') return null;
          if (row.origin?.isSlot) {
            return (
              <Text type="secondary" italic style={{ fontSize: 13 }}>
                {row.title ?? t('studyLoad.workingPlan.electiveSlot.notChosen')}
              </Text>
            );
          }
          return (
            <ScienceTitleCell
              title={row.title ?? null}
              alternatives={row.origin?.alternatives ?? []}
            />
          );
        },
      },
      ...particleLabels.map((pl) => ({
        title: pl.title ?? pl.slug,
        dataIndex: `p_${pl.slug}`,
        key: `p_${pl.slug}`,
        width: 77,
        align: 'center' as const,
        render: (_: unknown, row: PlanRow) => {
          if (row.rowType !== 'science') {
            const val = row.particles?.[pl.slug];
            return val !== undefined ? (
              <Text style={{ fontSize: 13 }}>{val}</Text>
            ) : null;
          }
          if (editingKey === row.key) {
            return (
              <InputNumber
                size="small"
                min={0}
                value={editValues[pl.slug] ?? 0}
                onChange={(val) =>
                  setEditValues((prev) => ({ ...prev, [pl.slug]: val ?? 0 }))
                }
                style={{ width: 65, fontSize: 13 }}
              />
            );
          }
          const val = row.particles?.[pl.slug];
          return val !== undefined ? (
            <Text style={{ fontSize: 13 }}>{val}</Text>
          ) : null;
        },
      })),
      {
        title: t('studyLoad.workingPlan.column.evaluationType'),
        dataIndex: 'evaluationType',
        key: 'evaluationType',
        width: 184,
        render: (_: unknown, row: PlanRow) => {
          if (row.rowType !== 'science') return null;

          if (editingKey === row.key) {
            const savedTitle = row.origin?.evaluationType;
            const selected =
              editEvaluationType !== undefined
                ? (editEvaluationType ?? undefined)
                : savedTitle
                  ? assessmentIdByTitle.get(savedTitle)
                  : undefined;
            return (
              <Select
                size="small"
                allowClear
                showSearch
                optionFilterProp="label"
                value={selected}
                onChange={(val: string | undefined) =>
                  setEditEvaluationType(val ?? null)
                }
                options={assessmentOptions}
                placeholder={t('studyLoad.workingPlan.evaluationTypePlaceholder')}
                aria-label={t('studyLoad.workingPlan.column.evaluationType')}
                style={{ width: '100%' }}
                notFoundContent={t('studyLoad.common.noData')}
              />
            );
          }

          const saved = row.origin?.evaluationType;
          return saved ? <Text style={{ fontSize: 13 }}>{saved}</Text> : null;
        },
      },
      {
        title: '',
        key: 'actions',
        width: 112,
        align: 'center' as const,
        render: (_: unknown, row: PlanRow) => {
          if (row.rowType !== 'science') return null;

          if (editingKey === row.key) {
            return (
              <Space size={2}>
                <Button
                  type="text"
                  size="small"
                  icon={<CheckOutlined />}
                  style={{ color: 'var(--brand-primary)' }}
                  loading={updateMutation.isPending}
                  onClick={() => handleSaveEdit(row, semKey)}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={handleCancelEdit}
                />
              </Space>
            );
          }

          if (!editable) return null;
          if (row.origin?.isSlot) {
            return (
              <Can perform={SWAP_PERMISSIONS} mode="all">
                <Tooltip title={t('studyLoad.workingPlan.electiveSlot.choose')}>
                  <Button
                    type="link"
                    size="small"
                    icon={<SwapOutlined />}
                    aria-label={t('studyLoad.workingPlan.electiveSlot.choose')}
                    onClick={() => handleOpenSwap(row, semKey)}
                  >
                    {t('studyLoad.workingPlan.electiveSlot.choose')}
                  </Button>
                </Tooltip>
              </Can>
            );
          }
          return (
            <Space size={2}>
              <Can perform="workingPlan:update">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  style={{ color: 'var(--color-text-soft)' }}
                  onClick={() => handleStartEdit(row)}
                />
              </Can>
              {row.origin?.elective ? (
                <Can perform={SWAP_PERMISSIONS} mode="all">
                  <Tooltip title={t('studyLoad.workingPlan.electiveSwap.action')}>
                    <Button
                      type="text"
                      size="small"
                      icon={<SwapOutlined />}
                      aria-label={t('studyLoad.workingPlan.electiveSwap.action')}
                      style={{ color: 'var(--color-text-soft)' }}
                      onClick={() => handleOpenSwap(row, semKey)}
                    />
                  </Tooltip>
                </Can>
              ) : null}
              {row.origin?.elective ? (
                <Can perform={ALTERNATIVES_PERMISSIONS} mode="all">
                  <Tooltip title={t('studyLoad.workingPlan.electiveAlternatives.action')}>
                    <Button
                      type="text"
                      size="small"
                      icon={<AppstoreAddOutlined />}
                      aria-label={t('studyLoad.workingPlan.electiveAlternatives.action')}
                      style={{ color: 'var(--color-text-soft)' }}
                      onClick={() => handleOpenAlternatives(row, semKey)}
                    />
                  </Tooltip>
                </Can>
              ) : null}
            </Space>
          );
        },
      },
    ],
    [
      editable,
      particleLabels,
      editingKey,
      editValues,
      editEvaluationType,
      assessmentOptions,
      assessmentIdByTitle,
      updateMutation.isPending,
      handleStartEdit,
      handleCancelEdit,
      handleSaveEdit,
      handleOpenSwap,
      handleOpenAlternatives,
      message,
      t,
    ],
  );

  if (semKeys.length === 0) {
    return (
      <Empty
        description={t('studyLoad.workingPlan.gridNotFound')}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {semKeys.map((semKey, semIndex) => {
        const sem = semesters[semKey];
        if (!sem) return null;
        const isLastSemester = semIndex === semKeys.length - 1;
        const rows = buildRows(sem, semKey, t, isLastSemester ? yearTotals : null);
        const columns = buildColumns(semKey);

        return (
          <div key={semKey}>
            <Title
              level={5}
              style={{ margin: '0 0 var(--space-3) 0', color: 'var(--color-text)' }}
            >
              {t('studyLoad.workingPlan.semesterLabel', {
                sem: semesterNumbers?.[semKey] ?? semKey,
              })}
            </Title>
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
              rowClassName={(row) => {
                if (row.rowType === 'grandTotal') return 'wp-row-grand-total';
                if (row.rowType === 'total') return 'wp-row-total';
                if (row.rowType === 'practice') return 'wp-row-practice';
                if (row.rowType === 'science' && (row.origin?.alternatives?.length ?? 0) > 0) {
                  return 'wp-row-has-alt';
                }
                return '';
              }}
            />
          </div>
        );
      })}

      <style>{`
        .wp-row-total td { background: var(--color-bg-table-head, #EEF2F6) !important; }
        .wp-row-practice td { background: var(--color-bg-layout, #F8FAFC) !important; }
        .wp-row-grand-total td { background: var(--color-bg-table-head, #EEF2F6) !important; font-weight: 600; }
        .wp-row-has-alt td { vertical-align: top; }
      `}</style>
    </div>
  );
};

export default PlanGrid;
