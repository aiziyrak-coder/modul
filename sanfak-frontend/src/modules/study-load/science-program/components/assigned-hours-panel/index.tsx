import { Typography } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';
import type { ScienceOption } from '../../model/types';
import { TOPIC_TYPE_OPTION_KEYS } from '../../lib/v142-defaults';
import { HoursChip, HoursChipRow, HoursPanel, HoursPanelMeta, HoursPanelTitle } from '../../style';

interface IProps {
  science: ScienceOption | null;
}

const fmt = (v: number | null): string => (v === null ? '—' : String(v));

const AssignedHoursPanel = ({ science }: IProps) => {
  const { t } = useTranslation();
  if (!science) return null;

  const hours = science.assignedHours;

  return (
    <HoursPanel role="region" aria-label={t('scienceProgram.v142.hours.assignedTitle')}>
      <HoursPanelTitle>{t('scienceProgram.v142.hours.assignedTitle')}</HoursPanelTitle>

      {hours === null ? (
        <Typography.Text type="secondary">
          {t('scienceProgram.v142.hours.assignedEmpty')}
        </Typography.Text>
      ) : (
        <>
          <HoursPanelMeta>
            <span>
              {t('scienceProgram.v142.hours.semester')}: <strong>{science.semester ?? '—'}</strong>
            </span>
            <span>
              {t('scienceProgram.v142.hours.total')}:{' '}
              <strong>
                {fmt(hours.total)} {t('scienceProgram.v142.hours.unit')}
              </strong>
            </span>
          </HoursPanelMeta>

          <HoursChipRow>
            {TOPIC_TYPE_OPTION_KEYS.map((o) => (
              <HoursChip key={o.value} $state="neutral">
                <span className="chip-label">{t(o.labelKey)}</span>
                <span className="chip-value">{fmt(hours.byType[o.value])}</span>
              </HoursChip>
            ))}
            <HoursChip $state="neutral">
              <span className="chip-label">{t('scienceProgram.v142.hours.independent')}</span>
              <span className="chip-value">{fmt(hours.independent)}</span>
            </HoursChip>
          </HoursChipRow>
        </>
      )}
    </HoursPanel>
  );
};

export default AssignedHoursPanel;
