import type { ReactNode } from 'react';
import { Flex, Typography } from 'antd';

const { Title, Text } = Typography;

export function PageHeader({
  title,
  subtitle,
  extra,
}: {
  title: string;
  subtitle?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <Flex align="center" justify="space-between" gap={12} wrap style={{ marginBottom: 16 }}>
      <Flex vertical gap={4}>
        <Title level={4} style={{ margin: 0, color: 'var(--color-text)' }}>
          {title}
        </Title>
        {subtitle ? <Text type="secondary">{subtitle}</Text> : null}
      </Flex>
      {extra}
    </Flex>
  );
}
