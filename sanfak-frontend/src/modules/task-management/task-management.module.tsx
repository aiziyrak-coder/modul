import { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import {
  BarChartOutlined,
  DashboardOutlined,
  ProfileOutlined,
  TagsOutlined,
  UnorderedListOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons';
import { defineModule } from '@/shared/lib/module';

const DashboardRedirect = () => <Navigate to="/task-management/dashboard" replace />;

const NotificationsRedirect = () => <Navigate to="/bildirishnomalar" replace />;

export default defineModule({
  name: 'task-management',
  menuGroup: { titleKey: 'menuGroup.taskManagement', order: 80 },

  routes: [
    { index: true, element: DashboardRedirect },
    { path: 'dashboard', element: lazy(() => import('./pages/dashboard-page')) },

    { path: 'tasks', permission: 'task:create', element: lazy(() => import('./pages/tasks-page')) },
    { path: 'tasks/:id', permission: 'task:read', element: lazy(() => import('./components/task-detail')) },

    { path: 'my-tasks', permission: 'task:readAll', element: lazy(() => import('./pages/my-tasks-page')) },
    { path: 'my-tasks/:id', permission: 'task:read', element: lazy(() => import('./components/task-detail')) },

    { path: 'monitoring', permission: 'task:export', element: lazy(() => import('./pages/monitoring-page')) },

    { path: 'notifications', element: NotificationsRedirect },

    { path: 'categories', permission: 'taskCategory:create', element: lazy(() => import('./pages/categories-page')) },

    { path: 'assignee-grants', permission: 'task:manageMembers', element: lazy(() => import('./pages/assignee-grants-page')) },
  ],

  menu: [
    { titleKey: 'taskManagement.nav.dashboard', icon: <DashboardOutlined />, path: '/task-management/dashboard', order: 701, permission: 'task:readAll' },
    { titleKey: 'taskManagement.nav.tasks', icon: <UnorderedListOutlined />, path: '/task-management/tasks', order: 702, permission: 'task:create' },
    { titleKey: 'taskManagement.nav.myTasks', icon: <ProfileOutlined />, path: '/task-management/my-tasks', order: 704, permission: 'task:readAll' },
    { titleKey: 'taskManagement.nav.monitoring', icon: <BarChartOutlined />, path: '/task-management/monitoring', order: 705, permission: 'task:export' },
    { titleKey: 'taskManagement.nav.categories', icon: <TagsOutlined />, path: '/task-management/categories', order: 707, permission: 'taskCategory:create' },
    { titleKey: 'taskManagement.nav.assigneeGrants', icon: <UsergroupAddOutlined />, path: '/task-management/assignee-grants', order: 708, permission: 'task:manageMembers' },
  ],

  i18n: {
    uz: {
      'menuGroup.taskManagement': 'Vazifalar',
      'taskManagement.nav.dashboard': 'Boshqaruv paneli',
      'taskManagement.nav.tasks': 'Chiquvchi topshiriqlar',
      'taskManagement.nav.myTasks': 'Kiruvchi topshiriqlar',
      'taskManagement.nav.monitoring': 'Hisobotlar',
      'taskManagement.nav.notifications': 'Bildirishnomalar',
      'taskManagement.nav.categories': 'Kategoriyalar',
      'taskManagement.nav.assigneeGrants': 'Ijrochilarni biriktirish',
    },
    ru: {
      'menuGroup.taskManagement': 'Задачи',
      'taskManagement.nav.dashboard': 'Панель управления',
      'taskManagement.nav.tasks': 'Исходящие задачи',
      'taskManagement.nav.myTasks': 'Входящие задачи',
      'taskManagement.nav.monitoring': 'Отчёты',
      'taskManagement.nav.notifications': 'Уведомления',
      'taskManagement.nav.categories': 'Категории',
      'taskManagement.nav.assigneeGrants': 'Назначение исполнителей',
    },
    en: {
      'menuGroup.taskManagement': 'Tasks',
      'taskManagement.nav.dashboard': 'Dashboard',
      'taskManagement.nav.tasks': 'Outgoing Tasks',
      'taskManagement.nav.myTasks': 'Incoming Tasks',
      'taskManagement.nav.monitoring': 'Reports',
      'taskManagement.nav.notifications': 'Notifications',
      'taskManagement.nav.categories': 'Categories',
      'taskManagement.nav.assigneeGrants': 'Assignee Access',
    },
  },

  permissions: [
    { key: 'task:create', description: 'Create task' },
    { key: 'task:read', description: 'View one task' },
    { key: 'task:readAll', description: 'List tasks (own / assigned / monitoring)' },
    { key: 'task:update', description: 'Update task / post response' },
    { key: 'task:delete', description: 'Delete task' },
    { key: 'task:changeStatus', description: 'Finalize / reopen / reassign task' },
    { key: 'task:export', description: 'Export monitoring report (.xlsx)' },
    { key: 'task:manageMembers', description: 'Manage who each user may assign tasks to' },

    { key: 'taskCategory:create', description: 'Create task category' },
    { key: 'taskCategory:read', description: 'View one task category' },
    { key: 'taskCategory:readAll', description: 'List task categories' },
    { key: 'taskCategory:update', description: 'Update task category' },
    { key: 'taskCategory:delete', description: 'Delete task category' },
  ],
});
