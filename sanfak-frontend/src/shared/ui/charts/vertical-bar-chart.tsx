import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  type TooltipProps,
} from 'recharts';
import styled from 'styled-components';
import { appConfig } from '@/shared/config';

const Wrap = styled.div`
  background: var(--color-bg, #fff);
  border-radius: var(--radius-lg, 12px);
  padding: 20px;
`;

const ChartTitle = styled.h4`
  margin: 0 0 16px;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text, #121926);
`;

const TooltipBox = styled.div`
  background: var(--color-bg, #fff);
  border: 1px solid var(--color-border, #e3e8ef);
  border-radius: var(--radius-md, 8px);
  padding: 8px 12px;
  font-size: 13px;
  color: var(--color-text, #121926);
  box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05));
`;

const ACTIVE_COLOR = appConfig.ui.primaryColor;
const DEFAULT_COLOR = '#a8e8cc';

function CustomTooltip({ active, payload, label }: TooltipProps<number, string> & { payload?: Array<{ value?: number }>; label?: string }) {
  if (active && payload?.length) {
    return (
      <TooltipBox>
        <strong>{label}</strong>: {payload[0]?.value}
      </TooltipBox>
    );
  }
  return null;
}

export interface BarChartItem {
  label: string;
  value: number;
}

export interface VerticalBarChartProps {
  title?: string;
  data: BarChartItem[];
  height?: number;
}

export function VerticalBarChart({ title, data, height = 300 }: VerticalBarChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <Wrap>
      {title && <ChartTitle>{title}</ChartTitle>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f6" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: '#697586' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 12, fill: '#697586' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f5f7fb' }} />
          <Bar
            dataKey="value"
            radius={[4, 4, 0, 0]}
            onMouseEnter={(_, idx) => setActiveIndex(idx)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {data.map((_, idx) => (
              <Cell
                key={idx}
                fill={activeIndex === idx ? ACTIVE_COLOR : DEFAULT_COLOR}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Wrap>
  );
}
