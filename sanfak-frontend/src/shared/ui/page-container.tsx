import { useEffect, type ReactNode } from 'react';
import { Flex } from 'antd';

export interface PageContainerProps {
  title: string;
  extra?: ReactNode;
  children: ReactNode;
}

export function PageContainer({ title, extra, children }: PageContainerProps) {
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);

  return (
    <Flex
      vertical
      gap={0}
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
    >
      {extra ? (
        <Flex justify="flex-end" align="center" wrap gap={12} style={{ flexShrink: 0 }}>
          {extra}
        </Flex>
      ) : null}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </Flex>
  );
}
