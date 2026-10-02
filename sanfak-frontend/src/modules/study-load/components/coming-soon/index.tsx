import { Typography } from 'antd';
import { PageContainer } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';

interface IProps {
  title: string;
}

const ComingSoon = ({ title }: IProps) => {
  const { t } = useTranslation();
  return (
    <PageContainer title={title}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '40vh',
        }}
      >
        <Typography.Text type="secondary">{t('studyLoad.common.comingSoon')}</Typography.Text>
      </div>
    </PageContainer>
  );
};

export default ComingSoon;
