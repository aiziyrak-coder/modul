import type { ReactNode } from 'react';
import { Flex, Typography } from 'antd';

const { Title } = Typography;

export function PageHeader({ title, extra }: { title: string; extra?: ReactNode }) {
  return (
    <Flex align="center" justify="space-between" gap={12} wrap style={{ marginBottom: 16 }}>
      <Title level={4} style={{ margin: 0, color: 'var(--color-text)' }}>
        {title}
      </Title>
      {extra}
    </Flex>
  );
}
