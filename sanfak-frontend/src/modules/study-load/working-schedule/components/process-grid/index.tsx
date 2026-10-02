import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { App, Button, Empty, InputNumber, Popover, Skeleton, Space, Typography } from 'antd';
import { Can } from '@/app/session';
import { CalendarOutlined, CheckOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons';
import { getApiErrorMessage } from '@/shared/api';
import MonthWeeksEditor, {
  type MonthWeeksSavePayload,
} from '../../../components/month-weeks-editor';
import { monthCountsOf } from '../../../lib/month-weeks';
import {
  ProcessWrap,
  LegendRow,
  LegendItem,
  LegendBox,
  GridTable,
  WeekCell,
} from './style';
import type {
  WorkingScheduleProcess,
  LegendKey,
  ProcessCourse,
} from '../../model/process-types';
import {
  useUpdateWorkingProcess,
  type UpdateProcessPayload,
  useUpdateScheduleMonthWeeks,
} from '../../api/working-schedule-process-api';
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

const STICKY_ACTIONS_WIDTH = 80;
const STICKY_COL_WIDTH = 76;

function stickyStyle(right: number, width: number): CSSProperties {
  return {
    width,
    minWidth: width,
    maxWidth: width,
    '--sticky-right': `${right}px`,
  } as CSSProperties;
}

interface PopoverCellProps {
  weekNum: number;
  value: string;
  isEditing: boolean;
  editingValue: string;
  keys: LegendKey[];
  onChange: (weekNum: number, val: string) => void;
}

function PopoverWeekCell({
  weekNum,
  value,
  isEditing,
  editingValue,
  keys,
  onChange,
}: PopoverCellProps) {
  const [open, setOpen] = useState(false);

  const displayVal = isEditing ? editingValue : value;
  const trimmed = (displayVal ?? '').trim();
  const meta = keys.find((k) => k.key.trim() === trimmed);
  const bg = trimmed ? (meta ? getKeyColor(meta.key) : '#f0f0f0') : undefined;

  if (!isEditing) {
    return (
      <WeekCell $bg={bg}>
        {trimmed}
      </WeekCell>
    );
  }

  const content = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 200 }}>
      {keys.map((k) => {
        const kBg = getKeyColor(k.key);
        return (
          <div
            key={k._id ?? k.key}
            onClick={() => {
              onChange(weekNum, k.key);
              setOpen(false);
            }}
            style={{
              width: 28,
              height: 28,
              borderRadius: 4,
              background: kBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid var(--color-border)',
            }}
          >
            {k.key}
          </div>
        );
      })}
      <div
        onClick={() => {
          onChange(weekNum, ' ');
          setOpen(false);
        }}
        style={{
          width: 28,
          height: 28,
          borderRadius: 4,
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          cursor: 'pointer',
          border: '1px solid var(--color-border)',
        }}
      >
        —
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
    >
      <WeekCell
        $bg={bg}
        style={{ cursor: 'pointer', outline: open ? '2px solid var(--brand-primary)' : undefined }}
      >
        {trimmed}
      </WeekCell>
    </Popover>
  );
}

interface EditState {
  weeks: Record<string, string>;
  total: number;
  statistics: Record<string, number>;
}

interface ProcessGridProps {
  scheduleId: string;
  data: WorkingScheduleProcess;
  editable: boolean;
}

