import { Button, Typography } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { Card, Flex } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import type { PaymentLock } from '../../model/learning.types';

const { Text } = Typography;

export function PaymentLocked({ lock }: { lock: PaymentLock }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fmt = (n: number) => `${new Intl.NumberFormat('uz-UZ').format(n)} so'm`;

  return (
    <Card size="small" style={{ flex: 1 }}>
      <Flex vertical align="center" justify="center" gap={14} style={{ padding: '64px 16px', textAlign: 'center' }}>
        <span
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'color-mix(in srgb, var(--brand-error) 14%, #fff)',
            color: 'var(--brand-error)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
          }}
        >
          <LockOutlined />
        </span>
        <Text strong style={{ fontSize: 16 }}>
          {t('qualification.learning.paymentLockedTitle')}
        </Text>
        <Text type="secondary" style={{ maxWidth: 440 }}>
          {t('qualification.learning.paymentLockedText')}
        </Text>
        <Flex gap={24} wrap justify="center">
          <Flex vertical gap={2}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('qualification.learning.paymentRequired')}
            </Text>
            <Text strong>{fmt(lock.requiredAmount)}</Text>
          </Flex>
          <Flex vertical gap={2}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('qualification.learning.paymentPaid')}
            </Text>
            <Text strong>{fmt(lock.paidAmount)}</Text>
          </Flex>
          {lock.dueAt ? (
            <Flex vertical gap={2}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('qualification.learning.paymentDue')}
              </Text>
              <Text strong style={{ color: 'var(--brand-error)' }}>
                {dayjs(lock.dueAt).format('DD.MM.YYYY')}
              </Text>
            </Flex>
          ) : null}
        </Flex>
        <Button type="primary" onClick={() => navigate('/payment')}>
          {t('qualification.learning.paymentGo')}
        </Button>
      </Flex>
    </Card>
  );
}

export default PaymentLocked;
