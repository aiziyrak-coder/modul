import { useMemo } from 'react';
import { useTranslation } from '@/shared/lib/i18n';
import { getCurrentTeacherId } from '../lib/current-teacher';
import SubmissionHistory from '../components/submission-history';

export default function MyDataPage() {
  const { t } = useTranslation();
  const teacherId = useMemo(() => getCurrentTeacherId(), []);

  return (
    <SubmissionHistory
      teacherId={teacherId}
      header={
        <div>
          <h2 style={{ margin: 0 }}>{t('educationQuality.myData.title')}</h2>
          <div style={{ color: 'var(--color-text-tertiary, #667085)', marginTop: 4 }}>
            {t('educationQuality.myData.subtitle')}
          </div>
        </div>
      }
    />
  );
}