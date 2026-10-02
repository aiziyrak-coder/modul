import { ConfigProvider } from 'antd';
import type { ReactNode } from 'react';

export default function CompactButtons({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider theme={{ components: { Button: { controlHeight: 40 } } }}>
      {children}
    </ConfigProvider>
  );
}
