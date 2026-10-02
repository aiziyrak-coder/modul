import { useTranslation } from '@/shared/lib/i18n';
import { son } from '../../../lib/format';
import { Bar, Empty, List, Name, Row, Title, Track, Value, type BarTone } from './style';

export interface DepartmentBarItem {
  id: string;
  label: string;
  value: number;
}

interface IProps {
  title: string;
  items: DepartmentBarItem[];
  tone?: BarTone;
}

export default function DepartmentBars({ title, items, tone = 'critical' }: IProps) {
  const { t } = useTranslation();

  const sorted = [...items].sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...sorted.map((item) => item.value));

  return (
    <section aria-label={title}>
      <Title>{title}</Title>
      {sorted.length === 0 ? (
        <Empty>{t('studyLoad.stats.empty')}</Empty>
      ) : (
        <List role="list">
          {sorted.map((item) => (
            <Row key={item.id} role="listitem" title={`${item.label}: ${son(item.value)}`}>
              <Name>{item.label}</Name>
              <Track aria-hidden="true">
                <Bar
                  $tone={tone}
                  data-testid="department-bar"
                  style={{ width: `${(item.value / max) * 100}%` }}
                />
              </Track>
              <Value>{son(item.value)}</Value>
            </Row>
          ))}
        </List>
      )}
    </section>
  );
}
