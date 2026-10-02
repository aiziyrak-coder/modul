import { useState, useEffect, useMemo } from 'react';
import type { TFunction } from 'i18next';
import {
  Alert,
  App,
  Button,
  Checkbox,
  Col,
  Divider,
  Form,
  Input,
  Row,
  Select,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useFormik } from 'formik';
import { useTranslation } from '@/shared/lib/i18n';
import {
  useAddTeacher,
  useAddBlock,
  useDistribution,
  useWorkloadBlocksForSelect,
  useTeachersForSelect,
  useGroupsForSelect,
  getApiErrorMessage,
} from '../../api/distribution-api';
import { DEFAULT_ALLOWED_STAKES } from '../../api/mapper';
import {
  ASSIGNMENT_BASES,
  ASSIGNMENT_BASIS_LABEL_KEYS,
  buildJustificationPayload,
  evaluateSuitability,
  parseSuitabilityBasisError,
  type AssignmentBasis,
} from '../../lib/suitability';
import { makeAssignSchema, withCurrentStavka, assignInitialValues } from './assign-schema';
import {
  classTypeSlugsPayload,
  plannedClassTypes,
  scalarOwnerSlug,
  withAutoStream,
} from '../../../lib/class-type-slugs';
import { isGroupTakenFor } from '../../lib/assigned-blocks';
import type { AssignFormValues } from './assign-schema';
import type {
  GroupOption,
  StreamInput,
  TeacherOption,
  WorkloadBlockOption,
} from '../../model/types';
import {
  buildBlockLabel,
  buildClassTypeItems,
  countEffectiveStreams,
  recalcClassTypeItems,
  recalcScalarItems,
  sumStudents,
  toCourseSemester,
} from './hours';
import type { ClassTypeItem } from './hours';
import type { AssignedBlockInfo } from '../../lib/assigned-blocks';
import ContingentPrefill from '../contingent-prefill';
import { ModalFooter, useModalStore } from '@/shared/ui';
import {
  FormWrapper,
  TeacherInfoBar,
  HoursListWrapper,
  HoursListHead,
  HoursListItem,
  HoursListFooter,
  StreamChip,
} from './style';

const { Text, Title } = Typography;

function formatStavkaLabel(t: TFunction, value: number): string {
  const formatted = Number.isInteger(value) ? value.toFixed(1) : String(value);
  return t('studyLoad.distribution.assign.stavkaOptionLabel', { value: formatted });
}

const EMPTY_TEACHERS: TeacherOption[] = [];
const EMPTY_BLOCKS: WorkloadBlockOption[] = [];
const EMPTY_GROUPS: GroupOption[] = [];

interface IProps {
  distributionId: string;
  workloadId: string | null | undefined;
  presetTeacherId?: string;
  presetTeacherName?: string;
  assignedBlocks?: Map<string, AssignedBlockInfo>;
  onViewAssignment?: (teacherEntryId: string) => void;
}

