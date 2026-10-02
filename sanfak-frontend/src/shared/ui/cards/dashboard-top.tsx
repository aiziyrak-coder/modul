import styled from 'styled-components';
import type { ComponentType } from 'react';

const Card = styled.div`
  background: var(--color-bg, #fff);
  border-radius: var(--radius-lg, 12px);
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05));
`;

const IconBox = styled.div<{ $bg: string }>`
  width: 52px;
  height: 52px;
  border-radius: var(--radius-md, 8px);
  background: ${({ $bg }) => $bg};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 22px;
`;

const Info = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const Count = styled.span`
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text, #121926);
  line-height: 1.2;
`;

const LabelText = styled.span`
  font-size: 13px;
  color: var(--color-text-soft, #697586);
  font-weight: 500;
`;

export interface DashboardTopProps {
  count: number | string;
  label: string;
  icon: ComponentType<{ style?: React.CSSProperties }>;
  iconBgColor?: string;
  iconColor?: string;
}

export function DashboardTop({
  count,
  label,
  icon: Icon,
  iconBgColor = '#f0fdf9',
  iconColor = 'var(--brand-primary, #37cb94)',
}: DashboardTopProps) {
  return (
    <Card>
      <IconBox $bg={iconBgColor}>
        <Icon style={{ color: iconColor }} />
      </IconBox>
      <Info>
        <Count>{count}</Count>
        <LabelText>{label}</LabelText>
      </Info>
    </Card>
  );
}
