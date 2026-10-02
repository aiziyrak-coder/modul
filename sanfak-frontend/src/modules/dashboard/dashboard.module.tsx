import { lazy } from 'react';
import { HomeOutlined } from '@ant-design/icons';
import { defineModule } from '@/shared/lib/module';

export default defineModule({
  name: 'dashboard',
  menuGroup: { titleKey: 'menuGroup.dashboard', order: 0 },
  basePath: '/bosh-sahifa',
  routes: [
    {
      index: true,
      permission: 'dashboard:read',
      element: lazy(() => import('./pages/bosh-sahifa-page')),
    },
  ],
  menu: [
    {
      titleKey: 'dashboard.nav.home',
      icon: <HomeOutlined />,
      path: '/bosh-sahifa',
      order: 1,
      permission: 'dashboard:read',
    },
  ],
  i18n: {
    uz: {
      'menuGroup.dashboard': 'Bosh sahifa',
      'dashboard.nav.home': 'Bosh sahifa',
    },
    ru: {
      'menuGroup.dashboard': 'Главная',
      'dashboard.nav.home': 'Главная',
    },
    en: {
      'menuGroup.dashboard': 'Home',
      'dashboard.nav.home': 'Home',
    },
  },
  permissions: [
    {
      key: 'dashboard:read',
      description: 'View the management dashboard (/bosh-sahifa) — rector panel',
    },
  ],
});
