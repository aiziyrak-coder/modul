import { Empty, Flex, Typography, theme } from 'antd';

export interface BarItem {
  label: string;
  value: number;
  color: string;
}

interface Props {
  data: BarItem[];
  height?: number;
  emptyText?: string;
}

export function BarChart({ data, height = 170, emptyText = "Ma'lumot yo'q" }: Props) {
  const { token } = theme.useToken();

  if (data.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const valueZone = 26;
  const barMax = height - valueZone;

  return (
    <Flex align="stretch" gap={10} role="img" aria-label={data.map((d) => `${d.label}: ${d.value}`).join(', ')}>
      {data.map((d) => {
        const barH = d.value > 0 ? Math.max(6, Math.round((d.value / max) * barMax)) : 3;
        return (
          <Flex key={d.label} vertical align="center" style={{ flex: 1, minWidth: 0 }}>
            <Flex
              vertical
              align="center"
              justify="flex-end"
              style={{ height, width: '100%', borderBottom: `2px solid ${token.colorBorderSecondary}` }}
            >
              <Typography.Text strong style={{ fontSize: 13, marginBottom: 4 }}>
                {d.value}
              </Typography.Text>
              <div
                style={{
                  height: barH,
                  width: '100%',
                  maxWidth: 44,
                  background: d.value > 0 ? d.color : token.colorFillSecondary,
                  borderRadius: `${token.borderRadius}px ${token.borderRadius}px 0 0`,
                  transition: 'height 0.3s ease',
                }}
              />
            </Flex>
            <Typography.Text
              type="secondary"
              title={d.label}
              style={{
                fontSize: 12,
                textAlign: 'center',
                marginTop: 6,
                lineHeight: 1.25,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {d.label}
            </Typography.Text>
          </Flex>
        );
      })}
    </Flex>
  );
}
