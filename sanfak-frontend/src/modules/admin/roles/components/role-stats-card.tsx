import styled from 'styled-components';
import { Typography } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';

const Wrapper = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--color-bg-elevate, #f5f7fb);
  border-radius: var(--radius-lg, 12px);
  padding: 16px 20px;
`;

const TextBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Count = styled.span`
  font-family: Inter;
  font-weight: 600;
  font-size: 36px;
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--brand-primary, #37cb94);
`;

interface Props {
  selected: number;
  total: number;
}

export function RoleStatsCard({ selected, total }: Props) {
  const { t } = useTranslation();
  return (
    <Wrapper>
      <TextBlock>
        <Typography.Text style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text)' }}>
          {t('admin.role.statsCard.title')}
        </Typography.Text>
        <Typography.Text style={{ fontSize: 13, color: 'var(--color-text-soft)' }}>
          {t('admin.role.statsCard.subtitle', { total })}
        </Typography.Text>
      </TextBlock>
      <Count>{selected}</Count>
    </Wrapper>
  );
}
