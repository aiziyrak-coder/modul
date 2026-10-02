import { useMemo } from 'react';
import { Flex, Typography, theme } from 'antd';

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface Props {
  data: DonutSlice[];
  centerCaption?: string;
  size?: number;
  thickness?: number;
}

export function DonutChart({ data, centerCaption = 'Jami', size = 180, thickness = 28 }: Props) {
  const { token } = theme.useToken();
  const total = data.reduce((acc, d) => acc + d.value, 0);

  const background = useMemo(() => {
    if (total === 0) return token.colorFillSecondary;
    let acc = 0;
    const stops = data
      .filter((d) => d.value > 0)
      .map((d) => {
        const from = (acc / total) * 360;
        acc += d.value;
        const to = (acc / total) * 360;
        return `${d.color} ${from}deg ${to}deg`;
      });
    return `conic-gradient(${stops.join(', ')})`;
  }, [data, total, token.colorFillSecondary]);

  return (
    <Flex gap="var(--space-5, 20px)" align="center" wrap>
      <div
        role="img"
        aria-label={`${centerCaption}: ${total}`}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background,
          position: 'relative',
          flex: '0 0 auto',
        }}
      >
        <Flex
          vertical
          align="center"
          justify="center"
          style={{
            position: 'absolute',
            inset: thickness,
            borderRadius: '50%',
            background: token.colorBgContainer,
          }}
        >
          <span
            style={{
              fontSize: 28,
              fontWeight: 700,
              lineHeight: 1.1,
              color: token.colorText,
              letterSpacing: '-0.02em',
            }}
          >
            {total}
          </span>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {centerCaption}
          </Typography.Text>
        </Flex>
      </div>

      <Flex vertical gap={8} style={{ flex: 1, minWidth: 160 }}>
        {data.map((d) => (
          <Flex key={d.label} align="center" gap={8}>
            <span
              aria-hidden
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: d.color,
                flex: '0 0 auto',
              }}
            />
            <Typography.Text style={{ fontSize: 13, flex: 1 }}>{d.label}</Typography.Text>
            <Typography.Text strong style={{ fontSize: 13 }}>
              {d.value}
            </Typography.Text>
          </Flex>
        ))}
      </Flex>
    </Flex>
  );
}
