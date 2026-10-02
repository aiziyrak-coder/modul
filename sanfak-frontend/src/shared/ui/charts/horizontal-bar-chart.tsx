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

const COLORS = [appConfig.ui.primaryColor, '#2dab7b', '#28a374', '#20946a', '#188560'];

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

export interface HorizontalBarChartProps {
  title?: string;
  data: BarChartItem[];
  height?: number;
}

export function HorizontalBarChart({ title, data, height = 300 }: HorizontalBarChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const sorted = [...data].sort((a, b) => b.value - a.value);

  return (
    <Wrap>
      {title && <ChartTitle>{title}</ChartTitle>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2f6" />
          <XAxis type="number" tick={{ fontSize: 12, fill: '#697586' }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fontSize: 12, fill: '#697586' }}
            width={120}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f5f7fb' }} />
          <Bar
            dataKey="value"
            radius={[0, 4, 4, 0]}
            onMouseEnter={(_, idx) => setActiveIndex(idx)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {sorted.map((_, idx) => (
              <Cell
                key={idx}
                fill={
                  activeIndex === idx
                    ? '#1a9e6e'
                    : COLORS[idx % COLORS.length]
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Wrap>
  );
}
