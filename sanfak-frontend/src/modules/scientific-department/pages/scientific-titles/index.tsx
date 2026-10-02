import ReportsPage from '../reports';
import MyAchievementsPage from '../my-achievements';
import { useSciRole } from '../../model/role-status';

export default function ScientificTitlesPage() {
  const role = useSciRole();
  if (role === 'teacher') return <MyAchievementsPage only="titles" />;
  return <ReportsPage only="titles" />;
}