const AssignForm = ({
  distributionId,
  workloadId,
  presetTeacherId,
  presetTeacherName,
  assignedBlocks,
  onViewAssignment,
}: IProps) => {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const hideModal = useModalStore((s) => s.hideModal);

  const { data: teacherOptions = EMPTY_TEACHERS, isLoading: teachersLoading } =
    useTeachersForSelect();
  const { data: blockOptions = EMPTY_BLOCKS, isLoading: blocksLoading } =
    useWorkloadBlocksForSelect(workloadId);
  const { data: groupOptions = EMPTY_GROUPS, isLoading: groupsLoading } = useGroupsForSelect();

  const addTeacher = useAddTeacher(distributionId);
  const addBlock = useAddBlock(distributionId);

  const { data: distribution } = useDistribution(distributionId);
  const baseAllowedStakes = distribution?.allowedStakes ?? DEFAULT_ALLOWED_STAKES;
  const [currentStavka, setCurrentStavka] = useState<number>(assignInitialValues.stavka);
  const allowedStakes = useMemo(
    () => withCurrentStavka(baseAllowedStakes, currentStavka),
    [baseAllowedStakes, currentStavka],
  );
  const stavkaOptions = useMemo(
    () => allowedStakes.map((v) => ({ label: formatStavkaLabel(t, v), value: v })),
    [t, allowedStakes],
  );
  const semesterOptions = useMemo(
    () => [
      { label: t('studyLoad.distribution.assign.semesterOption1'), value: 1 },
      { label: t('studyLoad.distribution.assign.semesterOption2'), value: 2 },
    ],
    [t],
  );

  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(
    presetTeacherId ?? assignInitialValues.teacher,
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string>(
    assignInitialValues.workloadBlockId,
  );
  const requiresJustification =
    evaluateSuitability({
      teacherDepartmentId:
        teacherOptions.find((opt) => opt.id === selectedTeacherId)?.departmentId ?? null,
      scienceDepartmentId:
        blockOptions.find((b) => b.id === selectedBlockId)?.scienceDepartmentId ?? null,
    }) === 'crossDepartment';

  const plannedTypes = useMemo(() => {
    const block = blockOptions.find((b) => b.id === selectedBlockId);
    return block ? plannedClassTypes(t, block.classTypes) : [];
  }, [blockOptions, selectedBlockId, t]);
  const plannedSlugs = useMemo(() => plannedTypes.map((p) => p.slug), [plannedTypes]);

  const validationSchema = useMemo(
    () => makeAssignSchema(t, allowedStakes, requiresJustification, plannedSlugs.length),
    [t, allowedStakes, requiresJustification, plannedSlugs.length],
  );

  const [classTypes, setClassTypes] = useState<ClassTypeItem[]>([]);

  const formik = useFormik<AssignFormValues>({
    initialValues: presetTeacherId
      ? { ...assignInitialValues, teacher: presetTeacherId }
      : assignInitialValues,
    validationSchema,
    enableReinitialize: true,
    onSubmit: async (values, { resetForm, setFieldError, setFieldTouched }) => {
      try {
        const teacherPayload = values.isVacant
          ? {
              stavka: values.stavka,
              isVacant: true,
              vacantLabel: values.vacantLabel || 'Vakant',
            }
          : {
              teacher: values.teacher,
              stavka: values.stavka,
              isVacant: false,
            };

        const result = await addTeacher.mutateAsync(teacherPayload);
        const teacherEntryId = (result as { teacherEntryId?: string }).teacherEntryId;
        if (!teacherEntryId) throw new Error('teacherEntryId qaytmadi');

        const blockPayload = {
          workloadBlockId: values.workloadBlockId,
          semester: values.semester,
          groups: values.groups.length > 0 ? values.groups : undefined,
          streams: withAutoStream(
            classTypeSlugsPayload(values.classTypeSlugs, plannedSlugs) ?? [],
            values.groups,
            values.streams,
          ),
          classTypeSlugs: classTypeSlugsPayload(values.classTypeSlugs, plannedSlugs),
          ...buildJustificationPayload(
            requiresJustification ? values.suitabilityBasis : '',
            values.suitabilityNote,
          ),
        };
        await addBlock.mutateAsync({ teacherEntryId, payload: blockPayload });

        message.success(t('studyLoad.distribution.assign.success'));
        resetForm();
        setCurrentStavka(assignInitialValues.stavka);
        setSelectedTeacherId(presetTeacherId ?? assignInitialValues.teacher);
        setSelectedBlockId(assignInitialValues.workloadBlockId);
        setClassTypes([]);
        hideModal();
      } catch (err) {
        if (parseSuitabilityBasisError(err)) {
          void setFieldTouched('suitabilityBasis', true, false);
          setFieldError(
            'suitabilityBasis',
            t('studyLoad.distribution.suitability.basisRequiredError'),
          );
          message.error(t('studyLoad.distribution.suitability.basisRequiredError'), 8);
        } else {
          message.error(getApiErrorMessage(err));
        }
      }
    },
  });

  useEffect(() => {
    if (!formik.values.workloadBlockId) {
      setClassTypes((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const block = blockOptions.find((b) => b.id === formik.values.workloadBlockId);
    if (block) {
      void formik.setFieldValue('semester', toCourseSemester(block.semester));
      void formik.setFieldValue(
        'classTypeSlugs',
        plannedClassTypes(t, block.classTypes).map((p) => p.slug),
      );
      setClassTypes(buildClassTypeItems(t, block));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formik.values.workloadBlockId, blockOptions, t]);

  const currentBlock = blockOptions.find((b) => b.id === formik.values.workloadBlockId);

  useEffect(() => {
    const streamCount = countEffectiveStreams(formik.values.streams);
    const groupCount = formik.values.groups.length;
    if (streamCount === 0 && groupCount === 0) return;
    const studentCount = sumStudents(formik.values.groups, groupOptions);
    const isLastSemester = currentBlock?.isLastSemester ?? true;
    setClassTypes((prev) =>
      prev.length === 0
        ? prev
        : recalcScalarItems(recalcClassTypeItems(prev, streamCount, groupCount), studentCount, {
            isLastSemester,
          }),
    );
  }, [formik.values.streams, formik.values.groups, groupOptions, currentBlock]);

  const nonAuditHour =
    currentBlock && !assignedBlocks?.get(currentBlock.id) ? currentBlock.nonAuditHour : 0;
  const effectiveSelectedSlugs = useMemo(
    () => classTypeSlugsPayload(formik.values.classTypeSlugs, plannedSlugs) ?? [],
    [formik.values.classTypeSlugs, plannedSlugs],
  );
  const isSplit = effectiveSelectedSlugs.length > 0;
  const ownerSlug = scalarOwnerSlug(plannedSlugs);
  const visibleClassTypes = isSplit
    ? classTypes.filter((ct) =>
        ct.backendSlug == null
          ? ownerSlug !== null && effectiveSelectedSlugs.includes(ownerSlug)
          : effectiveSelectedSlugs.includes(ct.backendSlug),
      )
    : classTypes;
  const totalHour = visibleClassTypes.reduce((s, c) => s + (c.total || 0), 0) + nonAuditHour;

  const handleAddStream = () => {
    const current = formik.values.streams;
    void formik.setFieldValue('streams', [
      ...current,
      { number: current.length + 1, groups: [], language: null } as StreamInput,
    ]);
  };

  const handleRemoveStream = (idx: number) => {
    void formik.setFieldValue(
      'streams',
      formik.values.streams.filter((_, i) => i !== idx),
    );
  };

  const handleStreamGroupChange = (idx: number, groups: string[]) => {
    const updated = formik.values.streams.map((s, i) =>
      i === idx ? { ...s, groups } : s,
    );
    void formik.setFieldValue('streams', updated);
  };

  const selectedBlock = blockOptions.find((b) => b.id === formik.values.workloadBlockId);
  const selectedTeacher = teacherOptions.find((opt) => opt.id === formik.values.teacher);
  const assignedInfo = formik.values.workloadBlockId
    ? assignedBlocks?.get(formik.values.workloadBlockId)
    : undefined;
  const takenForSelectedCount = assignedInfo
    ? assignedInfo.takenGroupIds.filter((gid) =>
        isGroupTakenFor(assignedInfo, gid, effectiveSelectedSlugs),
      ).length
    : 0;

  const crossDepartmentTagLabel = t('studyLoad.distribution.suitability.crossDepartmentShort');
  const selectedSuitability = evaluateSuitability({
    teacherDepartmentId: selectedTeacher?.departmentId ?? null,
    scienceDepartmentId: selectedBlock?.scienceDepartmentId ?? null,
  });

  const filteredGroupOptions = useMemo(() => {
    if (!selectedBlock) return groupOptions;
    return groupOptions.filter((g) => {
      if (selectedBlock.directionId && g.directionId && g.directionId !== selectedBlock.directionId) {
        return false;
      }
      if (
        selectedBlock.academicYearId &&
        g.academicYearId &&
        g.academicYearId !== selectedBlock.academicYearId
      ) {
        return false;
      }
      if (selectedBlock.course > 0 && g.courseNumber && g.courseNumber !== selectedBlock.course) {
        return false;
      }
      if (isGroupTakenFor(assignedInfo, g.id, effectiveSelectedSlugs)) return false;
      return true;
    });
  }, [groupOptions, selectedBlock, assignedInfo, effectiveSelectedSlugs]);

  const allGroupsTaken =
    !!assignedInfo && filteredGroupOptions.length === 0 && assignedInfo.takenGroupIds.length > 0;

  const availableGroupIds = useMemo(
    () => filteredGroupOptions.map((g) => g.id),
    [filteredGroupOptions],
  );

  const isLoading = addTeacher.isPending || addBlock.isPending;
  const isBusy = teachersLoading || blocksLoading || groupsLoading;

  return (
    <FormWrapper>
      <form onSubmit={formik.handleSubmit} noValidate style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {isBusy ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
            <Spin />
          </div>
        ) : (
          <>
            <div className="form-body">
              <TeacherInfoBar>
                <Text strong style={{ color: 'var(--color-text)' }}>
                  {selectedTeacher?.fullName ??
                    (formik.values.isVacant
                      ? t('studyLoad.distribution.assign.vacantDefaultLabel')
                      : t('studyLoad.distribution.assign.teacherUnselected'))}
                </Text>
                <Title
                  level={4}
                  style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#f97316' }}
                >
                  {totalHour} {t('studyLoad.distribution.assign.hoursUnit')}
                </Title>
              </TeacherInfoBar>

              <Form.Item style={{ marginBottom: 'var(--space-3)' }}>
                <Checkbox
                  checked={formik.values.isVacant}
                  onChange={(e) => {
                    void formik.setFieldValue('isVacant', e.target.checked);
                    if (e.target.checked) {
                      void formik.setFieldValue('teacher', '');
                      setSelectedTeacherId('');
                    }
                  }}
                >
                  {t('studyLoad.distribution.assign.vacantCheckboxLabel')}
                </Checkbox>
              </Form.Item>

              <Row gutter={[12, 16]}>
                {!formik.values.isVacant ? (
                  <Col span={24}>
                    <Form.Item
                      label={t('studyLoad.distribution.assign.teacherLabel')}
                      validateStatus={formik.touched.teacher && formik.errors.teacher ? 'error' : ''}
                      help={formik.touched.teacher ? formik.errors.teacher : undefined}
                      required
                    >
                      <Select
                        showSearch
                        disabled={!!presetTeacherId}
                        placeholder={t('studyLoad.distribution.assign.teacherPlaceholder')}
                        optionFilterProp="searchText"
                        notFoundContent={
                          !teachersLoading && teacherOptions.length === 0 ? (
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              {t('studyLoad.distribution.assign.teacherListEmptyHint')}
                            </Typography.Text>
                          ) : undefined
                        }
                        options={
                          presetTeacherId && presetTeacherName
                            ? [
                                {
                                  label: presetTeacherName,
                                  value: presetTeacherId,
                                  searchText: presetTeacherName,
                                },
                              ]
                            :
                              teacherOptions.map((opt) => {
                                const suitability = evaluateSuitability({
                                  teacherDepartmentId: opt.departmentId,
                                  scienceDepartmentId: selectedBlock?.scienceDepartmentId ?? null,
                                });
                                return {
                                  value: opt.id,
                                  searchText: opt.fullName,
                                  label:
                                    suitability === 'crossDepartment' ? (
                                      <span
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 'var(--space-2)',
                                          justifyContent: 'space-between',
                                        }}
                                      >
                                        <span>{opt.fullName}</span>
                                        <Tag color="orange" style={{ marginInlineEnd: 0 }}>
                                          {crossDepartmentTagLabel}
                                        </Tag>
                                      </span>
                                    ) : (
                                      opt.fullName
                                    ),
                                };
                              })
                        }
                        value={formik.values.teacher || null}
                        onChange={(v) => {
                          void formik.setFieldValue('teacher', v ?? '');
                          setSelectedTeacherId(v ?? '');
                        }}
                        onBlur={() => void formik.setFieldTouched('teacher')}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>
                ) : (
                  <Col span={24}>
                    <Form.Item
                      label={t('studyLoad.distribution.assign.vacantTitleLabel')}
                      validateStatus={formik.touched.vacantLabel && formik.errors.vacantLabel ? 'error' : ''}
                      help={formik.touched.vacantLabel ? formik.errors.vacantLabel : undefined}
                    >
                      <Select
                        value={formik.values.vacantLabel || 'Vakant'}
                        options={[
                          { label: t('studyLoad.distribution.assign.vacantDefaultLabel'), value: 'Vakant' },
                          { label: t('studyLoad.distribution.assign.vacantOption'), value: "Bo'sh ish o'rni" },
                        ]}
                        onChange={(v) => void formik.setFieldValue('vacantLabel', v)}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>
                )}

                <Col span={12}>
                  <Form.Item
                    label={t('studyLoad.distribution.assign.stavkaFieldLabel')}
                    validateStatus={formik.touched.stavka && formik.errors.stavka ? 'error' : ''}
                    help={formik.touched.stavka ? formik.errors.stavka : undefined}
                    required
                  >
                    <Select
                      options={stavkaOptions}
                      value={formik.values.stavka}
                      onChange={(v) => {
                        void formik.setFieldValue('stavka', v);
                        setCurrentStavka(v);
                      }}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>

                <Col span={24}>
                  <Form.Item
                    label={t('studyLoad.distribution.assign.blockFieldLabel')}
                    validateStatus={formik.touched.workloadBlockId && formik.errors.workloadBlockId ? 'error' : ''}
                    help={formik.touched.workloadBlockId ? formik.errors.workloadBlockId : undefined}
                    required
                  >
                    <Select
                      showSearch
                      placeholder={t('studyLoad.distribution.assign.blockPlaceholder')}
                      optionFilterProp="searchText"
                      options={blockOptions.map((b) => {
                        const assigned = assignedBlocks?.get(b.id);
                        const blockLabel = buildBlockLabel(t, b);
                        return {
                          value: b.id,
                          searchText: blockLabel,
                          label: assigned ? (
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-2)',
                                justifyContent: 'space-between',
                              }}
                            >
                              <span>{blockLabel}</span>
                              <Tooltip
                                title={t('studyLoad.distribution.assign.blockAssignedTooltip', {
                                  names: assigned.teacherNames.join(', '),
                                })}
                              >
                                <Tag color="orange" style={{ marginInlineEnd: 0 }}>
                                  {t('studyLoad.distribution.assign.blockAssignedTag')}
                                </Tag>
                              </Tooltip>
                            </span>
                          ) : (
                            blockLabel
                          ),
                        };
                      })}
                      value={formik.values.workloadBlockId || null}
                      onChange={(v) => {
                        void formik.setFieldValue('workloadBlockId', v ?? '');
                        setSelectedBlockId(v ?? '');
                      }}
                      onBlur={() => void formik.setFieldTouched('workloadBlockId')}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>

                {plannedTypes.length > 1 ? (
                  <Col span={24}>
                    <Form.Item
                      label={t('studyLoad.distribution.assign.classTypesLabel')}
                      validateStatus={
                        formik.touched.classTypeSlugs && formik.errors.classTypeSlugs ? 'error' : ''
                      }
                      help={
                        formik.touched.classTypeSlugs && formik.errors.classTypeSlugs
                          ? String(formik.errors.classTypeSlugs)
                          : t('studyLoad.distribution.assign.classTypesHint')
                      }
                    >
                      <Checkbox.Group
                        data-testid="assign-class-types"
                        options={plannedTypes.map((p) => ({ label: p.title, value: p.slug }))}
                        value={formik.values.classTypeSlugs}
                        onChange={(vals) => {
                          void formik.setFieldValue('classTypeSlugs', vals.map(String));
                          void formik.setFieldTouched('classTypeSlugs', true, false);
                        }}
                      />
                    </Form.Item>
                    {effectiveSelectedSlugs.includes('maruza') &&
                    countEffectiveStreams(formik.values.streams) === 0 ? (
                      <Alert
                        type="info"
                        showIcon
                        message={t('studyLoad.distribution.assign.lectureNeedsStream')}
                        style={{ marginBottom: 'var(--space-3)' }}
                      />
                    ) : null}
                  </Col>
                ) : null}

                {assignedInfo ? (
                  <Col span={24}>
                    <Alert
                      type={allGroupsTaken ? 'error' : 'warning'}
                      showIcon
                      message={
                        allGroupsTaken
                          ? t('studyLoad.distribution.assign.allGroupsTaken')
                          : t('studyLoad.distribution.assign.alreadyAssigned')
                      }
                      description={
                        <>
                          {t('studyLoad.distribution.assign.assignedToLabel')}{' '}
                          <b>{assignedInfo.teacherNames.join(', ')}</b>.{' '}
                          {allGroupsTaken
                            ? t('studyLoad.distribution.assign.noGroupsLeft')
                            : takenForSelectedCount > 0
                              ? t(
                                  isSplit
                                    ? 'studyLoad.distribution.assign.someGroupsTakenTypes'
                                    : 'studyLoad.distribution.assign.someGroupsTaken',
                                  { n: takenForSelectedCount },
                                )
                              : isSplit
                                ? t('studyLoad.distribution.assign.otherTypesFree')
                                : t('studyLoad.distribution.assign.noGroupsShown')}
                        </>
                      }
                      action={
                        onViewAssignment && assignedInfo.teacherEntryIds.length > 0 ? (
                          <Button
                            size="small"
                            type="link"
                            onClick={() => onViewAssignment(assignedInfo.teacherEntryIds[0]!)}
                          >
                            {t('studyLoad.distribution.assign.viewAssignment')}
                          </Button>
                        ) : undefined
                      }
                      style={{ marginBottom: 'var(--space-3)' }}
                    />
                  </Col>
                ) : null}

                {selectedSuitability === 'crossDepartment' ? (
                  <>
                    <Col span={24}>
                      <Alert
                        type="info"
                        showIcon
                        message={t('studyLoad.distribution.suitability.crossDepartmentTitle')}
                        description={t('studyLoad.distribution.suitability.crossDepartmentDescription')}
                        style={{ marginBottom: 'var(--space-3)' }}
                      />
                    </Col>
                    <Col span={24}>
                      <Form.Item
                        label={t('studyLoad.distribution.suitability.basisLabel')}
                        required
                        validateStatus={
                          formik.touched.suitabilityBasis && formik.errors.suitabilityBasis
                            ? 'error'
                            : ''
                        }
                        help={
                          formik.touched.suitabilityBasis ? formik.errors.suitabilityBasis : undefined
                        }
                      >
                        <Select
                          placeholder={t('studyLoad.distribution.suitability.basisPlaceholder')}
                          options={ASSIGNMENT_BASES.map((basis) => ({
                            value: basis,
                            label: t(ASSIGNMENT_BASIS_LABEL_KEYS[basis]),
                          }))}
                          value={formik.values.suitabilityBasis || null}
                          onChange={(v) =>
                            void formik.setFieldValue(
                              'suitabilityBasis',
                              (v ?? '') as AssignmentBasis | '',
                            )
                          }
                          onBlur={() => void formik.setFieldTouched('suitabilityBasis')}
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.Item
                        label={t('studyLoad.distribution.suitability.noteLabel')}
                        required
                        validateStatus={
                          formik.touched.suitabilityNote && formik.errors.suitabilityNote
                            ? 'error'
                            : ''
                        }
                        help={
                          formik.touched.suitabilityNote ? formik.errors.suitabilityNote : undefined
                        }
                      >
                        <Input.TextArea
                          rows={3}
                          placeholder={t('studyLoad.distribution.suitability.notePlaceholder')}
                          value={formik.values.suitabilityNote}
                          onChange={(e) =>
                            void formik.setFieldValue('suitabilityNote', e.target.value)
                          }
                          onBlur={() => void formik.setFieldTouched('suitabilityNote')}
                          style={{ resize: 'none' }}
                        />
                      </Form.Item>
                    </Col>
                  </>
                ) : null}

                {selectedBlock ? (
                  <>
                    <Col span={12}>
                      <Form.Item label={t('studyLoad.distribution.assign.courseFieldLabel')}>
                        <Tag color="blue">
                          {t('studyLoad.distribution.assign.courseTag', {
                            course: selectedBlock.course,
                          })}
                        </Tag>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        label={t('studyLoad.distribution.assign.semesterFieldLabel')}
                        validateStatus={formik.touched.semester && formik.errors.semester ? 'error' : ''}
                        help={formik.touched.semester && formik.errors.semester ? formik.errors.semester : undefined}
                      >
                        <Select
                          options={semesterOptions}
                          value={formik.values.semester}
                          onChange={(v) => void formik.setFieldValue('semester', v)}
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                    </Col>
                  </>
                ) : null}

                <Col span={24}>
                  <Form.Item label={t('studyLoad.distribution.assign.groupsFieldLabel')}>
                    <Select
                      mode="multiple"
                      showSearch
                      placeholder={t('studyLoad.distribution.assign.groupsPlaceholder')}
                      options={filteredGroupOptions.map((g) => ({ label: g.title, value: g.id }))}
                      value={formik.values.groups}
                      onChange={(v) => void formik.setFieldValue('groups', v)}
                      filterOption={(input, opt) =>
                        String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      style={{ width: '100%' }}
                      tagRender={({ label, closable, onClose }) => (
                        <StreamChip>
                          {label}
                          {closable ? (
                            <span
                              role="button"
                              style={{ cursor: 'pointer', marginLeft: 4 }}
                              onClick={onClose}
                            >
                              ×
                            </span>
                          ) : null}
                        </StreamChip>
                      )}
                    />
                  </Form.Item>
                </Col>
              </Row>

              {formik.values.streams.length > 0 ? (
                <>
                  <Divider style={{ margin: '12px 0' }} />
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>
                    {t('studyLoad.distribution.assign.streamsHeading')}
                  </Text>
                  {formik.values.streams.map((stream, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 'var(--space-3)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: 'var(--space-2)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: 8,
                        }}
                      >
                        <Text strong>
                          {t('studyLoad.distribution.assign.streamIndexLabel', { n: idx + 1 })}
                        </Text>
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          type="text"
                          onClick={() => handleRemoveStream(idx)}
                        />
                      </div>
                      <Select
                        mode="multiple"
                        showSearch
                        placeholder={t('studyLoad.distribution.assign.streamGroupsPlaceholder')}
                        options={filteredGroupOptions.map((g) => ({ label: g.title, value: g.id }))}
                        value={stream.groups}
                        onChange={(v) => handleStreamGroupChange(idx, v)}
                        filterOption={(input, opt) =>
                          String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                        style={{ width: '100%' }}
                      />
                    </div>
                  ))}
                </>
              ) : null}

              <Button
                icon={<PlusOutlined />}
                type="dashed"
                block
                style={{ marginTop: 'var(--space-2)' }}
                onClick={handleAddStream}
              >
                {t('studyLoad.distribution.assign.addStream')}
              </Button>

              <ContingentPrefill
                block={selectedBlock}
                availableGroupIds={availableGroupIds}
                onApply={(streams, groups) => {
                  void formik.setFieldValue('streams', streams);
                  void formik.setFieldValue('groups', groups);
                }}
              />

              {classTypes.length > 0 ? (
                <>
                  <Divider style={{ margin: '16px 0 8px' }} />
                  <div style={{ marginBottom: 8 }}>
                    <Text strong>{t('studyLoad.distribution.assign.lessonHoursHeading')}</Text>
                  </div>
                  <HoursListWrapper>
                    <HoursListHead>
                      <span>{t('studyLoad.distribution.assign.lessonTypeColumn')}</span>
                      <span style={{ textAlign: 'right' }}>
                        {t('studyLoad.distribution.assign.perStreamColumn')}
                      </span>
                      <span style={{ textAlign: 'right' }}>
                        {t('studyLoad.distribution.assign.totalColumn')}
                      </span>
                    </HoursListHead>
                    {visibleClassTypes.map((ct) => (
                      <HoursListItem key={ct.slug}>
                        <Text style={{ fontSize: 13 }}>{ct.title}</Text>
                        <Text
                          style={{
                            fontSize: 13,
                            textAlign: 'right',
                            color: ct.stream ? undefined : 'var(--color-text-muted, #999)',
                          }}
                        >
                          {ct.stream === null || ct.stream === 0 ? '—' : ct.stream}
                        </Text>
                        <Text strong style={{ fontSize: 13, textAlign: 'right' }}>
                          {ct.total === 0 ? '—' : ct.total}
                        </Text>
                      </HoursListItem>
                    ))}
                    <HoursListFooter>
                      <Text
                        style={{
                          fontWeight: 600,
                          color: '#f97316',
                          fontSize: 14,
                        }}
                      >
                        {t('studyLoad.distribution.assign.totalFooter', { n: totalHour })}
                      </Text>
                    </HoursListFooter>
                  </HoursListWrapper>
                </>
              ) : null}

              {(addTeacher.isError || addBlock.isError) ? (
                <Alert
                  type="error"
                  showIcon
                  style={{ marginTop: 'var(--space-4)' }}
                  message={getApiErrorMessage(addTeacher.error ?? addBlock.error)}
                />
              ) : null}
            </div>

            <div className="form-footer">
              <ModalFooter
                spacing="none"
                submit
                cancelLabel={t('studyLoad.common.cancel')}
                confirmLabel={t('studyLoad.common.save')}
                loading={isLoading}
              />
            </div>
          </>
        )}
      </form>
    </FormWrapper>
  );
};

export default AssignForm;
