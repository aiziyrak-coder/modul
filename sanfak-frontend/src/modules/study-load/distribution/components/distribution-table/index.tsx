import { useEffect, useMemo, useState } from 'react';
import { Alert, App, Badge, Button, Form, Input, Modal, Select, Space, Tag, Tooltip, Typography } from 'antd';
import {
  DeleteOutlined,
  DownOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  RightOutlined,
  UserDeleteOutlined,
  UserOutlined,
  UserSwitchOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Can, usePermission } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import { ExpandableTable, useModalStore } from '@/shared/ui';
import type { ExpandedState } from '@tanstack/react-table';
import type { DistributionTeacher, WorkloadBlockOption } from '../../model/types';
import { getStatusMeta } from '../../../model/status-workflow';
import {
  useRemoveTeacher,
  useRemoveBlock,
  useUpdateBlockHours,
  useFillVacancy,
  useTeachersForSelect,
  useWorkloadBlocksForSelect,
  getApiErrorMessage,
} from '../../api/distribution-api';
import type { AssignedBlockInfo } from '../../lib/assigned-blocks';
import AssignForm from '../assign-drawer';
import TeacherStatusBadge from '../teacher-status-badge';
import ElectiveChoiceAction from '../elective-choice-action';
import VacateModal from '../vacate-modal';
import { buildColumns } from './columns';
import { buildDistributionRows, type DistRow } from './rows';
import { loadState } from './load-state';
import { ParentBar, WarnBadge } from './styles';
import {
  ASSIGNMENT_BASES,
  ASSIGNMENT_BASIS_LABEL_KEYS,
  buildJustificationPayload,
  justificationNoteMinLength,
  parseSuitabilityBasisError,
  requiresJustificationForEntry,
  type AssignmentBasis,
} from '../../lib/suitability';

const { Text } = Typography;

const EMPTY_WORKLOAD_BLOCKS: WorkloadBlockOption[] = [];

interface IProps {
  teachers: DistributionTeacher[];
  distributionId: string;
  workloadId?: string | null;
  distributionStatus?: string;
  assignedBlocks?: Map<string, AssignedBlockInfo>;
  focusTeacherId?: string | null;
}

