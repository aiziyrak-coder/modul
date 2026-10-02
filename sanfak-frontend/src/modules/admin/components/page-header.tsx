import type { ReactNode } from 'react';
import styled from 'styled-components';
import { Typography } from '@/shared/ui';

const Wrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-5);
  flex-wrap: wrap;
  gap: var(--space-3);
`;

const Left = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

interface Props {
  title: ReactNode;
  subtitle?: ReactNode;
  extra?: ReactNode;
}

export function PageHeader({ title, subtitle, extra }: Props) {
  return (
    <Wrap>
      <Left>
        <Typography.Title level={4} style={{ margin: 0, color: 'var(--color-text)' }}>
          {title}
        </Typography.Title>
        {subtitle && (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {subtitle}
          </Typography.Text>
        )}
      </Left>
      {extra && <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>{extra}</div>}
    </Wrap>
  );
}
