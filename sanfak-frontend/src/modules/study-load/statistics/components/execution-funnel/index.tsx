import { useTranslation } from '@/shared/lib/i18n';
import type { ExecutionStep, ExecutionStepKey } from '../../model/types';
import { Row, Label, Track, Fill, Count, SectionTitle } from './style';

const STEP_ORDER: ExecutionStepKey[] = ['learningProcess', 'workingSchedule', 'workload', 'distribution'];

const STEP_LABEL_KEY: Record<ExecutionStepKey, string> = {
  learningProcess: 'studyLoad.stats.execution.learningProcess',
  workingSchedule: 'studyLoad.nav.workingPlan',
  workload: 'studyLoad.nav.workload',
  distribution: 'studyLoad.nav.distribution',
};

interface IProps {
  steps: ExecutionStep[];
  percent: number;
}

export default function ExecutionFunnel({ steps, percent }: IProps) {
  const { t } = useTranslation();
  const byKey = new Map(steps.map((s) => [s.key, s]));
  const max = Math.max(...steps.map((s) => s.total), 1);

  return (
    <div>
      <SectionTitle>
        {t('studyLoad.stats.section.progress')} · {percent}%
      </SectionTitle>
      {STEP_ORDER.map((key) => {
        const step = byKey.get(key);
        const total = step?.total ?? 0;
        const done = step?.done ?? 0;
        return (
          <Row key={key}>
            <Label>{t(STEP_LABEL_KEY[key])}</Label>
            <Track>
              <Fill $percent={total > 0 ? (total / max) * 100 : 0} $tone="soft" />
              <Fill $percent={total > 0 ? (done / max) * 100 : 0} $tone="solid" />
            </Track>
            <Count>
              <b>{done}</b>
              <span>/{total}</span>
            </Count>
          </Row>
        );
      })}
    </div>
  );
}
