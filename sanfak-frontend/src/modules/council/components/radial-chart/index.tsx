import { Flex, Progress, Typography, theme } from 'antd';

export interface RadialItem {
  label: string;
  value: number;
  color: string;
}

interface Props {
  data: RadialItem[];
  total?: number;
  size?: number;
}

export function RadialChart({ data, total, size = 110 }: Props) {
  const { token } = theme.useToken();
  const base = total ?? data.reduce((acc, d) => acc + d.value, 0);

  return (
    <Flex gap={16} wrap justify="space-around">
      {data.map((d) => (
        <Flex key={d.label} vertical align="center" gap={4}>
          <Progress
            type="dashboard"
            size={size}
            percent={base > 0 ? Math.round((d.value / base) * 100) : 0}
            strokeColor={d.color}
            trailColor={token.colorFillSecondary}
            format={() => (
              <span style={{ color: token.colorText, fontWeight: 700, fontSize: 22 }}>{d.value}</span>
            )}
            aria-label={`${d.label}: ${d.value}`}
          />
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {d.label}
          </Typography.Text>
        </Flex>
      ))}
    </Flex>
  );
}
