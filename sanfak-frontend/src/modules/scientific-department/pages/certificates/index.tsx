import ReportsPage from '../reports';
import MyAchievementsPage from '../my-achievements';
import { useSciRole } from '../../model/role-status';

export default function CertificatesPage() {
  const role = useSciRole();
  if (role === 'teacher') return <MyAchievementsPage only="certificates" />;
  return <ReportsPage only="certificates" />;
}
