import type { ReactNode, CSSProperties } from 'react';
import styled from 'styled-components';
import { Typography } from '@/shared/ui';

const Wrap = styled.div`
  background: #ffffff;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5);
  border-bottom: 1px solid var(--color-border);
`;

const Body = styled.div`
  padding: var(--space-5);
`;

interface Props {
  title?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
  bodyStyle?: CSSProperties;
}

export function AdminCard({ title, extra, children, style, bodyStyle }: Props) {
  return (
    <Wrap style={style}>
      {(title ?? extra) && (
        <Head>
          {title && (
            <Typography.Text strong style={{ fontSize: 16 }}>
              {title}
            </Typography.Text>
          )}
          {extra && <div>{extra}</div>}
        </Head>
      )}
      <Body style={bodyStyle}>{children}</Body>
    </Wrap>
  );
}
