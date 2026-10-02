import { Link } from 'react-router-dom';
import { Button, Result } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';

export function ForbiddenPage() {
  const { t } = useTranslation();
  return (
    <Result
      status="403"
      title="403"
      subTitle={t('forbidden_subtitle')}
      extra={
        <Link to="/">
          <Button type="primary">{t('back_home')}</Button>
        </Link>
      }
    />
  );
}

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <Result
      status="404"
      title="404"
      subTitle={t('not_found_subtitle')}
      extra={
        <Link to="/">
          <Button type="primary">{t('back_home')}</Button>
        </Link>
      }
    />
  );
}
