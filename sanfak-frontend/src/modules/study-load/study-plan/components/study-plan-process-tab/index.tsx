import { useCallback, useMemo, useState } from 'react';
import { App, Button, Empty, InputNumber, Popover, Space, Typography } from 'antd';
import { CalendarOutlined, CheckOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { Can } from '@/app/session';
import { getApiErrorMessage } from '@/shared/api';
import {
  useUpdateLearningProcessCourse,
  useUpdateMonthWeeks,
  type UpdateLearningProcessCoursePayload,
} from '../../api/detail-api';
import MonthWeeksEditor, {
  type MonthWeeksSavePayload,
} from '../../../components/month-weeks-editor';
import { monthCountsOf } from '../../../lib/month-weeks';
import type { LpAllValues } from '../../model/detail-types';
import { deriveWeekStats } from '../../../lib/derive-week-stats';
import { useTranslation } from '@/shared/lib/i18n';

const { Text } = Typography;

const LEGEND_COLORS: Record<string, string> = {
  A: '#C1D3F6', B: '#7AABF0', D: '#4A82C8', E: '#B8EDBE',
  F: '#68CC7A', G: '#38A852', H: '#FFF3A8', I: '#FFE040',
  J: '#F0C000', K: '#FFD4A8', L: '#FFB060', M: '#E88C30',
  N: '#FFB8B8', O: '#F07070', P: '#D84040', Q: '#FFD4EC',
  R: '#F090C0', S: '#D85898', T: '#E0C8FF', U: '#B880F0',
  V: '#9050D0', X: '#B8F0EE', Y: '#50CCC8', Z: '#28A8A4',
};

function getKeyColor(key: string): string {
  return LEGEND_COLORS[key.trim().toUpperCase()] ?? '#f0f0f0';
}

const ProcessWrap = styled.div`
  overflow-x: auto;
`;

const LegendRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 40px;
  row-gap: 12px;
  margin-bottom: 20px;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 180px;
`;

const LegendBox = styled.div<{ $bg: string }>`
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md, 8px);
  background: ${({ $bg }) => $bg};
  border: ${({ $bg }) => $bg === '#f0f0f0' ? '1px solid var(--color-border)' : 'none'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  font-size: 16px;
  color: var(--color-text, #121926);
  flex-shrink: 0;
`;

const WeekCellDiv = styled.div<{ $bg?: string; $editing?: boolean }>`
  width: 100%;
  height: 36px;
  min-width: 28px;
  background: ${({ $bg }) => $bg ?? 'transparent'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 500;
  cursor: ${({ $editing }) => $editing ? 'pointer' : 'default'};
  outline: none;
`;

const GridTable = styled.table`
  border-collapse: collapse;
  font-size: 13px;
  min-width: 100%;

  th, td {
    border: 1px solid var(--color-border, #e3e8ef);
    padding: 4px 6px;
    text-align: center;
    white-space: nowrap;
  }

  th {
    background: #EEF2F6;
    font-weight: 600;
    color: var(--color-text-soft, #697586);
    position: sticky;
    top: 0;
    z-index: 1;
  }

  th.month-header {
    background: #ECF3FF;
    color: var(--color-text, #121926);
  }

  td.course-cell {
    font-weight: 600;
    min-width: 60px;
    text-align: left;
    background: var(--color-bg-table-head, #eef2f6);
  }

  td.total-cell, td.stat-cell {
    font-weight: 500;
    min-width: 50px;
    background: var(--color-bg-layout, #f8fafc);
  }

  tr.jami-row td {
    background: var(--color-bg-table-head, #EEF2F6);
    font-weight: 600;
  }
`;

interface StatItem {
  _id?: string;
  key?: string | null;
  slug?: string;
  title?: string;
  value?: number;
}

interface MonthItem {
  _id?: string;
  month?: string;
  weeks?: { week?: number; key?: string; _id?: string }[];
}

interface CourseItem {
  _id?: string;
  course?: string;
  months?: MonthItem[];
  weeks?: Record<string, string>;
  total?: number;
  statistics?: StatItem[];
}

interface LegendKeyItem {
  _id?: string;
  key?: string;
  title?: string;
}

interface IProps {
  learningProcessId: string;
  keys: LegendKeyItem[];
  courses: CourseItem[];
  allValues?: LpAllValues;
}

interface PopoverWeekCellProps {
  weekNum: number;
  displayValue: string;
  isEditing: boolean;
  keys: LegendKeyItem[];
  onChange: (weekNum: number, val: string) => void;
}

function PopoverWeekCell({ weekNum, displayValue, isEditing, keys, onChange }: PopoverWeekCellProps) {
  const [open, setOpen] = useState(false);
  const trimmed = (displayValue ?? '').trim();
  const meta = keys.find((k) => (k.key ?? '').trim() === trimmed);
  const bg = trimmed ? (meta ? getKeyColor(meta.key ?? '') : '#f0f0f0') : undefined;

  if (!isEditing) {
    return <WeekCellDiv $bg={bg}>{trimmed}</WeekCellDiv>;
  }

  const content = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 200 }}>
      {keys.map((k) => {
        const kBg = getKeyColor(k.key ?? '');
        return (
          <div
            key={k._id ?? k.key}
            onClick={() => { onChange(weekNum, k.key ?? ''); setOpen(false); }}
            style={{
              width: 28, height: 28, borderRadius: 4, background: kBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
              border: '1px solid var(--color-border)',
            }}
          >
            {k.key}
          </div>
        );
      })}
      <div
        onClick={() => { onChange(weekNum, ' '); setOpen(false); }}
        style={{
          width: 28, height: 28, borderRadius: 4, background: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, cursor: 'pointer', border: '1px solid var(--color-border)',
        }}
      >
        —
      </div>
    </div>
  );

  return (
    <Popover content={content} trigger="click" open={open} onOpenChange={setOpen}>
      <WeekCellDiv
        $bg={bg}
        $editing
        style={{ outline: open ? '2px solid var(--brand-primary)' : undefined }}
      >
        {trimmed}
      </WeekCellDiv>
    </Popover>
  );
}

interface EditState {
  weeks: Record<string, string>;
  total: number;
  statistics: Record<string, number>;
}

interface JamiEditState {
  total: number;
  statistics: Record<string, number>;
}

const StudyPlanProcessTab = ({ learningProcessId, keys, courses, allValues }: IProps) => {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const updateMutation = useUpdateLearningProcessCourse(learningProcessId);

  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ weeks: {}, total: 0, statistics: {} });

  const [jamiEditing, setJamiEditing] = useState(false);
  const [jamiEditState, setJamiEditState] = useState<JamiEditState>({ total: 0, statistics: {} });

  const handleStartEdit = useCallback((course: CourseItem) => {
    const cId = course._id ?? '';
    const statMap: Record<string, number> = {};
    (course.statistics ?? []).forEach((s) => {
      if (s._id) statMap[s._id] = s.value ?? 0;
    });
    setEditingRowId(cId);
    setEditState({
      weeks: { ...(course.weeks ?? {}) },
      total: course.total ?? 0,
      statistics: statMap,
    });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingRowId(null);
    setEditState({ weeks: {}, total: 0, statistics: {} });
  }, []);

  const handleWeekChange = useCallback(
    (weekNum: number, val: string) => {
      const course = courses.find((c) => (c._id ?? '') === editingRowId);
      setEditState((prev) => {
        const weeks = { ...prev.weeks, [String(weekNum)]: val };
        if (!course) return { ...prev, weeks };
        const derived = deriveWeekStats(weeks, course.statistics ?? []);
        return {
          weeks,
          total: derived.total,
          statistics: { ...prev.statistics, ...derived.statistics },
        };
      });
    },
    [courses, editingRowId],
  );

  const handleTotalChange = useCallback((val: number | null) => {
    setEditState((prev) => ({ ...prev, total: val ?? 0 }));
  }, []);

  const handleStatChange = useCallback((statId: string, val: number | null) => {
    setEditState((prev) => ({
      ...prev,
      statistics: { ...prev.statistics, [statId]: val ?? 0 },
    }));
  }, []);

  const handleSave = useCallback(
    async (course: CourseItem) => {
      const state = editState;
      const payload: UpdateLearningProcessCoursePayload = {
        courseId: course._id,
        total: state.total,
        weeks: state.weeks,
        statistics: (course.statistics ?? []).map((stat) => ({
          _id: stat._id ?? '',
          value: state.statistics[stat._id ?? ''] ?? stat.value ?? 0,
        })),
      };
      try {
        await updateMutation.mutateAsync(payload);
        message.success(t('studyLoad.studyPlan.composition.saved'));
        handleCancelEdit();
      } catch {
        message.error(t('studyLoad.studyPlan.composition.saveError'));
      }
    },
    [updateMutation, message, handleCancelEdit, editState, t],
  );

  const handleJamiStartEdit = useCallback(() => {
    const statMap: Record<string, number> = {};
    (allValues?.statistics ?? []).forEach((s) => {
      if (s._id) statMap[s._id] = s.value ?? 0;
    });
    setJamiEditing(true);
    setJamiEditState({
      total: allValues?.total ?? 0,
      statistics: statMap,
    });
  }, [allValues]);

  const handleJamiCancelEdit = useCallback(() => {
    setJamiEditing(false);
    setJamiEditState({ total: 0, statistics: {} });
  }, []);

  const handleJamiTotalChange = useCallback((val: number | null) => {
    setJamiEditState((prev) => ({ ...prev, total: val ?? 0 }));
  }, []);

  const handleJamiStatChange = useCallback((statId: string, val: number | null) => {
    setJamiEditState((prev) => ({
      ...prev,
      statistics: { ...prev.statistics, [statId]: val ?? 0 },
    }));
  }, []);

  const handleJamiSave = useCallback(async () => {
    const payload: UpdateLearningProcessCoursePayload = {
      allValues: {
        total: jamiEditState.total,
        statistics: (allValues?.statistics ?? []).map((stat) => ({
          title: stat.title ?? '',
          _id: stat._id ?? '',
          value: jamiEditState.statistics[stat._id ?? ''] ?? stat.value ?? 0,
        })),
      },
    };
    try {
      await updateMutation.mutateAsync(payload);
      message.success(t('studyLoad.studyPlan.process.jamiSaved'));
      handleJamiCancelEdit();
    } catch {
      message.error(t('studyLoad.studyPlan.composition.saveError'));
    }
  }, [updateMutation, message, handleJamiCancelEdit, jamiEditState, allValues, t]);

  const months = useMemo(() => courses[0]?.months ?? [], [courses]);
  const totalWeeks = useMemo(
    () => months.reduce((sum, m) => sum + (m.weeks?.length ?? 0), 0),
    [months],
  );
  const statCols = useMemo(() => courses[0]?.statistics ?? [], [courses]);

  const [monthWeeksOpen, setMonthWeeksOpen] = useState(false);
  const monthWeeksMutation = useUpdateMonthWeeks(learningProcessId);
  const monthCounts = useMemo(() => monthCountsOf(months), [months]);
  const handleMonthWeeksSave = useCallback(
    async ({ counts, applyToDraftSchedules }: MonthWeeksSavePayload) => {
      try {
        const res = await monthWeeksMutation.mutateAsync({ counts, applyToDraftSchedules });
        message.success(t('studyLoad.monthWeeks.saved'));
        if (applyToDraftSchedules) {
          message.info(
            t('studyLoad.monthWeeks.savedSchedules', {
              updated: res.schedules.updated,
              skipped: res.schedules.skippedLocked,
            }),
            6,
          );
        }
        res.schedules.errors.forEach((e) => message.warning(e, 8));
        setMonthWeeksOpen(false);
      } catch (err) {
        message.error(getApiErrorMessage(err, t('studyLoad.monthWeeks.errorDefault')));
      }
    },
    [monthWeeksMutation, message, t],
  );

  if (!courses.length) {
    return (
      <Empty
        description={t('studyLoad.studyPlan.process.empty')}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <ProcessWrap>
      <LegendRow>
        {keys.map((k, i) => (
          <LegendItem key={k._id ?? i}>
            <LegendBox $bg={getKeyColor(k.key ?? '')}>
              {(k.key ?? '').trim() || '—'}
            </LegendBox>
            <Text style={{ fontSize: 13 }}>{k.title ?? ''}</Text>
          </LegendItem>
        ))}
        <Can perform="learningProcess:update">
          <Button
            size="small"
            icon={<CalendarOutlined />}
            onClick={() => setMonthWeeksOpen(true)}
            disabled={!months.length}
            style={{ marginLeft: 'auto' }}
          >
            {t('studyLoad.monthWeeks.open')}
          </Button>
        </Can>
      </LegendRow>
      <MonthWeeksEditor
        open={monthWeeksOpen}
        months={monthCounts}
        showApplyToSchedules
        loading={monthWeeksMutation.isPending}
        onCancel={() => setMonthWeeksOpen(false)}
        onSave={(p) => void handleMonthWeeksSave(p)}
      />

      <GridTable>
        <thead>
          <tr>
            <th rowSpan={2} style={{ minWidth: 60 }}>{t('studyLoad.distribution.column.course')}</th>
            {months.map((m, mi) => (
              <th
                key={m._id ?? mi}
                colSpan={m.weeks?.length ?? 1}
                className="month-header"
              >
                {m.month ?? ''}
              </th>
            ))}
            <th rowSpan={2} style={{ minWidth: 50 }}>{t('studyLoad.distribution.table.total')}</th>
            {statCols.map((s, si) => (
              <th key={s._id ?? si} rowSpan={2} style={{ minWidth: 55 }}>
                {s.title ?? ''}
              </th>
            ))}
            <th rowSpan={2} style={{ minWidth: 80 }}>{t('studyLoad.distribution.column.actions')}</th>
          </tr>
          <tr>
            {Array.from({ length: totalWeeks }, (_, i) => (
              <th key={i} style={{ minWidth: 28, padding: '2px 0' }}>
                {i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {courses.map((course) => {
            const cId = course._id ?? '';
            const isCurrentEditing = editingRowId === cId;
            const weeksMap = isCurrentEditing ? editState.weeks : (course.weeks ?? {});

            return (
              <tr key={cId}>
                <td className="course-cell">{course.course ?? ''}</td>
                {(course.months ?? []).map((month) =>
                  (month.weeks ?? []).map((w) => {
                    const displayVal = weeksMap[String(w.week ?? '')] ?? '';
                    return (
                      <td key={w.week} style={{ padding: 0 }}>
                        <PopoverWeekCell
                          weekNum={w.week ?? 0}
                          displayValue={displayVal}
                          isEditing={isCurrentEditing}
                          keys={keys}
                          onChange={handleWeekChange}
                        />
                      </td>
                    );
                  }),
                )}
                <td className="total-cell" style={{ padding: isCurrentEditing ? 2 : undefined }}>
                  {isCurrentEditing ? (
                    <InputNumber
                      size="small"
                      min={0}
                      value={editState.total}
                      onChange={handleTotalChange}
                      style={{ width: 58 }}
                      controls={false}
                    />
                  ) : (
                    course.total ?? 0
                  )}
                </td>
                {(course.statistics ?? []).map((stat, si) => (
                  <td key={stat._id ?? si} className="stat-cell" style={{ padding: isCurrentEditing ? 2 : undefined }}>
                    {isCurrentEditing ? (
                      <InputNumber
                        size="small"
                        min={0}
                        value={editState.statistics[stat._id ?? ''] ?? stat.value ?? 0}
                        onChange={(val) => handleStatChange(stat._id ?? '', val)}
                        style={{ width: 58 }}
                        controls={false}
                      />
                    ) : (
                      stat.value ?? 0
                    )}
                  </td>
                ))}
                <td style={{ textAlign: 'center', padding: '0 4px' }}>
                  {isCurrentEditing ? (
                    <Space size={4}>
                      <Button
                        type="text"
                        size="small"
                        icon={<CheckOutlined />}
                        style={{ color: 'var(--brand-primary)' }}
                        loading={updateMutation.isPending}
                        onClick={() => handleSave(course)}
                      />
                      <Button
                        type="text"
                        size="small"
                        icon={<CloseOutlined />}
                        onClick={handleCancelEdit}
                      />
                    </Space>
                  ) : (
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      style={{ color: 'var(--color-text-soft)' }}
                      onClick={() => handleStartEdit(course)}
                    />
                  )}
                </td>
              </tr>
            );
          })}

          <tr className="jami-row">
            <td
              colSpan={totalWeeks + 1}
              style={{ textAlign: 'left', fontWeight: 600, paddingLeft: 8 }}
            >
              {t('studyLoad.distribution.table.total')}
            </td>
            <td className="total-cell" style={{ padding: jamiEditing ? 2 : undefined }}>
              {jamiEditing ? (
                <InputNumber
                  size="small"
                  min={0}
                  value={jamiEditState.total}
                  onChange={handleJamiTotalChange}
                  style={{ width: 58 }}
                  controls={false}
                />
              ) : (
                allValues?.total ?? 0
              )}
            </td>
            {statCols.map((stat, si) => {
              const allStat = (allValues?.statistics ?? []).find(
                (s) => s._id === stat._id || s.slug === stat.slug,
              );
              return (
                <td key={stat._id ?? si} className="stat-cell" style={{ padding: jamiEditing ? 2 : undefined }}>
                  {jamiEditing ? (
                    <InputNumber
                      size="small"
                      min={0}
                      value={jamiEditState.statistics[stat._id ?? ''] ?? allStat?.value ?? 0}
                      onChange={(val) => handleJamiStatChange(stat._id ?? '', val)}
                      style={{ width: 58 }}
                      controls={false}
                    />
                  ) : (
                    allStat?.value ?? 0
                  )}
                </td>
              );
            })}
            <td style={{ textAlign: 'center', padding: '0 4px' }}>
              {jamiEditing ? (
                <Space size={4}>
                  <Button
                    type="text"
                    size="small"
                    icon={<CheckOutlined />}
                    style={{ color: 'var(--brand-primary)' }}
                    loading={updateMutation.isPending}
                    onClick={() => handleJamiSave()}
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={handleJamiCancelEdit}
                  />
                </Space>
              ) : (
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  style={{ color: 'var(--color-text-soft)' }}
                  onClick={handleJamiStartEdit}
                />
              )}
            </td>
          </tr>
        </tbody>
      </GridTable>
    </ProcessWrap>
  );
};

export default StudyPlanProcessTab;
