import { useEffect, useState } from 'react';
import { Button, Modal, Typography } from 'antd';
import { WarningFilled } from '@ant-design/icons';
import { Flex } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';

const { Text } = Typography;

export default function TestLeaveGuard({
  active,
  onLeave,
  leaving = false,
}: {
  active: boolean;
  onLeave: () => void;
  leaving?: boolean;
}) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!active) return undefined;
    const pushSentinel = () =>
      window.history.pushState(window.history.state, '', window.location.href);
    pushSentinel();
    const onPop = () => {
      pushSentinel();
      setAsking(true);
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [active]);

  return (
    <Modal
      open={asking}
      zIndex={1100}
      footer={null}
      centered
      width={430}
      onCancel={() => setAsking(false)}
    >
      <Flex vertical align="center" gap={14} style={{ padding: '8px 4px 0' }}>
        <span
          style={{
            width: 66,
            height: 66,
            borderRadius: '50%',
            background: 'color-mix(in srgb, var(--brand-warning) 16%, #fff)',
            color: 'rgb(234, 179, 8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 32,
          }}
        >
          <WarningFilled />
        </span>
        <Text strong style={{ fontSize: 17 }}>
          {t('qualification.learning.leaveTitle')}
        </Text>
        <Text type="secondary" style={{ textAlign: 'center', fontSize: 14 }}>
          {t('qualification.learning.leaveBody')}
        </Text>
        <Flex gap={10} style={{ width: '100%', marginTop: 6 }}>
          <Button block size="large" onClick={() => setAsking(false)}>
            {t('qualification.learning.leaveStay')}
          </Button>
          <Button
            block
            size="large"
            danger
            type="primary"
            loading={leaving}
            onClick={() => {
              setAsking(false);
              onLeave();
            }}
          >
            {t('qualification.learning.leaveConfirm')}
          </Button>
        </Flex>
      </Flex>
    </Modal>
  );
}