const ProcessGrid = ({ scheduleId, data, editable }: ProcessGridProps) => {
  const { keys, courses } = data;
  const { message } = App.useApp();
  const { t } = useTranslation();
  const updateMutation = useUpdateWorkingProcess(scheduleId);

  const [monthWeeksOpen, setMonthWeeksOpen] = useState(false);
  const monthWeeksMutation = useUpdateScheduleMonthWeeks(scheduleId);
  const handleMonthWeeksSave = useCallback(
    async ({ counts }: MonthWeeksSavePayload) => {
      try {
        await monthWeeksMutation.mutateAsync(counts);
        message.success(t('studyLoad.monthWeeks.saved'));
        setMonthWeeksOpen(false);
      } catch (err) {
        message.error(getApiErrorMessage(err, t('studyLoad.monthWeeks.errorDefault')));
      }
    },
    [monthWeeksMutation, message, t],
  );

  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ weeks: {}, total: 0, statistics: {} });

  const handleStartEdit = useCallback((course: ProcessCourse) => {
    const statMap: Record<string, number> = {};
    course.statistics.forEach((s) => {
      if (s._id) statMap[s._id] = s.value;
    });
    setEditingRowId(course._id);
    setEditState({
      weeks: { ...course.weeks },
      total: course.total,
      statistics: statMap,
    });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingRowId(null);
    setEditState({ weeks: {}, total: 0, statistics: {} });
  }, []);

  const handleWeekChange = useCallback(
    (weekNum: number, val: string) => {
      const course = courses.find((c) => c._id === editingRowId);
      setEditState((prev) => {
        const weeks = { ...prev.weeks, [String(weekNum)]: val };
        if (!course) return { ...prev, weeks };
        const derived = deriveWeekStats(weeks, course.statistics);
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
    async (course: ProcessCourse) => {
      const state = editState;

      const payload: UpdateProcessPayload = {
        courseId: course._id,
        total: state.total,
        weeks: state.weeks,
        statistics: course.statistics.map((stat) => ({
          _id: stat._id ?? '',
          value: state.statistics[stat._id ?? ''] ?? stat.value,
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

  const months = useMemo(() => courses[0]?.months ?? [], [courses]);

  const totalWeeks = useMemo(
    () => months.reduce((sum, m) => sum + m.weeks.length, 0),
    [months],
  );

  const statCols = useMemo(() => courses[0]?.statistics ?? [], [courses]);

  const stickyOffsets = useMemo(() => {
    const n = statCols.length;
    const statRights = statCols.map(
      (_, i) => STICKY_ACTIONS_WIDTH + (n - 1 - i) * STICKY_COL_WIDTH,
    );
    const totalRight = STICKY_ACTIONS_WIDTH + n * STICKY_COL_WIDTH;
    return { totalRight, statRights };
  }, [statCols]);

  if (courses.length === 0) {
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
            <LegendBox $bg={getKeyColor(k.key)}>
              {k.key.trim() || '—'}
            </LegendBox>
            <Text style={{ fontSize: 13 }}>{k.title}</Text>
          </LegendItem>
        ))}
        {editable ? (
          <Can perform="workingSchedule:update">
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
        ) : null}
      </LegendRow>
      <MonthWeeksEditor
        open={monthWeeksOpen}
        months={monthCountsOf(months)}
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
                colSpan={m.weeks.length}
                className="month-header"
              >
                {m.month}
              </th>
            ))}
            <th
              rowSpan={2}
              className="sticky-col sticky-edge"
              style={stickyStyle(stickyOffsets.totalRight, STICKY_COL_WIDTH)}
            >
              {t('studyLoad.distribution.table.total')}
            </th>
            {statCols.map((s, si) => (
              <th
                key={s._id ?? si}
                rowSpan={2}
                className="sticky-col"
                style={stickyStyle(stickyOffsets.statRights[si] ?? STICKY_ACTIONS_WIDTH, STICKY_COL_WIDTH)}
              >
                {s.title}
              </th>
            ))}
            <th
              rowSpan={2}
              className="sticky-col"
              style={stickyStyle(0, STICKY_ACTIONS_WIDTH)}
            >
              {t('studyLoad.distribution.column.actions')}
            </th>
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
          {courses.map((course: ProcessCourse) => {
            const isCurrentEditing = editingRowId === course._id;

            return (
              <tr key={course._id}>
                <td className="course-cell">{course.course}</td>

                {course.months.map((month) =>
                  month.weeks.map((w) => {
                    return (
                      <td key={w.week} style={{ padding: 0 }}>
                        <PopoverWeekCell
                          weekNum={w.week}
                          value={course.weeks?.[String(w.week)] ?? ''}
                          isEditing={isCurrentEditing}
                          editingValue={editState.weeks[String(w.week)] ?? ''}
                          keys={keys}
                          onChange={handleWeekChange}
                        />
                      </td>
                    );
                  }),
                )}

                <td
                  className="total-cell sticky-col sticky-edge"
                  style={{
                    ...stickyStyle(stickyOffsets.totalRight, STICKY_COL_WIDTH),
                    padding: isCurrentEditing ? 2 : undefined,
                  }}
                >
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
                    course.total
                  )}
                </td>

                {course.statistics.map((stat, si) => (
                  <td
                    key={stat._id ?? si}
                    className="stat-cell sticky-col"
                    style={{
                      ...stickyStyle(stickyOffsets.statRights[si] ?? STICKY_ACTIONS_WIDTH, STICKY_COL_WIDTH),
                      padding: isCurrentEditing ? 2 : undefined,
                    }}
                  >
                    {isCurrentEditing ? (
                      <InputNumber
                        size="small"
                        min={0}
                        value={editState.statistics[stat._id ?? ''] ?? stat.value}
                        onChange={(val) => handleStatChange(stat._id ?? '', val)}
                        style={{ width: 58 }}
                        controls={false}
                      />
                    ) : (
                      stat.value
                    )}
                  </td>
                ))}

                <td
                  className="actions-cell sticky-col"
                  style={{
                    ...stickyStyle(0, STICKY_ACTIONS_WIDTH),
                    textAlign: 'center',
                    padding: '0 4px',
                  }}
                >
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
                    editable ? (
                      <Can perform="workingSchedule:update">
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          style={{ color: 'var(--color-text-soft)' }}
                          onClick={() => handleStartEdit(course)}
                        />
                      </Can>
                    ) : null
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </GridTable>
    </ProcessWrap>
  );
};

interface ProcessGridTabProps {
  scheduleId: string | undefined;
  isLoading: boolean;
  isError: boolean;
  data: WorkingScheduleProcess | undefined;
  editable: boolean;
}

const ProcessGridTab = ({
  scheduleId,
  isLoading,
  isError,
  data,
  editable,
}: ProcessGridTabProps) => {
  const { t } = useTranslation();
  if (isLoading) {
    return <Skeleton active paragraph={{ rows: 8 }} />;
  }
  if (isError || !data) {
    return (
      <Empty
        description={t('studyLoad.workingSchedule.processGrid.loadError')}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }
  if (!scheduleId) {
    return (
      <Empty
        description={t('studyLoad.workingSchedule.processGrid.idNotFound')}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }
  return <ProcessGrid scheduleId={scheduleId} data={data} editable={editable} />;
};

export default ProcessGridTab;
