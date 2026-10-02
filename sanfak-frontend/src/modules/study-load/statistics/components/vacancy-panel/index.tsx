import { useTranslation } from '@/shared/lib/i18n';
import type { VacancyDepartmentRow } from '../../model/types';
import StatTile from '../stat-tile';
import { son } from '../../lib/format';
import { Tiles, ListRow, DeptName, DeptValue, Empty } from './style';

interface IProps {
  count: number;
  hours: number;
  byDepartment: VacancyDepartmentRow[];
  loading?: boolean;
}

export default function VacancyPanel({ count, hours, byDepartment, loading }: IProps) {
  const { t } = useTranslation();

  return (
    <div>
      <Tiles>
        <StatTile label={t('studyLoad.stats.metric.vacancyCount')} value={son(count)} tone="critical" loading={loading} />
        <StatTile label={t('studyLoad.stats.metric.vacancyHours')} value={son(hours)} tone="critical" loading={loading} />
      </Tiles>

      {!loading && byDepartment.length === 0 ? (
        <Empty>{t('studyLoad.stats.empty')}</Empty>
      ) : (
        byDepartment.map((d) => (
          <ListRow
            key={d.departmentId}
            title={`${d.department}: ${t('studyLoad.common.countN', { n: d.count })} · ${t('studyLoad.common.hoursN', { n: son(d.hours) })}`}
          >
            <DeptName>{d.department}</DeptName>
            <DeptValue>
              {t('studyLoad.common.countN', { n: d.count })} · {t('studyLoad.common.hoursN', { n: son(d.hours) })}
            </DeptValue>
          </ListRow>
        ))
      )}
    </div>
  );
}
