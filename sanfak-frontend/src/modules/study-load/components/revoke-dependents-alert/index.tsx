import { Alert, Typography } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';
import StatusBadge from '../status-badge';
import type { RevokeDependent } from '../../lib/final-step';

interface IProps {
  dependents: RevokeDependent[];
}

const RevokeDependentsAlert = ({ dependents }: IProps) => {
  const { t } = useTranslation();
  return (
    <Alert
      type="error"
      showIcon
      role="alert"
      message={t('studyLoad.revokeFinal.dependentsTitle')}
      description={
        <>
          <Typography.Paragraph style={{ marginBottom: 'var(--space-2)' }}>
            {t('studyLoad.revokeFinal.dependentsHint')}
          </Typography.Paragraph>
          <ul
            data-testid="revoke-dependents"
            style={{ margin: 0, paddingInlineStart: 'var(--space-4)' }}
          >
            {dependents.map((d, i) => {
              const typeLabel = t(`studyLoad.revokeFinal.type.${d.type}`, { defaultValue: d.type });
              return d.hidden ? (
                <li key={`hidden-${d.type}-${i}`} style={{ marginBottom: 'var(--space-1)' }}>
                  <Typography.Text type="secondary">
                    {t('studyLoad.revokeFinal.hiddenDependents', { type: typeLabel, n: d.count })}
                  </Typography.Text>
                </li>
              ) : (
                <li key={`${d.type}-${d.id}`} style={{ marginBottom: 'var(--space-1)' }}>
                  <Typography.Text strong>{typeLabel}</Typography.Text>
                  {': '}
                  <Typography.Text>{d.title ?? t('studyLoad.revokeFinal.untitled')}</Typography.Text>{' '}
                  <StatusBadge status={d.status} />
                </li>
              );
            })}
          </ul>
        </>
      }
    />
  );
};

export default RevokeDependentsAlert;
