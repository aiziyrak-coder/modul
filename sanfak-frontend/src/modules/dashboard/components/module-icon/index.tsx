import type { ReactNode } from 'react';
import {
  AuditOutlined,
  BankOutlined,
  BarChartOutlined,
  ExperimentOutlined,
  FileDoneOutlined,
  GlobalOutlined,
  IdcardOutlined,
  MedicineBoxOutlined,
  ReadOutlined,
  ScheduleOutlined,
  StarOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { AnimKind } from '../module-anim';

const MAP: Record<string, { icon: ReactNode; anim: AnimKind }> = {
  'study-load': { icon: <ScheduleOutlined />, anim: 'stack' },
  teacher: { icon: <IdcardOutlined />, anim: 'people' },
  qualification: { icon: <ReadOutlined />, anim: 'book' },
  residency: { icon: <MedicineBoxOutlined />, anim: 'doc' },
  'science-council': { icon: <ExperimentOutlined />, anim: 'flow' },
  'task-management': { icon: <FileDoneOutlined />, anim: 'sign' },
  'foreign-admission': { icon: <GlobalOutlined />, anim: 'globe' },
  council: { icon: <AuditOutlined />, anim: 'vote' },
  'scientific-department': { icon: <TeamOutlined />, anim: 'doc' },
  'gifted-students': { icon: <StarOutlined />, anim: 'star' },
  'education-quality': { icon: <BarChartOutlined />, anim: 'chart' },
  practice: { icon: <BankOutlined />, anim: 'sign' },
};

const FALLBACK = { icon: <FileDoneOutlined />, anim: 'flow' as AnimKind };

export const moduleIcon = (key: string): ReactNode => (MAP[key] ?? FALLBACK).icon;
export const moduleAnim = (key: string): AnimKind => (MAP[key] ?? FALLBACK).anim;
