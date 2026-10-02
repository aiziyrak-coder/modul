import ReportsPage from '../reports';
import MyAchievementsPage from '../my-achievements';
import { useSciRole } from '../../model/role-status';

export default function DefensePage() {
  const role = useSciRole();
  if (role === 'teacher') return <MyAchievementsPage only="defense" />;
  return <ReportsPage only="defense" />;
}
