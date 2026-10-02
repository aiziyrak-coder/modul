import type { ReactNode } from 'react';
import {
  BookOutlined,
  CreditCardOutlined,
  FileProtectOutlined,
  ReadOutlined,
  SafetyCertificateOutlined,
  SolutionOutlined,
} from '@ant-design/icons';

export interface MenuItem {
  path: string;
  titleKey: string;
  icon: ReactNode;
}

export const LISTENER_MENU: MenuItem[] = [
  { path: '/enrollment', titleKey: 'qualification.nav.enrollment', icon: <SolutionOutlined /> },
  { path: '/learning', titleKey: 'qualification.nav.learning', icon: <ReadOutlined /> },
  { path: '/resources', titleKey: 'qualification.nav.resources', icon: <BookOutlined /> },
  { path: '/payment', titleKey: 'qualification.nav.payment', icon: <CreditCardOutlined /> },
  { path: '/exit-test', titleKey: 'qualification.nav.exit', icon: <FileProtectOutlined /> },
  { path: '/certificate', titleKey: 'qualification.nav.certificate', icon: <SafetyCertificateOutlined /> },
];
