import { useTranslation } from '@/shared/lib/i18n';
import type { TeacherDepartmentRow, TeachersSummary } from '../../model/types';
import StatTile from '../stat-tile';
import DepartmentBars from './department-bars';
import { son, foiz } from '../../lib/format';
import { Tiles } from './style';

interface IProps {
  summary: TeachersSummary;
  byDepartment: TeacherDepartmentRow[];
  loading?: boolean;
}

export default function TeacherCoverage({ summary, byDepartment, loading }: IProps) {
  const { t } = useTranslation();

  const items = byDepartment.map((d) => ({ id: d.departmentId, label: d.department, value: d.unassigned }));

  return (
    <div>
      <Tiles>
        <StatTile label={t('studyLoad.stats.metric.teachersTotal')} value={son(summary.total)} loading={loading} />
        <StatTile
          label={t('studyLoad.stats.metric.teachersAssigned')}
          value={`${son(summary.assigned)} (${foiz(summary.assignedPercent)})`}
          tone="good"
          loading={loading}
        />
        <StatTile
          label={t('studyLoad.stats.metric.teachersUnassigned')}
          value={son(summary.unassigned)}
          tone="critical"
          loading={loading}
        />
      </Tiles>

      {!loading && items.length > 0 ? (
        <DepartmentBars title={t('studyLoad.stats.section.teachersByDepartment')} items={items} tone="critical" />
      ) : null}
    </div>
  );
}
