import { Navigate } from 'react-router-dom';
import { usePermission } from '@/app/session';

export default function CouncilLandingPage() {
  const can = usePermission();
  if (can('councilMember:readAll')) return <Navigate to="/kengash/dashboard" replace />;
  if (can('anonymousVote:create')) return <Navigate to="/kengash/ovoz-berish" replace />;
  if (can('rankApplication:readAll')) return <Navigate to="/kengash/unvonlar/hujjatlar" replace />;
  if (can('votingSession:export')) return <Navigate to="/kengash/hisobotlar" replace />;
  if (can('announcement:readAll')) return <Navigate to="/kengash/elonlar" replace />;
  return <Navigate to="/kengash/bildirishnomalar" replace />;
}
