import { Alert } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';
import type { TopicHoursRow } from '../../lib/topic-hours';
import { hasHoursMismatch } from '../../lib/topic-hours';
import { TOPIC_TYPE_OPTION_KEYS } from '../../lib/v142-defaults';
import { HoursChip, HoursChipRow, HoursPanel, HoursPanelTitle } from '../../style';

interface IProps {
  rows: TopicHoursRow[];
  hasPlan: boolean;
}

const LABEL_KEY = Object.fromEntries(TOPIC_TYPE_OPTION_KEYS.map((o) => [o.value, o.labelKey]));

const MARK: Record<TopicHoursRow['state'], string> = {
  ok: '✓',
  under: '⚠',
  over: '⚠',
  unplanned: '⚠',
  noPlan: '',
};

const TopicHoursSummary = ({ rows, hasPlan }: IProps) => {
  const { t } = useTranslation();
  const mismatch = hasHoursMismatch(rows);

  return (
    <HoursPanel role="status" aria-live="polite" data-testid="topic-hours-summary">
      <HoursPanelTitle>{t('scienceProgram.v142.hours.summaryTitle')}</HoursPanelTitle>

      {rows.length === 0 ? (
        <span>{t(hasPlan ? 'scienceProgram.v142.hours.summaryEmpty' : 'scienceProgram.v142.hours.noPlan')}</span>
      ) : (
        <HoursChipRow>
          {rows.map((row) => {
            const label = t(LABEL_KEY[row.type] ?? row.type);
            const value = row.plan === null ? String(row.used) : `${row.used}/${row.plan}`;
            const hint =
              row.state === 'under'
                ? t('scienceProgram.v142.hours.under')
                : row.state === 'over'
                  ? t('scienceProgram.v142.hours.over')
                  : row.state === 'unplanned'
                    ? t('scienceProgram.v142.hours.unplanned')
                    : row.state === 'ok'
                      ? t('scienceProgram.v142.hours.ok')
                      : '';
            return (
              <HoursChip key={row.type} $state={row.state} title={hint || undefined}>
                <span className="chip-label">{label}</span>
                <span className="chip-value">{value}</span>
                {MARK[row.state] ? (
                  <span className="chip-mark" aria-label={hint}>
                    {MARK[row.state]}
                  </span>
                ) : null}
              </HoursChip>
            );
          })}
        </HoursChipRow>
      )}

      {mismatch ? (
        <Alert
          type="warning"
          showIcon
          message={t('scienceProgram.v142.hours.mismatchAlert')}
          style={{ marginTop: 4 }}
        />
      ) : null}
    </HoursPanel>
  );
};

export default TopicHoursSummary;
