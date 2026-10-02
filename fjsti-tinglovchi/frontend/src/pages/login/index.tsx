import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { App, Button, Card, Flex, Form, Input, Typography } from 'antd';
import { IdcardOutlined } from '@ant-design/icons';
import { login, useSessionStore } from '@/app/session';
import { getApiErrorMessage } from '@/shared/api';
import { appConfig } from '@/shared/config';

const { Title, Text } = Typography;

export default function LoginPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const status = useSessionStore((s) => s.status);
  const [loading, setLoading] = useState(false);

  if (status === 'authenticated') return <Navigate to="/enrollment" replace />;

  const onFinish = async (values: { oneIdPin: string }) => {
    setLoading(true);
    try {
      await login(values.oneIdPin.trim());
      navigate('/enrollment', { replace: true });
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Kirishda xatolik'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Flex
      align="center"
      justify="center"
      style={{ minHeight: '100vh', background: 'var(--color-bg-elevate, #f5f7fb)', padding: 16 }}
    >
      <Card style={{ width: 420, borderRadius: 16 }} styles={{ body: { padding: 32 } }}>
        <Flex vertical align="center" gap={8} style={{ marginBottom: 24 }}>
          <img src="/logo.png" alt="Logo" style={{ width: 56, height: 56 }} />
          <Title level={4} style={{ margin: 0, textAlign: 'center' }}>
            {appConfig.appName}
          </Title>
          <Text type="secondary">Malaka oshirish — tinglovchi kabineti</Text>
        </Flex>

        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item
            name="oneIdPin"
            label="OneID PIN"
            rules={[
              { required: true, message: 'PIN kiriting' },
              { pattern: /^\d{14}$/, message: 'PIN 14 ta raqamdan iborat bo‘lishi kerak' },
            ]}
          >
            <Input
              size="large"
              prefix={<IdcardOutlined />}
              placeholder="14 xonali PIN"
              maxLength={14}
              autoFocus
            />
          </Form.Item>

          <Button type="primary" size="large" htmlType="submit" loading={loading} block>
            Kirish
          </Button>
        </Form>
      </Card>
    </Flex>
  );
}
