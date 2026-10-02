import type { ReactNode } from 'react';
import styled from 'styled-components';

const Card = styled.div`
  background: ${({ theme }) => theme.colors.white};
  border-radius: 14px;
  padding: 20px 24px;
  box-shadow: ${({ theme }) => theme.shadow.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  flex: 1;
  min-width: 160px;
`;

const IconWrap = styled.div<{ $bg?: string }>`
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: ${({ $bg }) => $bg || '#EAFAF1'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin-bottom: 14px;
`;

const Num = styled.div`
  font-size: 26px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
  line-height: 1;
  margin-bottom: 6px;
`;

const LabelText = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Trend = styled.div<{ $up?: boolean }>`
  font-size: 12px;
  margin-top: 6px;
  color: ${({ $up }) => ($up ? '#27AE60' : '#E74C3C')};
`;

export interface StatCardProps {
  icon?: ReactNode;
  number: ReactNode;
  label: ReactNode;
  trend?: ReactNode;
  trendUp?: boolean;
  iconBg?: string;
}

export default function StatCard({ icon, number, label, trend, trendUp, iconBg }: StatCardProps) {
  return (
    <Card>
      {(icon || iconBg) && <IconWrap $bg={iconBg}>{icon}</IconWrap>}
      <Num>{number}</Num>
      <LabelText>{label}</LabelText>
      {trend && <Trend $up={trendUp}>{trend}</Trend>}
    </Card>
  );
}
