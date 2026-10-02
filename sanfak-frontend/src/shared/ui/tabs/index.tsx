import type { ReactNode } from 'react';
import { Segmented, Tabs as AntTabs } from 'antd';
import type { SegmentedProps } from 'antd';
import styled from 'styled-components';

const SegWrap = styled.div`
  .ant-segmented {
    background: var(--color-border-soft, #eef2f6);
    border-radius: var(--radius-md, 8px);
    padding: 3px;
  }
  .ant-segmented-item-selected {
    background: var(--color-bg, #fff);
    border-radius: 6px;
    font-weight: 600;
    color: var(--color-text, #121926);
  }
`;

export interface TabOption {
  value: string;
  label: string;
  img?: string;
}

export interface TabProps {
  options: TabOption[];
  value?: string;
  onChange?: (value: string) => void;
  height?: number;
  borderRadius?: number;
  padding?: string;
}

export function Tab({ options, value, onChange, height = 44, borderRadius, padding }: TabProps) {
  const items: SegmentedProps['options'] = options.map((o) => ({
    value: o.value,
    label: o.img
      ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <img src={o.img} alt={o.label} style={{ width: 18, height: 18, objectFit: 'cover', borderRadius: 3 }} />
          {o.label}
        </span>
      )
      : o.label,
  }));

  return (
    <SegWrap>
      <Segmented
        options={items}
        value={value}
        onChange={(v) => onChange?.(v as string)}
        style={{
          height,
          borderRadius: borderRadius ?? undefined,
          padding: padding ?? undefined,
        }}
      />
    </SegWrap>
  );
}

const LineWrap = styled.div<{ $color?: string }>`
  .ant-tabs-ink-bar {
    background: ${({ $color }) => $color ?? 'var(--brand-primary, #37cb94)'} !important;
  }
  .ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn {
    color: ${({ $color }) => $color ?? 'var(--brand-primary, #37cb94)'} !important;
    font-weight: 600;
  }
  .ant-tabs-tab {
    font-size: 14px;
    color: var(--color-text-soft, #697586);
  }
`;

export interface LineTabItem {
  key: string;
  label: ReactNode;
  children?: ReactNode;
}

export interface LineTabProps {
  data: LineTabItem[];
  activeTab?: string;
  setActiveTab?: (key: string) => void;
  color?: string;
}

export function LineTab({ data, activeTab, setActiveTab, color }: LineTabProps) {
  return (
    <LineWrap $color={color}>
      <AntTabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="line"
        items={data.map((d) => ({ key: d.key, label: d.label, children: d.children }))}
      />
    </LineWrap>
  );
}
