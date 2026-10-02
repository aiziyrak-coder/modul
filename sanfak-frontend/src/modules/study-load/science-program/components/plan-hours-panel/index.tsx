import { Alert, Button, Spin, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';
import type { WorkingPlanStatus } from '../../model/types';
import { HoursChip, HoursChipRow, HoursPanel, HoursPanelMeta, HoursPanelTitle } from '../../style';

interface IProps {
  status: WorkingPlanStatus | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

const fmt = (v: number | string | null): string => (v === null || v === '' ? '—' : String(v));

const PlanHoursPanel = ({ status, isLoading, isError, onRetry }: IProps) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <HoursPanel aria-busy="true">
        <HoursPanelTitle>{t('scienceProgram.v142.hours.planTitle')}</HoursPanelTitle>
        <Spin size="small" />
      </HoursPanel>
    );
  }

  if (isError) {
    return (
      <Alert
        type="error"
        showIcon
        message={t('scienceProgram.v142.hours.planError')}
        action={
          <Button size="small" icon={<ReloadOutlined />} onClick={onRetry}>
            {t('scienceProgram.v142.common.retry')}
          </Button>
        }
      />
    );
  }

  if (!status) return null;

  const plan = status.planHours;
  if (!plan) {
    return (
      <Alert
        type="warning"
        showIcon
        message={status.warning ?? t('scienceProgram.v142.hours.noPlan')}
        description={t('scienceProgram.v142.hours.noPlanHint')}
      />
    );
  }

  return (
    <HoursPanel role="region" aria-label={t('scienceProgram.v142.hours.planTitle')}>
      <HoursPanelTitle>{t('scienceProgram.v142.hours.planTitle')}</HoursPanelTitle>

      <HoursPanelMeta>
        <span>
          {t('scienceProgram.v142.hours.code')}: <strong>{fmt(plan.code)}</strong>
        </span>
        <span>
          {t('scienceProgram.v142.hours.serialNumber')}: <strong>{fmt(plan.serialNumber)}</strong>
        </span>
        <span>
          {t('scienceProgram.v142.hours.semester')}: <strong>{fmt(plan.semester)}</strong>
        </span>
        <span>
          {t('scienceProgram.v142.hours.credits')}: <strong>{fmt(plan.credits)}</strong>
        </span>
        <span>
          {t('scienceProgram.v142.hours.weeklyHours')}: <strong>{fmt(plan.weeklyHours)}</strong>
        </span>
        <span>
          {t('scienceProgram.v142.hours.moduleType')}: <strong>{fmt(plan.moduleType)}</strong>
        </span>
      </HoursPanelMeta>

      <HoursPanelMeta>
        <span>
          {t('scienceProgram.v142.hours.total')}: <strong>{fmt(plan.totalHours)}</strong>
        </span>
        <span>
          {t('scienceProgram.v142.hours.classroom')}: <strong>{fmt(plan.classroomHours)}</strong>
        </span>
        <span>
          {t('scienceProgram.v142.hours.independent')}:{' '}
          <strong>{fmt(plan.independentHours)}</strong>
        </span>
      </HoursPanelMeta>

      {plan.items.length > 0 ? (
        <HoursChipRow>
          {plan.items.map((item) => (
            <HoursChip key={item.slug || item.title} $state="neutral">
              <span className="chip-label">{item.title || item.slug}</span>
              <span className="chip-value">{item.value}</span>
            </HoursChip>
          ))}
        </HoursChipRow>
      ) : (
        <Typography.Text type="secondary">{t('scienceProgram.v142.hours.planNoItems')}</Typography.Text>
      )}

      {plan.clinicalUnknown ? (
        <Typography.Text type="secondary">{t('scienceProgram.v142.hours.clinicalUnknown')}</Typography.Text>
      ) : null}

      {plan.warnings.map((w) => (
        <Typography.Text key={w} type="warning">
          {w}
        </Typography.Text>
      ))}
    </HoursPanel>
  );
};

export default PlanHoursPanel;
