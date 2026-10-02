import ReportsPage from '../reports';
import MyAchievementsPage from '../my-achievements';
import { useSciRole } from '../../model/role-status';

export default function ScientificDegreesPage() {
  const role = useSciRole();
  if (role === 'teacher') return <MyAchievementsPage only="degrees" />;
  return <ReportsPage only="degrees" />;
}
