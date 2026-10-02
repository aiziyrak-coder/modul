import { Spin } from 'antd';

interface SpinnerProps {
  maxHeight?: string;
}

export function Spinner({ maxHeight = '200px' }: SpinnerProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        maxHeight,
        height: maxHeight,
        width: '100%',
      }}
    >
      <Spin size="large" />
    </div>
  );
}
