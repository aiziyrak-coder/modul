import { Navigate } from 'react-router-dom';
import { usePermission } from '@/app/session';
import { pickIndexTarget } from '../../lib/index-target';

export default function StudyLoadIndexRedirect() {
  const can = usePermission();
  return <Navigate to={pickIndexTarget(can)} replace />;
}
