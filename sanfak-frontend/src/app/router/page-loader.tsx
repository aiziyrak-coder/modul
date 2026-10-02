import { Flex, Spin } from '@/shared/ui';

export function PageLoader({ full = false }: { full?: boolean }) {
  return (
    <Flex align="center" justify="center" style={{ minHeight: full ? '100vh' : 240 }}>
      <Spin size="large" />
    </Flex>
  );
}