const DistributionTable = ({
  teachers,
  distributionId,
  workloadId,
  distributionStatus,
  assignedBlocks,
  focusTeacherId,
}: IProps) => {
  const { t } = useTranslation();
  const can = usePermission();
  const { message, modal } = App.useApp();
  const showModal = useModalStore((s) => s.showModal);
  const hideModal = useModalStore((s) => s.hideModal);

  const removeTeacher = useRemoveTeacher(distributionId);
  const removeBlock = useRemoveBlock(distributionId);
  const updateBlockHours = useUpdateBlockHours(distributionId);
  const fillVacancy = useFillVacancy(distributionId);
  const canAct = can('workloadDistribution:update') || can('workloadDistribution:delete');
  const { data: teacherOptions = [] } = useTeachersForSelect({ enabled: canAct });
  const { data: workloadBlockOptions = EMPTY_WORKLOAD_BLOCKS } =
    useWorkloadBlocksForSelect(workloadId, { enabled: canAct });
  const scienceDeptByWorkloadBlockId = useMemo(
    () => new Map(workloadBlockOptions.map((b) => [b.id, b.scienceDepartmentId])),
    [workloadBlockOptions],
  );

  const [expanded, setExpanded] = useState<ExpandedState>({});

  const expandTeacher = (teacherEntryId: string) => {
    const idx = teachers.findIndex((x) => x.id === teacherEntryId);
    if (idx < 0) return;
    setExpanded((prev) => ({ ...(typeof prev === 'object' ? prev : {}), [idx]: true }));
  };

  useEffect(() => {
    if (focusTeacherId) expandTeacher(focusTeacherId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTeacherId, teachers]);

  const [fillFor, setFillFor] = useState<DistributionTeacher | null>(null);
  const [selectedFillTeacher, setSelectedFillTeacher] = useState<string>('');
  const [fillBasis, setFillBasis] = useState<AssignmentBasis | ''>('');
  const [fillNote, setFillNote] = useState('');
  const [fillJustificationTouched, setFillJustificationTouched] = useState(false);

  const resetFillModal = () => {
    setFillFor(null);
    setSelectedFillTeacher('');
    setFillBasis('');
    setFillNote('');
    setFillJustificationTouched(false);
  };

  const selectedFillTeacherOption = teacherOptions.find((o) => o.id === selectedFillTeacher);
  const fillRequiresJustification = fillFor
    ? requiresJustificationForEntry(
        fillFor.blocks,
        selectedFillTeacherOption?.departmentId ?? null,
        scienceDeptByWorkloadBlockId,
      )
    : false;
  const fillNoteMinLength = justificationNoteMinLength(fillBasis || null);
  const fillNoteValid = fillNote.trim().length >= fillNoteMinLength;
  const fillJustificationValid = Boolean(fillBasis) && fillNoteValid;

  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [draftHour, setDraftHour] = useState<number | null>(null);
  const [savingHour, setSavingHour] = useState(false);

  const isEditableStatus = distributionStatus === 'draft' || distributionStatus === 'new';

  const statusMeta = getStatusMeta(distributionStatus ?? '');
  const lockReason = isEditableStatus
    ? undefined
    : t('studyLoad.distribution.table.lockReason', {
        status: t(statusMeta.labelKey, { defaultValue: statusMeta.label }),
      });

  const cancelEdit = () => {
    setEditingBlockId(null);
    setDraftHour(null);
  };

  const handleSaveHours = async (teacherEntryId: string, blockId: string, totalHour: number) => {
    const res = await updateBlockHours.mutateAsync({ teacherEntryId, blockId, totalHour });
    const residue = (res as { residueHour?: number } | undefined)?.residueHour;
    message.success(
      residue !== undefined
        ? t('studyLoad.distribution.table.hoursUpdatedWithResidue', { residue })
        : t('studyLoad.distribution.table.hoursUpdated'),
    );
    return res;
  };

  const commitEdit = (row: DistRow) => {
    if (draftHour === null || !row.blockId || !row.teacherEntryId) return cancelEdit();
    setSavingHour(true);
    void handleSaveHours(row.teacherEntryId, row.blockId, draftHour)
      .then(cancelEdit)
      .catch((err: unknown) => message.error(getApiErrorMessage(err)))
      .finally(() => setSavingHour(false));
  };

  const handleRemoveBlock = (
    teacherEntryId: string,
    blockId: string,
    scienceName: string | null,
  ) => {
    modal.confirm({
      title: t('studyLoad.distribution.table.removeBlockTitle'),
      content: t('studyLoad.distribution.table.removeBlockContent', {
        name: scienceName ?? t('studyLoad.distribution.table.subjectFallback'),
      }),
      okText: t('studyLoad.common.delete'),
      okType: 'danger',
      cancelText: t('studyLoad.common.cancel'),
      onOk: async () => {
        try {
          await removeBlock.mutateAsync({ teacherEntryId, blockId });
          message.success(t('studyLoad.distribution.table.blockRemoved'));
        } catch (err) {
          message.error(getApiErrorMessage(err));
        }
      },
    });
  };

  const teacherLabel = (teacher: DistributionTeacher) =>
    teacher.isVacant
      ? teacher.vacantLabel ?? t('studyLoad.distribution.assign.vacantDefaultLabel')
      : t('studyLoad.distribution.table.teacherStavkaLabel', {
          name: teacher.fullName,
          stavka: teacher.stavka,
        });

  const handleRemoveTeacher = (teacher: DistributionTeacher) => {
    modal.confirm({
      title: t('studyLoad.distribution.table.removeTeacherTitle'),
      content: t('studyLoad.distribution.table.removeTeacherContent', {
        label: teacherLabel(teacher),
      }),
      okText: t('studyLoad.common.delete'),
      okType: 'danger',
      cancelText: t('studyLoad.common.cancel'),
      onOk: async () => {
        try {
          await removeTeacher.mutateAsync(teacher.id);
          message.success(t('studyLoad.distribution.table.teacherRemoved'));
        } catch (err) {
          message.error(getApiErrorMessage(err));
        }
      },
    });
  };

  const handleVacate = (teacher: DistributionTeacher) => {
    showModal({
      title: t('studyLoad.distribution.table.vacateTitle', { name: teacher.fullName }),
      body: () => <VacateModal distributionId={distributionId} teacherEntryId={teacher.id} />,
      maxWidth: '520px',
    });
  };

  const handleFillVacancy = async () => {
    if (!fillFor) return;
    if (!selectedFillTeacher) {
      message.warning(t('studyLoad.distribution.assign.teacherPlaceholder'));
      return;
    }
    if (fillRequiresJustification && !fillJustificationValid) {
      setFillJustificationTouched(true);
      return;
    }
    try {
      await fillVacancy.mutateAsync({
        teacherEntryId: fillFor.id,
        payload: {
          teacher: selectedFillTeacher,
          ...buildJustificationPayload(fillRequiresJustification ? fillBasis : '', fillNote),
        },
      });
      message.success(t('studyLoad.distribution.table.vacancyFilled'));
      resetFillModal();
    } catch (err) {
      if (parseSuitabilityBasisError(err)) {
        setFillJustificationTouched(true);
        message.error(t('studyLoad.distribution.suitability.basisRequiredError'), 8);
      } else {
        message.error(getApiErrorMessage(err));
      }
    }
  };

  const handleAddForTeacher = (teacher: DistributionTeacher) => {
    showModal({
      title: t('studyLoad.distribution.table.addForTeacherTitle', { name: teacher.fullName }),
      body: () => (
        <AssignForm
          distributionId={distributionId}
          workloadId={workloadId}
          presetTeacherId={teacher.userId ?? undefined}
          presetTeacherName={teacher.fullName}
          assignedBlocks={assignedBlocks}
          onViewAssignment={(tid) => {
            hideModal();
            expandTeacher(tid);
          }}
        />
      ),
      right: true,
      maxWidth: '756px',
      bodyPadding: '0',
      overflow: true,
    });
  };

  const rows = useMemo(() => buildDistributionRows(teachers), [teachers]);

  const columns = useMemo(
    () =>
      buildColumns({
        t,
        canAct,
        onRemoveBlock: handleRemoveBlock,
        onSaveHours: handleSaveHours,
        renderElectiveAction: (row) =>
          row.blockId ? (
            <ElectiveChoiceAction
              distributionId={distributionId}
              blockId={row.blockId}
              currentScienceId={row.blockScienceId}
              lockReason={lockReason}
            />
          ) : null,
        editLockReason: lockReason,
        editingBlockId,
        draftHour,
        savingHour,
        startEdit: (blockId, current) => {
          setEditingBlockId(blockId);
          setDraftHour(typeof current === 'number' ? current : Number(current) || 0);
        },
        cancelEdit,
        commitEdit,
        setDraftHour,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [can, distributionId, lockReason, editingBlockId, draftHour, savingHour, t],
  );

  const auditoriumStatLabel = t('studyLoad.distribution.teacherRow.auditoriumHour');
  const overWarnLabel = t('studyLoad.distribution.loadWarning.over');
  const underWarnLabel = (name: string) =>
    t('studyLoad.distribution.loadWarning.under', { name });
  const crossDepartmentBadgeLabel = t('studyLoad.distribution.suitability.crossDepartmentBadge');
  const normBasisLabel = (value: number, limit: number | null) =>
    t('studyLoad.distribution.loadWarning.basis', { value, limit: limit ?? '—' });
  const closeAriaLabel = t('studyLoad.distribution.table.closeRow');
  const openAriaLabel = t('studyLoad.distribution.table.openRow');
  const vacantTagLabel = t('studyLoad.distribution.assign.vacantDefaultLabel');
  const sciencesStatLabel = t('studyLoad.distribution.table.sciencesStatLabel');
  const totalHourStatLabel = t('studyLoad.distribution.table.totalHourStatLabel');
  const addButtonLabel = t('studyLoad.common.add');
  const addHoursLabel = t('studyLoad.distribution.loadWarning.addHours');
  const fillButtonLabel = t('studyLoad.distribution.table.fillButton');
  const vacateTooltipFallback = t('studyLoad.distribution.vacateModal.confirm');
  const removeTeacherTooltipFallback = t('studyLoad.distribution.table.removeTeacherTitle');

  const auditoriumStatValue = (teacher: DistributionTeacher): string => {
    if (teacher.auditoriumHour === null) return '—';
    if (teacher.isVacant || teacher.minHour === null) return String(teacher.auditoriumHour);
    return `${teacher.auditoriumHour} / ${teacher.minHour}`;
  };

  return (
    <>
      <ExpandableTable<DistRow>
        data={rows}
        columns={columns}
        minWidth={1600}
        expanded={expanded}
        onExpandedChange={setExpanded}
        parentRowTone={(row) => {
          const t = row.original.teacher;
          return t && loadState(t) !== 'ok' ? 'warning' : 'default';
        }}
        renderParentRow={(row) => {
          const t = row.original.teacher;
          if (!t) return null;
          const state = loadState(t);

          return (
            <ParentBar>
              <div className="left">
                <button
                  type="button"
                  className="toggle"
                  onClick={row.getToggleExpandedHandler()}
                  aria-label={row.getIsExpanded() ? closeAriaLabel : openAriaLabel}
                >
                  {row.getIsExpanded() ? <DownOutlined /> : <RightOutlined />}
                </button>

                <span className="who">
                  {t.isVacant ? (
                    <Badge status="warning" />
                  ) : (
                    <UserOutlined style={{ color: 'var(--brand-primary)' }} />
                  )}
                  <Text strong style={{ color: t.isVacant ? 'var(--color-text-soft)' : undefined }}>
                    {teacherLabel(t)}
                  </Text>
                  {t.isVacant ? <Tag color="orange">{vacantTagLabel}</Tag> : null}
                </span>

                <span className="stat">
                  <span className="label">{sciencesStatLabel}</span>
                  <span className="value">{t.blocks.length}</span>
                </span>
                <span className="stat">
                  <span className="label">{totalHourStatLabel}</span>
                  <span className="value">{t.totalHour}</span>
                </span>
                <span className="stat">
                  <span className="label">{auditoriumStatLabel}:</span>
                  <span className="value">{auditoriumStatValue(t)}</span>
                </span>
              </div>

              <div className="right">
                {state === 'under' && t.auditoriumHour !== null ? (
                  <WarnBadge>
                    <WarningOutlined />
                    <span>{underWarnLabel(t.fullName)}</span>
                    <b>{normBasisLabel(t.auditoriumHour, t.minHour)}</b>
                    <Can perform="workloadDistribution:update">
                      <Tooltip title={lockReason}>
                        <span>
                          <Button
                            type="link"
                            size="small"
                            icon={<PlusOutlined />}
                            disabled={!isEditableStatus}
                            onClick={() => handleAddForTeacher(t)}
                            data-testid={`add-hours-${t.id}`}
                          >
                            {addHoursLabel}
                          </Button>
                        </span>
                      </Tooltip>
                    </Can>
                  </WarnBadge>
                ) : null}
                {state === 'over' && t.auditoriumHour !== null ? (
                  <WarnBadge $tone="over">
                    <WarningOutlined />
                    <span>{overWarnLabel}</span>
                    <b>{normBasisLabel(t.auditoriumHour, t.maxHour)}</b>
                  </WarnBadge>
                ) : null}
                {t.blocks.some((b) => b.suitability === 'crossDepartment') ? (
                  <WarnBadge $tone="info">
                    <InfoCircleOutlined />
                    <span>{crossDepartmentBadgeLabel}</span>
                  </WarnBadge>
                ) : null}

                <TeacherStatusBadge
                  status={t.acceptanceStatus}
                  rejectionReason={t.rejectionReason}
                  respondedAt={t.respondedAt}
                  isVacant={t.isVacant}
                />

                <Space size={8}>
                  {!t.isVacant ? (
                    <Can perform="workloadDistribution:update">
                      <Tooltip title={lockReason}>
                        <span>
                          <Button
                            size="small"
                            icon={<PlusOutlined />}
                            disabled={!isEditableStatus}
                            onClick={() => handleAddForTeacher(t)}
                          >
                            {addButtonLabel}
                          </Button>
                        </span>
                      </Tooltip>
                    </Can>
                  ) : null}

                  {t.isVacant ? (
                    <Can perform="workloadDistribution:update">
                      <Tooltip title={lockReason}>
                        <span>
                          <Button
                            size="small"
                            type="primary"
                            icon={<UserSwitchOutlined />}
                            disabled={!isEditableStatus}
                            onClick={() => setFillFor(t)}
                          >
                            {fillButtonLabel}
                          </Button>
                        </span>
                      </Tooltip>
                    </Can>
                  ) : (
                    <Can perform="workloadDistribution:update">
                      <Tooltip title={lockReason ?? vacateTooltipFallback}>
                        <span>
                          <Button
                            size="small"
                            icon={<UserDeleteOutlined />}
                            disabled={!isEditableStatus}
                            onClick={() => handleVacate(t)}
                          />
                        </span>
                      </Tooltip>
                    </Can>
                  )}

                  <Can perform="workloadDistribution:delete">
                    <Tooltip title={lockReason ?? removeTeacherTooltipFallback}>
                      <span>
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          disabled={!isEditableStatus}
                          onClick={() => handleRemoveTeacher(t)}
                          loading={removeTeacher.isPending}
                        />
                      </span>
                    </Tooltip>
                  </Can>
                </Space>
              </div>
            </ParentBar>
          );
        }}
      />

      <Modal
        title={t('studyLoad.distribution.table.fillModalTitle')}
        open={fillFor !== null}
        onOk={() => void handleFillVacancy()}
        onCancel={resetFillModal}
        okText={t('studyLoad.distribution.assign')}
        cancelText={t('studyLoad.common.cancel')}
        confirmLoading={fillVacancy.isPending}
        okButtonProps={{ disabled: fillRequiresJustification && !fillJustificationValid }}
      >
        <Select
          showSearch
          style={{ width: '100%' }}
          placeholder={t('studyLoad.distribution.assign.teacherPlaceholder')}
          value={selectedFillTeacher || undefined}
          onChange={(v) => {
            setSelectedFillTeacher(v);
            setFillBasis('');
            setFillNote('');
            setFillJustificationTouched(false);
          }}
          options={teacherOptions.map((o) => ({ value: o.id, label: o.fullName }))}
          filterOption={(input, opt) =>
            String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
        />

        {fillRequiresJustification ? (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <Alert
              type="info"
              showIcon
              message={t('studyLoad.distribution.suitability.crossDepartmentTitle')}
              description={t('studyLoad.distribution.suitability.crossDepartmentDescription')}
              style={{ marginBottom: 'var(--space-3)' }}
            />
            <Form.Item
              label={t('studyLoad.distribution.suitability.basisLabel')}
              required
              validateStatus={fillJustificationTouched && !fillBasis ? 'error' : ''}
              help={
                fillJustificationTouched && !fillBasis
                  ? t('studyLoad.distribution.suitability.basisRequiredHint')
                  : undefined
              }
            >
              <Select
                placeholder={t('studyLoad.distribution.suitability.basisPlaceholder')}
                options={ASSIGNMENT_BASES.map((b) => ({
                  value: b,
                  label: t(ASSIGNMENT_BASIS_LABEL_KEYS[b]),
                }))}
                value={fillBasis || null}
                onChange={(v) => {
                  setFillBasis((v ?? '') as AssignmentBasis | '');
                  setFillJustificationTouched(true);
                }}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item
              label={t('studyLoad.distribution.suitability.noteLabel')}
              required
              validateStatus={fillJustificationTouched && !fillNoteValid ? 'error' : ''}
              help={
                fillJustificationTouched && !fillNoteValid
                  ? t('studyLoad.distribution.suitability.noteMinLengthHint', {
                      count: fillNoteMinLength,
                    })
                  : undefined
              }
            >
              <Input.TextArea
                rows={3}
                placeholder={t('studyLoad.distribution.suitability.notePlaceholder')}
                value={fillNote}
                onChange={(e) => setFillNote(e.target.value)}
                onBlur={() => setFillJustificationTouched(true)}
                style={{ resize: 'none' }}
              />
            </Form.Item>
          </div>
        ) : null}
      </Modal>
    </>
  );
};

export default DistributionTable;
