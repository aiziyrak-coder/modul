import ReportsPage from '../reports';
import MyAchievementsPage from '../my-achievements';
import { useSciRole } from '../../model/role-status';

export default function PatentsPage() {
  const role = useSciRole();
  if (role === 'teacher') return <MyAchievementsPage only="patents" />;
  return <ReportsPage only="patents" />;
}
